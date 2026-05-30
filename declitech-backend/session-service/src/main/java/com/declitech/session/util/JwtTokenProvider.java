package com.declitech.session.util;

import com.declitech.session.dto.SiteModuleDto;
import com.declitech.session.security.IamJwtVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Reads claims from IAM-issued JWTs (RS256, verified via {@link IamJwtVerifier}).
 *
 * <p>Internal session tokens issued by {@code SessionTokenService} are HS256 and have
 * a separate code path — they are not handled here.
 */
@Component
public class JwtTokenProvider {

    private final IamJwtVerifier iamJwtVerifier;

    public JwtTokenProvider(IamJwtVerifier iamJwtVerifier) {
        this.iamJwtVerifier = iamJwtVerifier;
    }

    public String extractFirstName(String token) {
        return extractStringClaim(token, "firstName");
    }

    public String extractLastName(String token) {
        return extractStringClaim(token, "lastName");
    }

    /**
     * IAM v6 enriched JWT — userType claim (STUDENT / INSTRUCTEUR / COLLABORATEUR / FREELANCE / PARENT).
     */
    public String extractUserType(String token) {
        return extractStringClaim(token, "userType");
    }

    /**
     * IAM v6 enriched JWT — extract the feature list embedded in apps[appSlug].
     * Returns the empty list if the slug is missing or the user has no DecliTrack access.
     * The slug should be the catalog slug (`declitrack`), NEVER the SSO client_id (which may be
     * suffixed `-staging`/`-prod`) — see INTEGRATION_SSO §Bug fix v6.
     */
    public List<String> extractAppFeatures(String token, String appSlug) {
        JWTClaimsSet claims = verifyOrNull(token);
        if (claims == null) return Collections.emptyList();

        Object apps = claims.getClaim("apps");
        if (!(apps instanceof Map<?, ?> appsMap)) return Collections.emptyList();

        Object features = appsMap.get(appSlug);
        if (!(features instanceof List<?> list)) return Collections.emptyList();

        List<String> result = new ArrayList<>(list.size());
        for (Object f : list) {
            if (f != null) result.add(f.toString());
        }
        return result;
    }

    public boolean isStaff(String token) {
        String userType = extractUserType(token);
        return "INSTRUCTEUR".equalsIgnoreCase(userType)
                || "FREELANCE".equalsIgnoreCase(userType)
                || "COLLABORATEUR".equalsIgnoreCase(userType);
    }

    /**
     * IAM v6 — claim {@code site} (chaîne libre, COLLABORATEUR uniquement).
     * Renvoie {@code null} si claim absent ou token invalide.
     */
    public String extractSite(String token) {
        return extractStringClaim(token, "site");
    }

    /**
     * IAM v6 — claim {@code siteModules} (INSTRUCTEUR / FREELANCE).
     * <p>
     * Liste d'affectations site/module embarquée dans le JWT — évite l'appel à
     * {@code /api/v1/public/sync/staff} à chaque login. Renvoie liste vide si claim
     * absent, vide, ou token illisible (jamais d'exception).
     */
    public List<SiteModuleDto> extractSiteModules(String token) {
        JWTClaimsSet claims = verifyOrNull(token);
        if (claims == null) return Collections.emptyList();

        Object raw = claims.getClaim("siteModules");
        if (!(raw instanceof List<?> arr)) return Collections.emptyList();

        List<SiteModuleDto> out = new ArrayList<>(arr.size());
        for (Object node : arr) {
            if (!(node instanceof Map<?, ?> entry)) continue;
            SiteModuleDto sm = new SiteModuleDto();
            sm.setSiteId(parseLong(entry.get("siteId")));
            sm.setSiteName(asStringOrNull(entry.get("siteName")));
            sm.setModuleId(parseLong(entry.get("moduleId")));
            sm.setModuleName(asStringOrNull(entry.get("moduleName")));
            sm.setModuleCode(asStringOrNull(entry.get("moduleCode")));
            out.add(sm);
        }
        return out;
    }

    /**
     * Cherche dans {@code siteModules} le slot dont {@code moduleId} correspond — utilisé
     * par {@code SessionController.createSession} pour valider qu'un instructeur ne crée pas
     * une session sur un module qui ne lui est pas affecté.
     */
    public Optional<SiteModuleDto> findSiteModule(String token, Long moduleId) {
        if (moduleId == null) return Optional.empty();
        return extractSiteModules(token).stream()
                .filter(sm -> moduleId.equals(sm.getModuleId()))
                .findFirst();
    }

    public String extractUsernameFromToken(String token) {
        JWTClaimsSet claims = verifyOrNull(token);
        if (claims == null) return null;

        Object username = claims.getClaim("username");
        if (username != null) return username.toString();

        String sub = claims.getSubject();
        if (sub != null && !sub.isEmpty()) return sub;

        Object login = claims.getClaim("login");
        return login != null ? login.toString() : null;
    }

    private String extractStringClaim(String token, String claim) {
        JWTClaimsSet claims = verifyOrNull(token);
        if (claims == null) return null;
        Object value = claims.getClaim(claim);
        return value != null ? value.toString() : null;
    }

    private JWTClaimsSet verifyOrNull(String token) {
        try {
            return iamJwtVerifier.verify(token);
        } catch (Exception e) {
            return null;
        }
    }

    private static Long parseLong(Object value) {
        if (value == null) return null;
        if (value instanceof Number num) return num.longValue();
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String asStringOrNull(Object value) {
        return value != null ? value.toString() : null;
    }
}
