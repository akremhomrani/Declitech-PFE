package com.declitech.session.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;

@Component
public class JwtTokenProvider {

    @Value("${jwt.secret:ZGVjbGl0ZWNoLXNlY3VyZS1rZXktZm9yLWp3dC10b2tlbi1nZW5lcmF0aW9uLTIwMjYtdmVyeS1zZWN1cmUtY2hhbmdlLWluLXByb2R1Y3Rpb24=}")
    private String jwtSecret;

    private SecretKey getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(jwtSecret);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public Long extractUserIdFromToken(String token) {
        try {
            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            Claims claims = Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            Object userId = claims.get("userId");
            if (userId != null) {
                return Long.parseLong(userId.toString());
            }

            Object id = claims.get("id");
            if (id != null) {
                return Long.parseLong(id.toString());
            }

            String sub = claims.getSubject();
            if (sub != null && !sub.isEmpty()) {
                try {
                    return Long.parseLong(sub);
                } catch (NumberFormatException e) {
                }
            }

            return null;

        } catch (Exception e) {
            return null;
        }
    }

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

            Object username = claims.get("username");
            if (username != null) {
                return username.toString();
            }

            String sub = claims.getSubject();
            if (sub != null && !sub.isEmpty()) {
                return sub;
            }

            return null;

        } catch (Exception e) {
            return null;
        }
    }
}
