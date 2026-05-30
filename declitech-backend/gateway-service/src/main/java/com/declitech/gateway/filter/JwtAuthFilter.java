package com.declitech.gateway.filter;

import com.declitech.gateway.security.IamJwtVerifier;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.SignedJWT;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.text.ParseException;
import java.util.Base64;
import java.util.Date;
import java.util.List;

/**
 * Global JWT validation filter.
 * Public paths bypass. Other paths require a valid token in the accessToken cookie or Authorization header.
 * Supports both RS256 IAM tokens (verified via JWKS) and HS* tokens signed with the shared {@code jwt.secret}
 * (issued by the local auth-service).
 */
@Slf4j
@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    private static final List<String> PUBLIC_PATHS = List.of(
            "/api/auth/",
            "/mock/",
            "/api/sessions/join/",
            "/api/reports/track",
            "/api/agent/",
            "/api/alerts/",
            "/actuator/"
    );

    private final IamJwtVerifier iamJwtVerifier;
    private final byte[] hmacSecret;

    public JwtAuthFilter(IamJwtVerifier iamJwtVerifier,
                         @Value("${jwt.secret}") String jwtSecret) {
        this.iamJwtVerifier = iamJwtVerifier;
        this.hmacSecret = Base64.getDecoder().decode(jwtSecret);
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();

        if (request.getMethod() == HttpMethod.OPTIONS) {
            return chain.filter(exchange);
        }

        if (isPublic(path)) {
            if (path.startsWith("/api/sessions/join/")) {
                log.info("Unauthenticated session join attempt path={} clientIp={}", path, clientIp(request));
            }
            return chain.filter(exchange);
        }

        String token = extractToken(request);
        if (token == null) {
            return writeUnauthorized(exchange, "Authentication required");
        }

        if (!isValid(token)) {
            return writeUnauthorized(exchange, "Invalid or expired token");
        }
        ServerWebExchange mutated = exchange.mutate()
                .request(r -> r.headers(h -> h.set("Authorization", "Bearer " + token)))
                .build();
        return chain.filter(mutated);
    }

    private boolean isValid(String token) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            String alg = jwt.getHeader().getAlgorithm().getName();
            if (alg.startsWith("HS")) {
                JWSVerifier verifier = new MACVerifier(hmacSecret);
                if (!jwt.verify(verifier)) return false;
                Date exp = jwt.getJWTClaimsSet().getExpirationTime();
                return exp == null || exp.after(new Date());
            }
            iamJwtVerifier.verify(token);
            return true;
        } catch (ParseException e) {
            log.warn("Malformed JWT: {}", e.getMessage());
            return false;
        } catch (Exception e) {
            log.warn("JWT verification failed: {}", e.getMessage());
            return false;
        }
    }

    private String clientIp(ServerHttpRequest request) {
        String forwarded = request.getHeaders().getFirst("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddress() != null
                ? request.getRemoteAddress().getAddress().getHostAddress()
                : "unknown";
    }

    private boolean isPublic(String path) {
        return PUBLIC_PATHS.stream().anyMatch(path::startsWith);
    }

    private String extractToken(ServerHttpRequest request) {
        var cookie = request.getCookies().getFirst("accessToken");
        if (cookie != null && !cookie.getValue().isBlank()) {
            return cookie.getValue();
        }
        String auth = request.getHeaders().getFirst("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            return auth.substring(7);
        }
        return null;
    }

    private Mono<Void> writeUnauthorized(ServerWebExchange exchange, String message) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().add("Content-Type", "application/json");
        byte[] bytes = ("{\"error\":\"" + message + "\"}").getBytes();
        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(bytes);
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        return -100;
    }
}
