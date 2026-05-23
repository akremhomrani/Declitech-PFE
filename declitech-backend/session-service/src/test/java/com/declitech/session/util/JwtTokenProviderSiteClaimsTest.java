package com.declitech.session.util;

import com.declitech.session.dto.SiteModuleDto;
import com.declitech.session.security.IamJwtVerifier;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Date;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("JwtTokenProvider — claims siteModules / site (IAM v7 RS256)")
class JwtTokenProviderSiteClaimsTest {

    private static final String KID = "iam-rs256-test";
    private static RSAKey rsaJwk;
    private static IamJwtVerifier verifier;

    private JwtTokenProvider provider;

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

    @BeforeEach
    void setUp() {
        provider = new JwtTokenProvider(verifier);
    }

    private String buildToken(Map<String, Object> claims) throws JOSEException {
        JWTClaimsSet.Builder builder = new JWTClaimsSet.Builder()
                .subject((String) claims.getOrDefault("sub", "tester"))
                .issueTime(new Date())
                .expirationTime(new Date(System.currentTimeMillis() + 3_600_000));
        claims.forEach((k, v) -> {
            if (!"sub".equals(k)) builder.claim(k, v);
        });
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(KID).build(),
                builder.build());
        jwt.sign(new RSASSASigner(rsaJwk));
        return jwt.serialize();
    }

    // ---- siteModules (INSTRUCTEUR / FREELANCE) ------------------------------

    @Test
    @DisplayName("extractSiteModules — INSTRUCTEUR avec 2 affectations → 2 SiteModuleDto bien typés")
    void extractSiteModules_instructeurWithTwoSlots_returnsBothTyped() throws Exception {
        String token = buildToken(Map.of(
                "sub", "antoine.bernard",
                "userType", "INSTRUCTEUR",
                "siteModules", List.of(
                        Map.of("siteId", 1, "siteName", "Ariana Ville",
                                "moduleId", 10, "moduleName", "Algorithmique", "moduleCode", "ALGO"),
                        Map.of("siteId", 2, "siteName", "Bab Saadoun",
                                "moduleId", 10, "moduleName", "Algorithmique", "moduleCode", "ALGO")
                )
        ));

        List<SiteModuleDto> slots = provider.extractSiteModules(token);

        assertThat(slots).hasSize(2);
        assertThat(slots.get(0).getSiteId()).isEqualTo(1L);
        assertThat(slots.get(0).getSiteName()).isEqualTo("Ariana Ville");
        assertThat(slots.get(0).getModuleId()).isEqualTo(10L);
        assertThat(slots.get(0).getModuleCode()).isEqualTo("ALGO");
        assertThat(slots.get(1).getSiteId()).isEqualTo(2L);
    }

    @Test
    @DisplayName("extractSiteModules — claim absent → liste vide (instructeur sans affectation)")
    void extractSiteModules_claimAbsent_returnsEmpty() throws Exception {
        String token = buildToken(Map.of(
                "sub", "valentin.vilain",
                "userType", "INSTRUCTEUR"
        ));

        assertThat(provider.extractSiteModules(token)).isEmpty();
    }

    @Test
    @DisplayName("extractSiteModules — claim vide [] → liste vide")
    void extractSiteModules_claimEmpty_returnsEmpty() throws Exception {
        String token = buildToken(Map.of(
                "sub", "x.y",
                "userType", "FREELANCE",
                "siteModules", List.of()
        ));

        assertThat(provider.extractSiteModules(token)).isEmpty();
    }

    @Test
    @DisplayName("extractSiteModules — token null → liste vide (pas d'exception)")
    void extractSiteModules_nullToken_returnsEmpty() {
        assertThat(provider.extractSiteModules(null)).isEmpty();
    }

    @Test
    @DisplayName("extractSiteModules — entrée siteId/moduleId au format Long → Number→Long OK")
    void extractSiteModules_longIds_areCoercedSafely() throws Exception {
        String token = buildToken(Map.of(
                "sub", "a.b",
                "userType", "INSTRUCTEUR",
                "siteModules", List.of(
                        Map.of("siteId", 9_999_999_999L, "siteName", "Big",
                                "moduleId", 8_888_888_888L, "moduleName", "M", "moduleCode", "M")
                )
        ));

        SiteModuleDto sm = provider.extractSiteModules(token).get(0);
        assertThat(sm.getSiteId()).isEqualTo(9_999_999_999L);
        assertThat(sm.getModuleId()).isEqualTo(8_888_888_888L);
    }

    // ---- site (COLLABORATEUR) -----------------------------------------------

    @Test
    @DisplayName("extractSite — COLLABORATEUR avec site renseigné → string")
    void extractSite_collaborateurWithSite_returnsString() throws Exception {
        String token = buildToken(Map.of(
                "sub", "y.chaabane",
                "userType", "COLLABORATEUR",
                "site", "Tunis"
        ));

        assertThat(provider.extractSite(token)).isEqualTo("Tunis");
    }

    @Test
    @DisplayName("extractSite — claim absent → null")
    void extractSite_claimAbsent_returnsNull() throws Exception {
        String token = buildToken(Map.of(
                "sub", "noone",
                "userType", "COLLABORATEUR"
        ));

        assertThat(provider.extractSite(token)).isNull();
    }

    @Test
    @DisplayName("extractSite — token invalide → null (pas d'exception)")
    void extractSite_invalidToken_returnsNull() {
        assertThat(provider.extractSite("not.a.jwt")).isNull();
        assertThat(provider.extractSite(null)).isNull();
    }

    // ---- helper findSiteModule (lookup par moduleId) -------------------------

    @Test
    @DisplayName("findSiteModule — match par moduleId")
    void findSiteModule_matchesByModuleId() throws Exception {
        String token = buildToken(Map.of(
                "sub", "a", "userType", "INSTRUCTEUR",
                "siteModules", List.of(
                        Map.of("siteId", 1, "siteName", "S1",
                                "moduleId", 10, "moduleName", "M1", "moduleCode", "C1"),
                        Map.of("siteId", 2, "siteName", "S2",
                                "moduleId", 20, "moduleName", "M2", "moduleCode", "C2")
                )
        ));

        assertThat(provider.findSiteModule(token, 20L))
                .isPresent()
                .get()
                .extracting(SiteModuleDto::getSiteName, SiteModuleDto::getModuleCode)
                .containsExactly("S2", "C2");
    }

    @Test
    @DisplayName("findSiteModule — moduleId hors slots → empty")
    void findSiteModule_unknownModule_returnsEmpty() throws Exception {
        String token = buildToken(Map.of(
                "sub", "a", "userType", "INSTRUCTEUR",
                "siteModules", List.of(
                        Map.of("siteId", 1, "siteName", "S1",
                                "moduleId", 10, "moduleName", "M1", "moduleCode", "C1")
                )
        ));

        assertThat(provider.findSiteModule(token, 999L)).isEmpty();
    }

    @Test
    @DisplayName("findSiteModule — moduleId null → empty")
    void findSiteModule_nullModuleId_returnsEmpty() throws Exception {
        String token = buildToken(Map.of("sub", "a"));
        assertThat(provider.findSiteModule(token, null)).isEmpty();
    }
}
