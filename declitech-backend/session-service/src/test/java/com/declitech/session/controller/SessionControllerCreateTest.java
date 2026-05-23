package com.declitech.session.controller;

import com.declitech.session.dto.CreateSessionRequest;
import com.declitech.session.dto.SessionDTO;
import com.declitech.session.dto.SiteModuleDto;
import com.declitech.session.service.SessionService;
import com.declitech.session.util.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Couvre la nouvelle logique IAM v6 (claims siteModules / site, 2026-05-04) du
 * {@link SessionController#createSession}.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SessionController.createSession — claims siteModules / site (IAM v6)")
class SessionControllerCreateTest {

    @Mock private SessionService sessionService;
    @Mock private JwtTokenProvider jwtTokenProvider;
    @InjectMocks private SessionController controller;

    private static final String BEARER = "Bearer fake.jwt.here";
    private static final String DECLITRACK = "declitrack";

    private CreateSessionRequest request;

    @BeforeEach
    void setUp() {
        request = new CreateSessionRequest();
        request.setTitle("Cours Algo");
        request.setModuleId(10L);
    }

    private void stubAuthenticatedStaff(String userType) {
        when(jwtTokenProvider.extractUsernameFromToken(any())).thenReturn("antoine.bernard");
        when(jwtTokenProvider.extractAppFeatures(any(), eq(DECLITRACK))).thenReturn(List.of("instructeur"));
        when(jwtTokenProvider.isStaff(any())).thenReturn(true);
        when(jwtTokenProvider.extractUserType(any())).thenReturn(userType);
    }

    // ---- INSTRUCTEUR -------------------------------------------------------

    @Test
    @DisplayName("INSTRUCTEUR — moduleId match siteModules → 201 + slot transmis au service")
    void instructeur_moduleInSiteModules_returnsCreated() {
        stubAuthenticatedStaff("INSTRUCTEUR");
        SiteModuleDto slot = new SiteModuleDto(1L, "Ariana Ville", 10L, "Algorithmique", "ALGO");
        when(jwtTokenProvider.findSiteModule(any(), eq(10L))).thenReturn(Optional.of(slot));
        when(sessionService.createSession(any(), any(), any(), any(), any(), any()))
                .thenReturn(SessionDTO.builder().id(1L).sessionCode("ABC123").build());

        ResponseEntity<SessionDTO> response = controller.createSession(request, null, BEARER);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        ArgumentCaptor<SiteModuleDto> slotCaptor = ArgumentCaptor.forClass(SiteModuleDto.class);
        ArgumentCaptor<String> siteCaptor = ArgumentCaptor.forClass(String.class);
        verify(sessionService).createSession(eq("antoine.bernard"), any(), any(),
                eq(request), slotCaptor.capture(), siteCaptor.capture());
        assertThat(slotCaptor.getValue().getModuleCode()).isEqualTo("ALGO");
        assertThat(slotCaptor.getValue().getSiteName()).isEqualTo("Ariana Ville");
        assertThat(siteCaptor.getValue()).isNull();  // INSTRUCTEUR → pas de site claim
    }

    @Test
    @DisplayName("INSTRUCTEUR — moduleId hors siteModules → 403, service jamais appelé")
    void instructeur_moduleOutsideSiteModules_returnsForbidden() {
        stubAuthenticatedStaff("INSTRUCTEUR");
        when(jwtTokenProvider.findSiteModule(any(), eq(10L))).thenReturn(Optional.empty());

        ResponseEntity<SessionDTO> response = controller.createSession(request, null, BEARER);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        verify(sessionService, never()).createSession(any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("INSTRUCTEUR — moduleId null → 201 sans validation siteModules (cas legacy)")
    void instructeur_moduleIdNull_skipsSiteModuleValidation() {
        stubAuthenticatedStaff("INSTRUCTEUR");
        request.setModuleId(null);
        when(sessionService.createSession(any(), any(), any(), any(), any(), any()))
                .thenReturn(SessionDTO.builder().id(2L).build());

        ResponseEntity<SessionDTO> response = controller.createSession(request, null, BEARER);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        verify(jwtTokenProvider, never()).findSiteModule(any(), any());
    }

    // ---- FREELANCE — même logique ------------------------------------------

    @Test
    @DisplayName("FREELANCE — moduleId match siteModules → 201")
    void freelance_moduleInSiteModules_returnsCreated() {
        stubAuthenticatedStaff("FREELANCE");
        SiteModuleDto slot = new SiteModuleDto(2L, "Bab Saadoun", 10L, "Algorithmique", "ALGO");
        when(jwtTokenProvider.findSiteModule(any(), eq(10L))).thenReturn(Optional.of(slot));
        when(sessionService.createSession(any(), any(), any(), any(), any(), any()))
                .thenReturn(SessionDTO.builder().id(3L).build());

        ResponseEntity<SessionDTO> response = controller.createSession(request, null, BEARER);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    // ---- COLLABORATEUR -----------------------------------------------------

    @Test
    @DisplayName("COLLABORATEUR — site claim capturé, pas de validation siteModules")
    void collaborateur_capturesSiteClaim() {
        stubAuthenticatedStaff("COLLABORATEUR");
        when(jwtTokenProvider.extractSite(any())).thenReturn("Tunis");
        when(sessionService.createSession(any(), any(), any(), any(), any(), any()))
                .thenReturn(SessionDTO.builder().id(4L).build());

        ResponseEntity<SessionDTO> response = controller.createSession(request, null, BEARER);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        ArgumentCaptor<SiteModuleDto> slotCaptor = ArgumentCaptor.forClass(SiteModuleDto.class);
        ArgumentCaptor<String> siteCaptor = ArgumentCaptor.forClass(String.class);
        verify(sessionService).createSession(any(), any(), any(),
                eq(request), slotCaptor.capture(), siteCaptor.capture());
        assertThat(slotCaptor.getValue()).isNull();
        assertThat(siteCaptor.getValue()).isEqualTo("Tunis");
        verify(jwtTokenProvider, never()).findSiteModule(any(), any());
    }

    // ---- garde existante ---------------------------------------------------

    @Test
    @DisplayName("Token absent → 401")
    void noToken_returnsUnauthorized() {
        when(jwtTokenProvider.extractUsernameFromToken(any())).thenReturn(null);

        ResponseEntity<SessionDTO> response = controller.createSession(request, null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
