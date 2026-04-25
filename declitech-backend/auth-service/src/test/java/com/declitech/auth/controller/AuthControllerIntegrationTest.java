package com.declitech.auth.controller;

import com.declitech.auth.config.GatewayFilter;
import com.declitech.auth.dto.LoginRequest;
import com.declitech.auth.dto.LoginResponse;
import com.declitech.auth.exception.InvalidCredentialsException;
import com.declitech.auth.exception.UserInactiveException;
import com.declitech.auth.security.JwtAuthenticationEntryPoint;
import com.declitech.auth.security.JwtAuthenticationFilter;
import com.declitech.auth.service.AuthService;
import com.declitech.auth.service.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller-layer integration tests for AuthController.
 *
 * Both GatewayFilter and JwtAuthenticationFilter are mocked to pass through,
 * isolating controller + Spring Security authorization behaviour.
 * JwtAuthenticationEntryPoint is mocked and configured to write 401.
 */
@WebMvcTest(AuthController.class)
@DisplayName("Tests d'intégration — AuthController")
class AuthControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private AuthService authService;
    @MockBean private JwtService jwtService;
    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockBean private GatewayFilter gatewayFilter;
    @MockBean private JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
    @MockBean private UserDetailsService userDetailsService;

    @BeforeEach
    void setup() throws Exception {
        Mockito.doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(gatewayFilter)
          .doFilter(any(ServletRequest.class), any(ServletResponse.class), any(FilterChain.class));

        Mockito.doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter)
          .doFilter(any(HttpServletRequest.class), any(HttpServletResponse.class), any(FilterChain.class));

        Mockito.doAnswer(inv -> {
            HttpServletResponse response = inv.getArgument(1);
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Unauthorized\"}");
            return null;
        }).when(jwtAuthenticationEntryPoint)
          .commence(any(HttpServletRequest.class), any(HttpServletResponse.class), any(AuthenticationException.class));
    }

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

        mockMvc.perform(post("/api/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.firstName").value("Admin"))
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

        mockMvc.perform(post("/api/auth/login").with(csrf())
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

        mockMvc.perform(post("/api/auth/login").with(csrf())
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
        mockMvc.perform(post("/api/auth/logout").with(csrf()))
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
                        .with(user("valid-user").roles("INSTRUCTOR"))
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
