package com.declitech.session.service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Date;

@Service
public class SessionTokenService {

    @Value("${jwt.secret}")
    private String jwtSecret;

    private SecretKey getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(jwtSecret);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * Issues a short-lived JWT scoped to a single session.
     * Claims: type=session, sessionId, sessionCode — no role, no account.
     * Expires when the session itself expires.
     */
    public String issueSessionToken(Long sessionId, String sessionCode,
                                    String studentLoginIdentity, LocalDateTime expiresAt) {
        Date expiry = Date.from(expiresAt.toInstant(ZoneOffset.UTC));
        return Jwts.builder()
                .subject(studentLoginIdentity)
                .claim("type", "session")
                .claim("sessionId", sessionId)
                .claim("sessionCode", sessionCode)
                .issuedAt(new Date())
                .expiration(expiry)
                .signWith(getSigningKey())
                .compact();
    }
}
