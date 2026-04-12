package com.declitech.gateway.filter;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
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

import java.security.Key;
import java.util.List;

/**
 * Global JWT validation filter.
 * Runs before every request. Public paths bypass JWT check.
 * All other paths require a valid JWT in the accessToken cookie or Authorization header.
 */
@Slf4j
@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    /**
     * Paths that do NOT require authentication.
     * Order matters: more specific paths first.
     */
    private static final List<String> PUBLIC_PATHS = List.of(
            "/api/auth/",         // login, SSO, refresh, logout
            "/mock/",             // Mock IAM popup
            "/api/alerts/",       // SSE stream + publish (EventSource + extension)
            "/api/reports/track", // Python agent POST
            "/actuator/"          // health checks
    );

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();

        // Always allow preflight requests
        if (request.getMethod() == HttpMethod.OPTIONS) {
            return chain.filter(exchange);
        }

        // Allow public paths without JWT
        if (isPublic(path)) {
            return chain.filter(exchange);
        }

        // Extract token — cookie first, then Authorization header
        String token = extractToken(request);

        if (token == null) {
            log.warn("No JWT found for protected path: {}", path);
            return writeUnauthorized(exchange, "Authentication required");
        }

        try {
            validateToken(token);
            return chain.filter(exchange);
        } catch (Exception e) {
            log.warn("Invalid JWT on path {}: {}", path, e.getMessage());
            return writeUnauthorized(exchange, "Invalid or expired token");
        }
    }

    private boolean isPublic(String path) {
        return PUBLIC_PATHS.stream().anyMatch(path::startsWith);
    }

    private String extractToken(ServerHttpRequest request) {
        // 1. Cookie (browser SSO flow)
        var cookie = request.getCookies().getFirst("accessToken");
        if (cookie != null && !cookie.getValue().isBlank()) {
            return cookie.getValue();
        }
        // 2. Authorization header (API clients, extension)
        String auth = request.getHeaders().getFirst("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            return auth.substring(7);
        }
        return null;
    }

    private void validateToken(String token) {
        Key key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(jwtSecret));
        Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
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
        return -100; // Run before GatewaySecretFilter
    }
}
