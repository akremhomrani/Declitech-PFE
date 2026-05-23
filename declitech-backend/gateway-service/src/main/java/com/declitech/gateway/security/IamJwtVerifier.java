package com.declitech.gateway.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.JWKSourceBuilder;
import com.nimbusds.jose.proc.BadJOSEException;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.ConfigurableJWTProcessor;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.MalformedURLException;
import java.net.URL;
import java.text.ParseException;

/**
 * Verifies IAM-issued JWT tokens with RS256 using the public key fetched from
 * the IAM JWKS endpoint (since IAM v7 — 2026-05-08).
 *
 * <p>The previous shared-secret HS256 verification (JWT_ADMIN_SECRET) is gone:
 * IAM keeps the RSA private key, apps verify with the rotating public key only.
 * See {@code docs/INTEGRATION_SSO.md} §"Verification de signature JWT — RS256 + JWKS".
 */
@Component
public class IamJwtVerifier {

    private final ConfigurableJWTProcessor<SecurityContext> jwtProcessor;

    @Autowired
    public IamJwtVerifier(@Value("${iam.jwks-url}") String jwksUrl) throws MalformedURLException {
        this(buildJwkSource(jwksUrl));
    }

    /** Constructor for tests — pass an in-memory {@link JWKSource}. */
    public IamJwtVerifier(JWKSource<SecurityContext> jwkSource) {
        DefaultJWTProcessor<SecurityContext> processor = new DefaultJWTProcessor<>();
        processor.setJWSKeySelector(new JWSVerificationKeySelector<>(JWSAlgorithm.RS256, jwkSource));
        this.jwtProcessor = processor;
    }

    public JWTClaimsSet verify(String token) throws BadJOSEException, JOSEException, ParseException {
        return jwtProcessor.process(stripBearer(token), null);
    }

    private static JWKSource<SecurityContext> buildJwkSource(String jwksUrl) throws MalformedURLException {
        return JWKSourceBuilder.<SecurityContext>create(new URL(jwksUrl))
                .retrying(true)
                .build();
    }

    private static String stripBearer(String token) {
        if (token == null) return null;
        return token.startsWith("Bearer ") ? token.substring(7) : token;
    }
}
