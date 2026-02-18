package com.declitech.module.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String jwtSecret;

    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public Long extractUserId(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            
            return claims.get("userId", Long.class);
        } catch (Exception e) {
            return null;
        }
    }

    public Long extractUserIdWithoutValidation(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) {
                return null;
            }
            
            String payload = new String(java.util.Base64.getUrlDecoder().decode(parts[1]));
            
            if (payload.contains("\"userId\"")) {
                int userIdStart = payload.indexOf("\"userId\":") + 9;
                int userIdEnd = payload.indexOf(",", userIdStart);
                if (userIdEnd == -1) {
                    userIdEnd = payload.indexOf("}", userIdStart);
                }
                String userIdStr = payload.substring(userIdStart, userIdEnd).trim();
                return Long.parseLong(userIdStr);
            }
            
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    public String extractUsername(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            
            return claims.getSubject();
        } catch (Exception e) {
            return null;
        }
    }

    public String extractRole(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            
            return claims.get("role", String.class);
        } catch (Exception e) {
            return null;
        }
    }

    public String extractEmail(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            
            Object email = claims.get("email");
            return email != null ? email.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
