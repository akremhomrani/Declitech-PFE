package com.declitech.session.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;

@Component
@Slf4j
public class JwtTokenProvider {

    @Value("${jwt.secret:ZGVjbGl0ZWNoLXNlY3VyZS1rZXktZm9yLWp3dC10b2tlbi1nZW5lcmF0aW9uLTIwMjYtdmVyeS1zZWN1cmUtY2hhbmdlLWluLXByb2R1Y3Rpb24=}")
    private String jwtSecret;

    /**
     * Get the signing key by BASE64 decoding the secret and using Keys.hmacShaKeyFor()
     * This matches the approach used in auth-service
     */
    private SecretKey getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(jwtSecret);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * Extract user ID from JWT token
     * Tries multiple claim names: userId, id, or subject
     */
    public Long extractUserIdFromToken(String token) {
        try {
            // Remove "Bearer " prefix if present
            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            log.debug("Extracting user ID from token with secret length: {}", jwtSecret.length());

            Claims claims = Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            // Try userId claim first
            Object userId = claims.get("userId");
            if (userId != null) {
                log.info("Found userId claim: {}", userId);
                return Long.parseLong(userId.toString());
            }

            // Try id claim
            Object id = claims.get("id");
            if (id != null) {
                log.info("Found id claim: {}", id);
                return Long.parseLong(id.toString());
            }

            // Try subject as fallback
            String sub = claims.getSubject();
            if (sub != null && !sub.isEmpty()) {
                log.info("Using subject as user ID: {}", sub);
                try {
                    return Long.parseLong(sub);
                } catch (NumberFormatException e) {
                    log.warn("Subject is not a number, cannot convert to Long: {}", sub);
                }
            }

            log.warn("Could not extract user ID from token claims. Available claims: {}", claims.keySet());
            return null;

        } catch (Exception e) {
            log.error("Error extracting user ID from token: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Extract username/subject from JWT token
     */
    public String extractUsernameFromToken(String token) {
        try {
            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            Claims claims = Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            // Try username claim first
            Object username = claims.get("username");
            if (username != null) {
                return username.toString();
            }

            // Try subject as fallback
            String sub = claims.getSubject();
            if (sub != null && !sub.isEmpty()) {
                return sub;
            }

            log.warn("Could not extract username from token");
            return null;

        } catch (Exception e) {
            log.error("Error extracting username from token: {}", e.getMessage(), e);
            return null;
        }
    }
}
