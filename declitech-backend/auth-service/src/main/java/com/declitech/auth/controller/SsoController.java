package com.declitech.auth.controller;

import com.declitech.auth.dto.LoginResponse;
import com.declitech.auth.dto.SsoCallbackRequest;
import com.declitech.auth.dto.SsoUrlResponse;
import com.declitech.auth.service.SsoService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;



@RestController
@RequestMapping("/api/auth/sso")
@RequiredArgsConstructor
public class SsoController {

    private final SsoService ssoService;

    /**
     * Étape 1 — Le frontend demande l'URL de connexion IAM.
     * Retourne l'URL complète avec PKCE + state intégrés.
     *
     * GET /api/auth/sso/url?type=student
     * GET /api/auth/sso/url?type=staff
     */
    @GetMapping("/url")
    public ResponseEntity<SsoUrlResponse> getSsoLoginUrl(
            @RequestParam(defaultValue = "staff") String type) {
        return ResponseEntity.ok(ssoService.buildLoginUrl(type));
    }

    /**
     * Étape 3 — Le frontend envoie le code reçu du callback IAM.
     * Le backend échange le code contre un token IAM, génère ses propres
     * cookies JWT et retourne le profil utilisateur.
     *
     * POST /api/auth/sso/callback
     * Body: { "code": "...", "state": "..." }
     */
    @PostMapping("/callback")
    public ResponseEntity<LoginResponse> handleSsoCallback(
            @Valid @RequestBody SsoCallbackRequest request,
            HttpServletResponse response) {
        return ResponseEntity.ok(ssoService.handleCallback(request, response));
    }

    /**
     * Connexion directe via le formulaire — le frontend envoie login+password,
     * le backend les valide contre le Mock IAM et génère les cookies JWT.
     *
     * POST /api/auth/sso/login
     * Body: { "login": "ahmed.ben_ali", "password": "Test@2026", "userType": "staff" }
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> directLogin(
            @RequestBody DirectLoginRequest request,
            HttpServletResponse response) {
        return ResponseEntity.ok(
                ssoService.directLogin(request.login(), request.password(), request.userType(), response));
    }

    record DirectLoginRequest(String login, String password, String userType) {}
}
