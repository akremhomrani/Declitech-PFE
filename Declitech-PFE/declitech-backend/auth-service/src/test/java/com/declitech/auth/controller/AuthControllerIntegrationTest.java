package com.declitech.auth.controller;

import com.declitech.auth.dto.LoginRequest;
import com.declitech.auth.dto.LoginResponse;
import com.declitech.auth.dto.TokenResponse;
import com.declitech.auth.exception.InvalidCredentialsException;
import com.declitech.auth.exception.InvalidTokenException;
import com.declitech.auth.exception.UserInactiveException;
import com.declitech.auth.service.AuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@DisplayName("Tests d'intégration — AuthController")
class AuthControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private AuthService authService;

    // =========================================================
    //  POST /api/auth/login
    // =========================================================

    @Test
    @DisplayName("POST /login - credentials valides → 200 + cookies HttpOnly")
    void login_ValidCredentials_Returns200AndSetsHttpOnlyCookies() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setUsernameOrEmail("admin");
        request.setPassword("password123");

        LoginResponse mockResponse = LoginResponse.builder()
                .accessToken("access-token-123")
                .refreshToken("refresh-token-456")
                .username("admin")
                .role("ADMIN")
                .firstName("Admin")
                .lastName("User")
                .build();

        when(authService.login(any(LoginRequest.class))).thenReturn(mockResponse);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.firstName").value("Admin"))
                // Les tokens ne doivent pas être exposés dans le body
                .andExpect(jsonPath("$.accessToken").doesNotExist())
                .andExpect(cookie().exists("accessToken"))
                .andExpect(cookie().httpOnly("accessToken", true))
                .andExpect(cookie().exists("refreshToken"))
                .andExpect(cookie().httpOnly("refreshToken", true));
    }

    @Test
    @DisplayName("POST /login - mauvaises credentials → 401")
    void login_InvalidCredentials_Returns401() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setUsernameOrEmail("bad");
        request.setPassword("wrong");

        when(authService.login(any())).thenThrow(new InvalidCredentialsException("Invalid credentials"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("POST /login - utilisateur inactif → 403")
    void login_InactiveUser_Returns403() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setUsernameOrEmail("inactif");
        request.setPassword("password");

        when(authService.login(any())).thenThrow(new UserInactiveException("User is inactive"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    // =========================================================
    //  POST /api/auth/logout
    // =========================================================

    @Test
    @DisplayName("POST /logout - logout → 200 + cookies effacés")
    void logout_ShouldClearCookiesAndReturn200() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Logged out successfully"))
                .andExpect(cookie().maxAge("accessToken", 0))
                .andExpect(cookie().maxAge("refreshToken", 0));
    }

    // =========================================================
    //  GET /api/auth/validate
    // =========================================================

    @Test
    @DisplayName("GET /validate - token valide dans cookie → 200 + valid:true + role")
    void validateToken_ValidToken_Returns200WithValidTrueAndRole() throws Exception {
        when(authService.validateToken("valid-token")).thenReturn(true);
        when(authService.extractRoleFromToken("valid-token")).thenReturn("INSTRUCTOR");

        mockMvc.perform(get("/api/auth/validate")
                        .cookie(new jakarta.servlet.http.Cookie("accessToken", "valid-token")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.role").value("INSTRUCTOR"));
    }

    @Test
    @DisplayName("GET /validate - pas de cookie accessToken → 401")
    void validateToken_NoCookie_Returns401() throws Exception {
        mockMvc.perform(get("/api/auth/validate"))
                .andExpect(status().isUnauthorized());
    }

    // =========================================================
    //  GET /api/auth/health
    // =========================================================

    @Test
    @DisplayName("GET /health - retourne statut UP")
    void health_ShouldReturnStatusUp() throws Exception {
        mockMvc.perform(get("/api/auth/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("auth-service"));
    }
}
