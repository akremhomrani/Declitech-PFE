package com.declitech.auth.controller;

import com.declitech.auth.dto.LoginResponse;
import com.declitech.auth.dto.SsoCallbackRequest;
import com.declitech.auth.dto.SsoUrlResponse;
import com.declitech.auth.service.SsoService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;



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

}
