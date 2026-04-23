package com.declitech.auth.service;

import com.declitech.auth.dto.LoginResponse;
import com.declitech.auth.dto.SsoCallbackRequest;
import com.declitech.auth.dto.SsoStaffResponse;
import com.declitech.auth.dto.SsoStudentResponse;
import com.declitech.auth.dto.SsoUrlResponse;
import com.declitech.auth.exception.InvalidCredentialsException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class SsoService {

    private final JwtService jwtService;
    private final RestTemplate restTemplate;

    @Value("${sso.iam-base-url}")
    private String iamBaseUrl;

    @Value("${sso.client-id}")
    private String clientId;

    @Value("${sso.redirect-uri}")
    private String redirectUri;

    @Value("${sso.student-auth-path}")
    private String studentAuthPath;

    @Value("${sso.staff-auth-path}")
    private String staffAuthPath;

    @Value("${sso.student-exchange-path}")
    private String studentExchangePath;

    @Value("${sso.staff-exchange-path}")
    private String staffExchangePath;

    /**
     * In-memory PKCE store: state → {codeVerifier, userType, createdAt}
     * TTL: 5 minutes (user must complete login within this window)
     */
    private final ConcurrentHashMap<String, SsoPkceEntry> pkceStore = new ConcurrentHashMap<>();

    // ─── Public API ─────────────────────────────────────────────────────────────

    /**
     * Generates a PKCE pair, stores it, and returns the IAM login URL.
     * Called by GET /api/auth/sso-url?type=student|staff
     */
    public SsoUrlResponse buildLoginUrl(String userType) {
        String codeVerifier = generateCodeVerifier();
        String codeChallenge = generateCodeChallenge(codeVerifier);
        String state = generateState();

        pkceStore.put(state, new SsoPkceEntry(codeVerifier, userType, Instant.now()));
        cleanExpiredEntries();

        String authPath = "student".equalsIgnoreCase(userType) ? studentAuthPath : staffAuthPath;
        String loginUrl = buildIamUrl(authPath, codeChallenge, state);

        log.info("SSO login URL generated for userType={}", userType);
        return new SsoUrlResponse(loginUrl);
    }

    /**
     * Exchanges the authorization code for a local JWT session.
     * Called by POST /api/auth/sso-callback
     */
    public LoginResponse handleCallback(SsoCallbackRequest request, HttpServletResponse httpResponse) {
        SsoPkceEntry entry = pkceStore.remove(request.getState());
        if (entry == null) {
            log.warn("SSO callback received with unknown or expired state");
            throw new InvalidCredentialsException("Invalid or expired SSO state");
        }
        if (Instant.now().isAfter(entry.createdAt().plus(5, ChronoUnit.MINUTES))) {
            log.warn("SSO PKCE entry expired for state={}", request.getState());
            throw new InvalidCredentialsException("SSO session expired, please try again");
        }

        String userType = entry.userType();
        if ("student".equalsIgnoreCase(userType)) {
            return exchangeStudentCode(request.getCode(), entry.codeVerifier(), httpResponse);
        }
        return exchangeStaffCode(request.getCode(), entry.codeVerifier(), httpResponse);
    }

    // ─── Private helpers ────────────────────────────────────────────────────────

    private LoginResponse exchangeStudentCode(String code, String codeVerifier,
                                               HttpServletResponse httpResponse) {
        Map<String, String> body = Map.of("code", code, "clientId", clientId, "codeVerifier", codeVerifier);
        ResponseEntity<SsoStudentResponse> response = callIam(
                iamBaseUrl + studentExchangePath, body, SsoStudentResponse.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            log.warn("IAM student exchange failed: status={}", response.getStatusCode());
            throw new InvalidCredentialsException("SSO authentication failed");
        }

        SsoStudentResponse iam = response.getBody();
        UserDetails userDetails = buildUserDetails(iam.getLogin(), "ROLE_STUDENT");

        Map<String, Object> claims = new HashMap<>();
        claims.put("role", "STUDENT");
        claims.put("firstName", iam.getFirstName());
        claims.put("lastName", iam.getLastName());
        claims.put("site", iam.getSite());
        claims.put("sso", true);

        String accessToken = jwtService.generateToken(claims, userDetails);
        String refreshToken = jwtService.generateRefreshToken(userDetails);

        setAuthCookies(httpResponse, accessToken, refreshToken);

        log.info("SSO student login successful: login={}", iam.getLogin());
        return LoginResponse.builder()
                .firstName(iam.getFirstName())
                .lastName(iam.getLastName())
                .username(iam.getLogin())
                .role("STUDENT")
                .build();
    }

    private LoginResponse exchangeStaffCode(String code, String codeVerifier,
                                              HttpServletResponse httpResponse) {
        Map<String, String> body = Map.of("code", code, "clientId", clientId, "codeVerifier", codeVerifier);
        ResponseEntity<SsoStaffResponse> response = callIam(
                iamBaseUrl + staffExchangePath, body, SsoStaffResponse.class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            log.warn("IAM staff exchange failed: status={}", response.getStatusCode());
            throw new InvalidCredentialsException("SSO authentication failed");
        }

        SsoStaffResponse iam = response.getBody();
        String role = mapStaffRole(iam.getUserType());
        UserDetails userDetails = buildUserDetails(iam.getLogin(), "ROLE_" + role);

        String[] nameParts = splitDisplayName(iam.getDisplayName());
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", role);
        claims.put("sso", true);
        claims.put("userType", iam.getUserType());
        claims.put("firstName", nameParts[0]);
        claims.put("lastName", nameParts[1]);

        String accessToken = jwtService.generateToken(claims, userDetails);
        String refreshToken = jwtService.generateRefreshToken(userDetails);

        setAuthCookies(httpResponse, accessToken, refreshToken);
        log.info("SSO staff login successful: login={}, staffType={}", iam.getLogin(), iam.getUserType());
        return LoginResponse.builder()
                .firstName(nameParts[0])
                .lastName(nameParts[1])
                .username(iam.getLogin())
                .role(role)
                .build();
    }

    private <T> ResponseEntity<T> callIam(String url, Map<String, String> body, Class<T> responseType) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(body, headers), responseType);
    }

    private void setAuthCookies(HttpServletResponse response, String accessToken, String refreshToken) {
        Cookie accessCookie = new Cookie("accessToken", accessToken);
        accessCookie.setHttpOnly(true);
        accessCookie.setSecure(false);
        accessCookie.setPath("/");
        accessCookie.setMaxAge(24 * 60 * 60);

        Cookie refreshCookie = new Cookie("refreshToken", refreshToken);
        refreshCookie.setHttpOnly(true);
        refreshCookie.setSecure(false);
        refreshCookie.setPath("/");
        refreshCookie.setMaxAge(7 * 24 * 60 * 60);

        response.addCookie(accessCookie);
        response.addCookie(refreshCookie);
    }

    private String buildIamUrl(String path, String codeChallenge, String state) {
        return iamBaseUrl + path
                + "?client_id=" + encode(clientId)
                + "&redirect_uri=" + encode(redirectUri)
                + "&code_challenge=" + encode(codeChallenge)
                + "&code_challenge_method=S256"
                + "&state=" + encode(state);
    }

    private String generateCodeVerifier() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String generateCodeChallenge(String codeVerifier) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(codeVerifier.getBytes(StandardCharsets.US_ASCII));
            String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
            // IAM requires exactly 43 characters
            if (challenge.length() != 43) {
                throw new IllegalStateException("code_challenge length is " + challenge.length() + ", expected 43");
            }
            return challenge;
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private String generateState() {
        byte[] bytes = new byte[16];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private UserDetails buildUserDetails(String username, String role) {
        return User.builder()
                .username(username)
                .password("")
                .authorities(List.of(new SimpleGrantedAuthority(role)))
                .build();
    }

    private String mapStaffRole(String staffType) {
        if (staffType == null) return "INSTRUCTOR";
        return switch (staffType.toUpperCase()) {
            case "COLLABORATEUR", "INSTRUCTEUR", "FREELANCE" -> "INSTRUCTOR";
            default -> "INSTRUCTOR";
        };
    }

    private String[] splitDisplayName(String displayName) {
        if (displayName == null || displayName.isBlank()) return new String[]{"", ""};
        int space = displayName.indexOf(' ');
        if (space < 0) return new String[]{displayName, ""};
        return new String[]{displayName.substring(0, space), displayName.substring(space + 1)};
    }

    private void cleanExpiredEntries() {
        Instant cutoff = Instant.now().minus(5, ChronoUnit.MINUTES);
        pkceStore.entrySet().removeIf(e -> e.getValue().createdAt().isBefore(cutoff));
    }

    // ─── Inner record ────────────────────────────────────────────────────────────

    private record SsoPkceEntry(String codeVerifier, String userType, Instant createdAt) {}
}
