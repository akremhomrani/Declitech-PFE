package com.declitech.session.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.proc.BadJOSEException;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("IamJwtVerifier — RS256 + JWKS verification (IAM v7, 2026-05-08)")
class IamJwtVerifierTest {

    private static final String KID = "iam-rs256-test";
    private static RSAKey rsaJwk;
    private static IamJwtVerifier verifier;

    @BeforeAll
    static void setupKeys() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
        gen.initialize(2048);
        KeyPair kp = gen.generateKeyPair();
        rsaJwk = new RSAKey.Builder((RSAPublicKey) kp.getPublic())
                .privateKey((RSAPrivateKey) kp.getPrivate())
                .keyID(KID)
                .build();
        verifier = new IamJwtVerifier(new ImmutableJWKSet<>(new JWKSet(rsaJwk.toPublicJWK())));
    }

    private String signRs256(JWTClaimsSet claims, String kid) throws JOSEException {
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(kid).build(),
                claims);
        jwt.sign(new RSASSASigner(rsaJwk));
        return jwt.serialize();
    }

    private JWTClaimsSet validClaims() {
        return new JWTClaimsSet.Builder()
                .subject("100001")
                .issueTime(new Date())
                .expirationTime(new Date(System.currentTimeMillis() + 60_000))
                .jwtID(UUID.randomUUID().toString())
                .claim("userType", "STUDENT")
                .build();
    }

    @Test
    @DisplayName("verify — RS256 signé avec la bonne clé → claims OK")
    void verify_validRs256Token_returnsClaims() throws Exception {
        String token = signRs256(validClaims(), KID);

        JWTClaimsSet claims = verifier.verify(token);

        assertThat(claims.getSubject()).isEqualTo("100001");
        assertThat(claims.getStringClaim("userType")).isEqualTo("STUDENT");
    }

    @Test
    @DisplayName("verify — accepte le préfixe 'Bearer '")
    void verify_stripsBearerPrefix() throws Exception {
        String token = "Bearer " + signRs256(validClaims(), KID);

        JWTClaimsSet claims = verifier.verify(token);

        assertThat(claims.getSubject()).isEqualTo("100001");
    }

    @Test
    @DisplayName("verify — token expiré → rejet")
    void verify_expiredToken_throws() throws Exception {
        JWTClaimsSet expired = new JWTClaimsSet.Builder()
                .subject("100001")
                .issueTime(new Date(System.currentTimeMillis() - 7200_000))
                .expirationTime(new Date(System.currentTimeMillis() - 60_000))
                .build();
        String token = signRs256(expired, KID);

        assertThatThrownBy(() -> verifier.verify(token))
                .isInstanceOf(BadJOSEException.class);
    }

    @Test
    @DisplayName("verify — token signé HS256 (legacy) → rejet (pas dans la liste d'algos autorisés)")
    void verify_hs256Token_throws() throws Exception {
        byte[] secret = new byte[64];
        new java.security.SecureRandom().nextBytes(secret);
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.HS256).keyID(KID).build(),
                validClaims());
        jwt.sign(new MACSigner(secret));
        String token = jwt.serialize();

        assertThatThrownBy(() -> verifier.verify(token))
                .isInstanceOf(BadJOSEException.class);
    }

    @Test
    @DisplayName("verify — kid inconnu (clé absente du JWKS) → rejet")
    void verify_unknownKid_throws() throws Exception {
        String token = signRs256(validClaims(), "wrong-kid");

        assertThatThrownBy(() -> verifier.verify(token))
                .isInstanceOf(BadJOSEException.class);
    }

    @Test
    @DisplayName("verify — payload modifié après signature → rejet")
    void verify_tamperedPayload_throws() throws Exception {
        String token = signRs256(validClaims(), KID);
        String[] parts = token.split("\\.");
        // Replace payload with a different (valid base64url) payload — signature won't match
        String fakePayload = java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"sub\":\"999\",\"exp\":9999999999}".getBytes());
        String tampered = parts[0] + "." + fakePayload + "." + parts[2];

        assertThatThrownBy(() -> verifier.verify(tampered))
                .isInstanceOf(BadJOSEException.class);
    }

    @Test
    @DisplayName("verify — token malformé → ParseException")
    void verify_malformedToken_throws() {
        assertThatThrownBy(() -> verifier.verify("not.a.jwt.at.all"))
                .isInstanceOf(java.text.ParseException.class);
    }
}
