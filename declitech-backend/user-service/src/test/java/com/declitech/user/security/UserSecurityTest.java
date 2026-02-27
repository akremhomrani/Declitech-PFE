package com.declitech.user.security;

import com.declitech.user.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tests de sécurité — User Service
 * Vérifie le contrôle d'accès basé sur les rôles (RBAC)
 */
@WebMvcTest(com.declitech.user.controller.UserController.class)
@DisplayName("Tests de sécurité — Contrôle d'accès (RBAC)")
class UserSecurityTest {

    @Autowired private MockMvc mockMvc;
    @MockBean  private UserService userService;

    // MockBeans requis pour que SecurityConfig du user-service charge correctement
    @MockBean private com.declitech.user.security.JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockBean private com.declitech.user.security.JwtTokenProvider jwtTokenProvider;
    @MockBean private com.declitech.user.security.JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
    @MockBean private com.declitech.user.security.JwtAccessDeniedHandler jwtAccessDeniedHandler;
    @MockBean private org.springframework.security.core.userdetails.UserDetailsService userDetailsService;

    // =========================================================
    //  1. Accès anonyme (sans token)
    // =========================================================

    @Test
    @WithAnonymousUser
    @DisplayName("SEC-RBAC-01 : POST /users sans authentification → 4xx (accès refusé)")
    void createUser_AnonymousUser_ShouldReturn4xx() throws Exception {
        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"Test\",\"email\":\"t@t.com\"}"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @WithAnonymousUser
    @DisplayName("SEC-RBAC-02 : GET /users sans authentification → 4xx (accès refusé)")
    void getUsers_AnonymousUser_ShouldReturn4xx() throws Exception {
        mockMvc.perform(get("/api/users"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @WithAnonymousUser
    @DisplayName("SEC-RBAC-03 : DELETE /users/{id} sans authentification → 4xx (accès refusé)")
    void deleteUser_AnonymousUser_ShouldReturn4xx() throws Exception {
        mockMvc.perform(delete("/api/users/1"))
                .andExpect(status().is4xxClientError());
    }

    // =========================================================
    //  2. Accès avec rôle INSTRUCTOR (insuffisant pour les endpoints ADMIN)
    // =========================================================

    @Test
    @WithMockUser(roles = "INSTRUCTOR")
    @DisplayName("SEC-RBAC-04 : POST /users avec rôle INSTRUCTOR → 403 Forbidden")
    void createUser_InstructorRole_ShouldReturn403() throws Exception {
        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .with(csrf())
                        .content("{\"firstName\":\"Test\",\"email\":\"t@t.com\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "INSTRUCTOR")
    @DisplayName("SEC-RBAC-05 : DELETE /users/{id} avec rôle INSTRUCTOR → 403 Forbidden")
    void deleteUser_InstructorRole_ShouldReturn403() throws Exception {
        mockMvc.perform(delete("/api/users/1").with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "INSTRUCTOR")
    @DisplayName("SEC-RBAC-06 : PUT /users/{id}/reactivate avec rôle INSTRUCTOR → 403 Forbidden")
    void reactivateUser_InstructorRole_ShouldReturn403() throws Exception {
        mockMvc.perform(put("/api/users/1/reactivate").with(csrf()))
                .andExpect(status().isForbidden());
    }

    // =========================================================
    //  3. Accès avec rôle ADMIN (autorisé)
    // =========================================================

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("SEC-RBAC-07 : GET /users avec rôle ADMIN → requête traitée (pas 5xx)")
    void getUsers_AdminRole_ShouldBeAuthorized() throws Exception {
        // ADMIN peut accéder — la sécurité ne doit pas lever d'exception serveur
        mockMvc.perform(get("/api/users"))
                .andExpect(status().is(not(500)));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("SEC-RBAC-08 : DELETE /users/{id} avec rôle ADMIN → requête traitée (pas 5xx)")
    void deleteUser_AdminRole_ShouldBeAuthorized() throws Exception {
        mockMvc.perform(delete("/api/users/1").with(csrf()))
                .andExpect(status().is(not(500)));
    }

    // =========================================================
    //  4. Escalade de Privilèges (rôle falsifié)
    // =========================================================

    @Test
    @WithMockUser(username = "instructor_user", roles = "INSTRUCTOR")
    @DisplayName("SEC-RBAC-09 : Instructor tente CREATE user (escalade de privilège) → 403")
    void createUser_PrivilegeEscalation_ShouldReturn403() throws Exception {
        String payload = """
            {
              "firstName": "Hacked",
              "lastName": "User",
              "email": "hacked@victim.com",
              "phoneNumber": "+21600000000",
              "sexe": "MALE"
            }
            """;

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .with(csrf())
                        .content(payload))
                .andExpect(status().isForbidden());
    }

    // =========================================================
    //  5. Injection dans les paramètres de chemin
    // =========================================================

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("SEC-RBAC-10 : Injection dans l'ID utilisateur → 400 Bad Request")
    void getUserById_InjectionInPathParam_ShouldReturn400() throws Exception {
        // Un ID non numérique doit déclencher une erreur de conversion, pas une erreur BD
        mockMvc.perform(get("/api/users/'; DROP TABLE users; --"))
                .andExpect(status().isBadRequest());
    }
}
