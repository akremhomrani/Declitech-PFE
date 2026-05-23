package com.declitech.auth.service;

import com.declitech.auth.client.UserServiceClient;
import com.declitech.auth.dto.LoginRequest;
import com.declitech.auth.dto.LoginResponse;
import com.declitech.auth.dto.ModuleAssignmentDto;
import com.declitech.auth.dto.TokenResponse;
import com.declitech.auth.dto.UserDto;
import com.declitech.auth.exception.InvalidCredentialsException;
import com.declitech.auth.exception.InvalidTokenException;
import com.declitech.auth.exception.UserInactiveException;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final JwtService jwtService;
    private final UserServiceClient userServiceClient;

    public LoginResponse login(LoginRequest request) {
        if (request == null) {
            throw new InvalidCredentialsException("Login request cannot be null");
        }
        if (request.getUsernameOrEmail() == null || request.getUsernameOrEmail().trim().isEmpty()) {
            throw new InvalidCredentialsException("Username or email is required");
        }
        if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            throw new InvalidCredentialsException("Password is required");
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            request.getUsernameOrEmail(),
                            request.getPassword()
                    )
            );

            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            UserDto user = fetchUserByUsernameOrEmail(request.getUsernameOrEmail());

            if (user == null) {
                throw new InvalidCredentialsException("User not found: " + request.getUsernameOrEmail());
            }

            if (!user.getActive()) {
                throw new UserInactiveException("User account is inactive: " + user.getUsername());
            }

            Map<String, Object> extraClaims = buildIamClaims(user);

            String accessToken = jwtService.generateToken(extraClaims, userDetails);
            String refreshToken = jwtService.generateRefreshToken(userDetails);

            if (accessToken == null || accessToken.isEmpty()) {
                throw new InvalidCredentialsException("Failed to generate access token");
            }
            if (refreshToken == null || refreshToken.isEmpty()) {
                throw new InvalidCredentialsException("Failed to generate refresh token");
            }

            return LoginResponse.builder()
                    .accessToken(accessToken)
                    .refreshToken(refreshToken)
                    .firstName(user.getFirstName())
                    .lastName(user.getLastName())
                    .username(user.getUsername())
                    .role(user.getRole())
                    .build();

        } catch (BadCredentialsException e) {
            throw new InvalidCredentialsException("Invalid username or password for: " + request.getUsernameOrEmail());
        } catch (UserInactiveException e) {
            throw e;
        } catch (Exception e) {
            throw new InvalidCredentialsException("Authentication failed for user: " + request.getUsernameOrEmail() + ". Error: " + e.getMessage());
        }
    }

    public TokenResponse refreshToken(String refreshToken) {
        if (refreshToken == null || refreshToken.trim().isEmpty()) {
            throw new InvalidTokenException("Refresh token cannot be null or empty");
        }

        try {
            String username = jwtService.extractUsername(refreshToken);

            if (username == null || username.trim().isEmpty()) {
                throw new InvalidTokenException("Invalid refresh token: unable to extract username");
            }

            UserDetails userDetails = userDetailsService.loadUserByUsername(username);

            if (userDetails == null) {
                throw new InvalidTokenException("User not found for username: " + username);
            }

            if (!jwtService.isTokenValid(refreshToken, userDetails)) {
                throw new InvalidTokenException("Invalid or expired refresh token for user: " + username);
            }

            UserDto user = fetchUserByUsernameOrEmail(username);
            if (user == null) {
                throw new InvalidTokenException("User not found: " + username);
            }

            Map<String, Object> extraClaims = buildIamClaims(user);

            String newAccessToken = jwtService.generateToken(extraClaims, userDetails);
            String newRefreshToken = jwtService.generateRefreshToken(userDetails);

            if (newAccessToken == null || newAccessToken.isEmpty()) {
                throw new InvalidTokenException("Failed to generate new access token for user: " + username);
            }
            if (newRefreshToken == null || newRefreshToken.isEmpty()) {
                throw new InvalidTokenException("Failed to generate new refresh token for user: " + username);
            }

            return TokenResponse.builder()
                    .accessToken(newAccessToken)
                    .refreshToken(newRefreshToken)
                    .tokenType("Bearer")
                    .expiresIn(jwtService.getExpirationTime())
                    .build();

        } catch (InvalidTokenException e) {
            throw e;
        } catch (Exception e) {
            throw new InvalidTokenException("Failed to refresh token. Error: " + e.getMessage());
        }
    }

    public boolean validateToken(String token) {
        if (token == null || token.trim().isEmpty()) {
            return false;
        }

        try {
            String username = jwtService.extractUsername(token);
            if (username == null || username.trim().isEmpty()) {
                return false;
            }
            
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            if (userDetails == null) {
                return false;
            }

            return jwtService.isTokenValid(token, userDetails);
        } catch (Exception e) {
            return false;
        }
    }

    public String extractRoleFromToken(String token) {
        try {
            return jwtService.extractClaim(token, claims -> claims.get("role", String.class));
        } catch (Exception e) {
            return null;
        }
    }

    private Map<String, Object> buildIamClaims(UserDto user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", user.getId());
        claims.put("role", user.getRole());
        claims.put("email", user.getEmail());
        claims.put("username", user.getUsername());
        claims.put("firstName", user.getFirstName());
        claims.put("lastName", user.getLastName());

        String userType = mapRoleToUserType(user.getRole());
        if (userType != null) {
            claims.put("userType", userType);
        }

        if (isStaff(userType)) {
            Map<String, List<String>> apps = new HashMap<>();
            apps.put("declitrack", List.of("create_session"));
            claims.put("apps", apps);
        }

        if (isInstructorLike(userType)) {
            claims.put("siteModules", buildSiteModules(user.getModuleAssignments()));
        }

        return claims;
    }

    private String mapRoleToUserType(String role) {
        if (role == null) return null;
        return switch (role.toUpperCase()) {
            case "INSTRUCTEUR" -> "INSTRUCTEUR";
            case "FREELANCER", "FREELANCE" -> "FREELANCE";
            case "ADMIN" -> "COLLABORATEUR";
            case "STUDENT", "PARENT" -> role.toUpperCase();
            default -> role.toUpperCase();
        };
    }

    private boolean isStaff(String userType) {
        return "INSTRUCTEUR".equals(userType)
                || "FREELANCE".equals(userType)
                || "COLLABORATEUR".equals(userType);
    }

    private boolean isInstructorLike(String userType) {
        return "INSTRUCTEUR".equals(userType) || "FREELANCE".equals(userType);
    }

    private List<Map<String, Object>> buildSiteModules(List<ModuleAssignmentDto> assignments) {
        if (assignments == null || assignments.isEmpty()) return Collections.emptyList();
        List<Map<String, Object>> out = new ArrayList<>(assignments.size());
        for (ModuleAssignmentDto a : assignments) {
            Map<String, Object> entry = new HashMap<>();
            entry.put("moduleId", a.getModuleId());
            entry.put("siteName", a.getSiteName());
            out.add(entry);
        }
        return out;
    }

    private UserDto fetchUserByUsernameOrEmail(String usernameOrEmail) {
        if (usernameOrEmail == null || usernameOrEmail.trim().isEmpty()) {
            throw new InvalidCredentialsException("Username or email cannot be empty");
        }

        try {
            if (!usernameOrEmail.contains("@")) {
                return userServiceClient.getUserByUsername(usernameOrEmail);
            } else {
                return userServiceClient.getUserByEmail(usernameOrEmail);
            }
        } catch (FeignException.NotFound e) {
            throw new InvalidCredentialsException("User not found: " + usernameOrEmail);
        } catch (FeignException.ServiceUnavailable e) {
            throw new InvalidCredentialsException("User service is unavailable. Please try again later.");
        } catch (FeignException e) {
            throw new InvalidCredentialsException("Error communicating with user service: " + e.getMessage());
        } catch (Exception e) {
            throw new InvalidCredentialsException("Error fetching user details for: " + usernameOrEmail + ". Error: " + e.getMessage());
        }
    }
}
