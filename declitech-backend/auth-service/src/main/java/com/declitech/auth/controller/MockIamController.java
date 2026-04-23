package com.declitech.auth.controller;

import com.declitech.auth.dto.SsoStaffResponse;
import com.declitech.auth.dto.SsoStudentResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Mock IAM local — simule le serveur IAM DecliTech pour les tests en développement.
 *
 * Comptes de test (identiques au staging IAM) :
 *   Staff    : ahmed.ben_ali / Test@2026  (COLLABORATEUR)
 *              fatima.trabelsi / Test@2026 (COLLABORATEUR)
 *              sophie.martin / Test@2026   (FREELANCE)
 *   Étudiants: mohamed.khelifi / Test@2026
 *              slim.hamdani / Test@2026    (compte désactivé → erreur)
 *
 * Flux simulé :
 *  1. GET  /mock/sso/auth/staff?redirect_uri=&code_challenge=&state=  → formulaire HTML
 *  2. POST /mock/sso/auth/submit  → valide credentials → redirect ?code=&state=
 *  3. POST /mock/sso/staff/exchange  → vérifie PKCE → retourne profil staff
 *  4. POST /mock/sso/exchange        → vérifie PKCE → retourne profil étudiant
 */
@Slf4j
@RestController
@RequestMapping("/mock")
public class MockIamController {

    @Value("${sso.mock-submit-base-url:http://localhost:8083}")
    private String mockSubmitBaseUrl;

    /** code → {login, codeChallenge, userType, createdAt} */
    private final ConcurrentHashMap<String, MockCodeEntry> codeStore = new ConcurrentHashMap<>();

    // ─── Comptes de test IAM (indépendants de la base locale) ───────────────────

    private static final Map<String, IamUser> STAFF_ACCOUNTS = Map.of(
        "ahmed.ben_ali",    new IamUser("ahmed.ben_ali",    "Test@2026", "Ahmed",   "Ben Ali",   "COLLABORATEUR", true),
        "fatima.trabelsi",  new IamUser("fatima.trabelsi",  "Test@2026", "Fatima",  "Trabelsi",  "COLLABORATEUR", true),
        "sophie.martin",    new IamUser("sophie.martin",    "Test@2026", "Sophie",  "Martin",    "FREELANCE",     true),
        "slim.hamdani",     new IamUser("slim.hamdani",     "Test@2026", "Slim",    "Hamdani",   "COLLABORATEUR", false),
        "maher.elloumi",    new IamUser("maher.elloumi",    "Test@2026", "Maher",   "Elloumi",   "COLLABORATEUR", false)
    );

    private static final Map<String, IamUser> STUDENT_ACCOUNTS = Map.of(
        "mohamed.khelifi",  new IamUser("mohamed.khelifi", "Test@2026", "Mohamed", "Khelifi",   "STUDENT", true),
        "p.dupont.23",      new IamUser("p.dupont.23",     "Test@2026", "Pierre",  "Dupont",    "STUDENT", true),
        "slim.hamdani",     new IamUser("slim.hamdani",    "Test@2026", "Slim",    "Hamdani",   "STUDENT", false)
    );

    // ─── Formulaire login staff ──────────────────────────────────────────────────

    @GetMapping(value = "/sso/auth/staff", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> staffLoginForm(
            @RequestParam("redirect_uri")         String redirectUri,
            @RequestParam("code_challenge")        String codeChallenge,
            @RequestParam("code_challenge_method") String method,
            @RequestParam("state")                 String state,
            @RequestParam(value = "client_id", defaultValue = "") String clientId) {
        return ResponseEntity.ok(buildLoginHtml(redirectUri, codeChallenge, state, "staff", null));
    }

    // ─── Formulaire login étudiant ───────────────────────────────────────────────

    @GetMapping(value = "/sso/auth/student", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> studentLoginForm(
            @RequestParam("redirect_uri")         String redirectUri,
            @RequestParam("code_challenge")        String codeChallenge,
            @RequestParam("code_challenge_method") String method,
            @RequestParam("state")                 String state,
            @RequestParam(value = "client_id", defaultValue = "") String clientId) {
        return ResponseEntity.ok(buildLoginHtml(redirectUri, codeChallenge, state, "student", null));
    }

    // ─── Soumission du formulaire ────────────────────────────────────────────────

    @PostMapping(value = "/sso/auth/submit", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<?> submitLogin(
            @RequestParam String login,
            @RequestParam String password,
            @RequestParam("redirect_uri")   String redirectUri,
            @RequestParam("code_challenge") String codeChallenge,
            @RequestParam                   String state,
            @RequestParam("user_type")      String userType) {

        Map<String, IamUser> accounts = "student".equalsIgnoreCase(userType)
                ? STUDENT_ACCOUNTS : STAFF_ACCOUNTS;

        IamUser user = accounts.get(login);

        // Compte inexistant ou mauvais mot de passe
        if (user == null || !user.password().equals(password)) {
            log.warn("Mock IAM: invalid credentials for login={}", login);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_HTML)
                    .body(buildLoginHtml(redirectUri, codeChallenge, state, userType,
                            "Identifiants invalides."));
        }

        // Compte désactivé
        if (!user.active()) {
            log.warn("Mock IAM: account inactive for login={}", login);
            return redirectTo(redirectUri + "?error=account_inactive&state=" + state);
        }

        // Générer le code d'autorisation
        String code = UUID.randomUUID().toString().replace("-", "");
        codeStore.put(code, new MockCodeEntry(login, codeChallenge, userType, Instant.now()));
        cleanExpiredCodes();

        log.info("Mock IAM: code generated for login={}, userType={}", login, userType);
        return redirectTo(redirectUri + "?code=" + code + "&state=" + state);
    }

    // ─── Auth directe (formulaire — sans PKCE) ──────────────────────────────────

    @PostMapping(value = "/sso/auth/direct", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> directLogin(@RequestBody Map<String, String> body) {
        String login    = body.get("login");
        String password = body.get("password");
        String userType = body.getOrDefault("userType", "staff");

        Map<String, IamUser> accounts = "student".equalsIgnoreCase(userType)
                ? STUDENT_ACCOUNTS : STAFF_ACCOUNTS;

        IamUser user = accounts.get(login);

        if (user == null || !user.password().equals(password)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "invalid_credentials"));
        }
        if (!user.active()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "account_inactive"));
        }

        if ("student".equalsIgnoreCase(userType)) {
            SsoStudentResponse resp = new SsoStudentResponse();
            resp.setAccessToken("mock-direct-student-token");
            resp.setLogin(user.login());
            resp.setStudentId((long) user.login().hashCode());
            resp.setFirstName(user.firstName());
            resp.setLastName(user.lastName());
            resp.setSite("Tunis");
            log.info("Mock IAM direct login: student={}", login);
            return ResponseEntity.ok(resp);
        }

        SsoStaffResponse resp = new SsoStaffResponse();
        resp.setToken("mock-direct-staff-token");
        resp.setLogin(user.login());
        resp.setDisplayName(user.firstName() + " " + user.lastName());
        resp.setUserType(user.staffType());
        log.info("Mock IAM direct login: staff={}", login);
        return ResponseEntity.ok(resp);
    }

    // ─── Échange de code (staff) ─────────────────────────────────────────────────

    @PostMapping(value = "/sso/staff/exchange", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<SsoStaffResponse> exchangeStaffCode(@RequestBody Map<String, String> body) {
        MockCodeEntry entry = resolveCode(body.get("code"), body.get("codeVerifier"));
        if (entry == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        IamUser user = STAFF_ACCOUNTS.get(entry.login());
        SsoStaffResponse response = new SsoStaffResponse();
        response.setToken("mock-iam-staff-token");
        response.setLogin(entry.login());
        response.setUserType(user != null ? user.staffType() : "COLLABORATEUR");
        response.setDisplayName(user != null ? user.firstName() + " " + user.lastName() : entry.login());

        log.info("Mock IAM: staff exchange success for login={}", entry.login());
        return ResponseEntity.ok(response);
    }

    // ─── Échange de code (étudiant) ──────────────────────────────────────────────

    @PostMapping(value = "/sso/exchange", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<SsoStudentResponse> exchangeStudentCode(@RequestBody Map<String, String> body) {
        MockCodeEntry entry = resolveCode(body.get("code"), body.get("codeVerifier"));
        if (entry == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        IamUser user = STUDENT_ACCOUNTS.get(entry.login());
        SsoStudentResponse response = new SsoStudentResponse();
        response.setAccessToken("mock-iam-student-token");
        response.setLogin(entry.login());
        response.setStudentId((long) (user != null ? entry.login().hashCode() : 0));
        response.setFirstName(user != null ? user.firstName() : entry.login());
        response.setLastName(user != null ? user.lastName() : "");
        response.setSite("Tunis");

        log.info("Mock IAM: student exchange success for login={}", entry.login());
        return ResponseEntity.ok(response);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private MockCodeEntry resolveCode(String code, String codeVerifier) {
        if (code == null || codeVerifier == null) return null;

        MockCodeEntry entry = codeStore.remove(code);
        if (entry == null) {
            log.warn("Mock IAM: code not found or already used: {}", code);
            return null;
        }
        if (Instant.now().isAfter(entry.createdAt().plus(30, ChronoUnit.SECONDS))) {
            log.warn("Mock IAM: code expired for login={}", entry.login());
            return null;
        }
        if (!sha256Base64Url(codeVerifier).equals(entry.codeChallenge())) {
            log.warn("Mock IAM: PKCE mismatch for login={}", entry.login());
            return null;
        }
        return entry;
    }

    private ResponseEntity<?> redirectTo(String url) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }

    private String sha256Base64Url(String input) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(input.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private void cleanExpiredCodes() {
        Instant cutoff = Instant.now().minus(2, ChronoUnit.MINUTES);
        codeStore.entrySet().removeIf(e -> e.getValue().createdAt().isBefore(cutoff));
    }

    private String buildLoginHtml(String redirectUri, String codeChallenge,
                                   String state, String userType, String error) {
        String errorBlock = error != null
                ? "<div style='background:#fee2e2;color:#991b1b;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-size:14px;'>⚠ " + error + "</div>"
                : "";
        String title = "student".equals(userType) ? "Connexion Élève" : "Connexion Instructeur";
        String hint = "";

        return """
                <!DOCTYPE html>
                <html lang="fr">
                <head>
                  <meta charset="UTF-8"/>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                  <title>DecliIAM — %s</title>
                  <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: system-ui, sans-serif; background: #0d1b1c; min-height: 100vh;
                           display: flex; align-items: center; justify-content: center; }
                    .card { background: #152a2b; border-radius: 16px; padding: 40px;
                            width: 100%%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,.4); }
                    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
                    .logo svg { color: #0bd0da; }
                    .logo span { color: #fff; font-size: 20px; font-weight: 700; }
                    .badge { background: #0bd0da22; color: #0bd0da; font-size: 12px;
                             padding: 3px 10px; border-radius: 20px; }
                    h2 { color: #fff; font-size: 22px; margin-bottom: 6px; }
                    p  { color: #a0c5c7; font-size: 14px; margin-bottom: 24px; }
                    label { color: #cde7e8; font-size: 13px; font-weight: 500;
                            display: block; margin-bottom: 6px; }
                    input[type=text], input[type=password] {
                      width: 100%%; background: #1a3335; border: 1px solid #2a4546;
                      border-radius: 10px; color: #fff; font-size: 15px;
                      padding: 13px 16px; margin-bottom: 16px; outline: none; }
                    input:focus { border-color: #0bd0da; }
                    button[type=submit] {
                      width: 100%%; background: #0bd0da; color: #0d1b1c; font-size: 15px;
                      font-weight: 700; border: none; border-radius: 10px;
                      padding: 14px; cursor: pointer; margin-top: 4px; }
                    button:hover { opacity: .9; }
                    .footer { color: #49989c; font-size: 12px; text-align: center; margin-top: 24px; }
                  </style>
                </head>
                <body>
                <div class="card">
                  <div class="logo">
                    <svg width="28" height="28" fill="none" viewBox="0 0 48 48">
                      <path d="M6 6H42L36 24L42 42H6L12 24L6 6Z" fill="currentColor"/>
                    </svg>
                    <span>DecliIAM</span>
                    <span class="badge">Mock</span>
                  </div>
                  <h2>%s</h2>
                  <p>Authentification centralisée DecliTech</p>
                  %s
                  <form method="POST" action="%s/mock/sso/auth/submit">
                    <input type="hidden" name="redirect_uri"   value="%s"/>
                    <input type="hidden" name="code_challenge" value="%s"/>
                    <input type="hidden" name="state"          value="%s"/>
                    <input type="hidden" name="user_type"      value="%s"/>
                    <label for="login">Login IAM</label>
                    <input id="login" name="login" type="text"
                           placeholder="Login" autocomplete="username" required/>
                    <label for="password">Mot de passe</label>
                    <input id="password" name="password" type="password"
                           placeholder="••••••••" autocomplete="current-password" required/>
                    <button type="submit">Se connecter →</button>
                  </form>
                  <p class="footer">Vos credentials ne sont jamais partagés avec l'application.</p>
                </div>
                </body>
                </html>
                """.formatted(title, title, errorBlock, mockSubmitBaseUrl,
                              redirectUri, codeChallenge, state, userType);
    }

    // ─── Records internes ────────────────────────────────────────────────────────

    private record MockCodeEntry(String login, String codeChallenge, String userType, Instant createdAt) {}

    private record IamUser(String login, String password, String firstName, String lastName,
                            String staffType, boolean active) {}
}
