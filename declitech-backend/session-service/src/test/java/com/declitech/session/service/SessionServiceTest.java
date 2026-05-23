package com.declitech.session.service;

import com.declitech.session.client.ReportServiceClient;
import com.declitech.session.dto.CreateSessionRequest;
import com.declitech.session.dto.SessionDTO;
import com.declitech.session.model.Session;
import com.declitech.session.model.SessionStatus;
import com.declitech.session.repository.SessionRepository;
import com.declitech.session.util.SessionCodeGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Tests unitaires — SessionService")
class SessionServiceTest {

    @Mock private SessionRepository sessionRepository;
    @Mock private SessionCodeGenerator codeGenerator;
    @Mock private ReportServiceClient reportServiceClient;

    @InjectMocks
    private SessionService sessionService;

    private Session activeSession;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(sessionService, "defaultDurationHours", 1.5);

        activeSession = Session.builder()
                .id(10L)
                .sessionCode("ABC123")
                .title("Test Java")
                .instructorUsername("ahmed.ben_ali")
                .instructorEmail("ahmed.ben_ali@iam.declitech.local")
                .status(SessionStatus.ACTIVE)
                .createdAt(LocalDateTime.now().minusMinutes(10))
                .expiresAt(LocalDateTime.now().plusHours(1))
                .build();
    }

    // =========================================================
    //  createSession()
    // =========================================================

    @Test
    @DisplayName("createSession - données valides → session créée avec code unique")
    void createSession_ValidData_ShouldCreateSessionWithUniqueCode() {
        CreateSessionRequest request = new CreateSessionRequest();
        request.setTitle("Module Java");
        request.setDurationHours(2.0);

        when(codeGenerator.generateCode()).thenReturn("XYZ999");
        when(sessionRepository.existsBySessionCode("XYZ999")).thenReturn(false);
        when(sessionRepository.save(any(Session.class))).thenReturn(activeSession);
        when(reportServiceClient.getParticipantCountBySessionId(anyLong())).thenReturn(0L);
        when(reportServiceClient.getReportCountBySessionId(anyLong())).thenReturn(0);

        SessionDTO result = sessionService.createSession("ahmed.ben_ali", "Ahmed", "Ben Ali", request);

        assertThat(result).isNotNull();
        assertThat(result.getSessionCode()).isEqualTo("ABC123");
        assertThat(result.getTitle()).isEqualTo("Test Java");
        assertThat(result.getStatus()).isEqualTo("ACTIVE");
        verify(sessionRepository).save(any(Session.class));
    }

    @Test
    @DisplayName("createSession - code généré déjà existant → génère un nouveau code")
    void createSession_DuplicateCode_ShouldRetryAndGenerateNewCode() {
        CreateSessionRequest request = new CreateSessionRequest();
        request.setTitle("Module Collision");

        when(codeGenerator.generateCode()).thenReturn("DUP111").thenReturn("UNI222");
        when(sessionRepository.existsBySessionCode("DUP111")).thenReturn(true);
        when(sessionRepository.existsBySessionCode("UNI222")).thenReturn(false);
        when(sessionRepository.save(any(Session.class))).thenReturn(activeSession);
        when(reportServiceClient.getParticipantCountBySessionId(anyLong())).thenReturn(0L);
        when(reportServiceClient.getReportCountBySessionId(anyLong())).thenReturn(0);

        SessionDTO result = sessionService.createSession("ahmed.ben_ali", "Ahmed", "Ben Ali", request);

        assertThat(result).isNotNull();
        verify(codeGenerator, times(2)).generateCode();
    }

    // =========================================================
    //  getSessionByCode()
    // =========================================================

    @Test
    @DisplayName("getSessionByCode - code existant → SessionDTO")
    void getSessionByCode_Exists_ShouldReturnSession() {
        when(sessionRepository.findBySessionCode("ABC123")).thenReturn(Optional.of(activeSession));
        when(reportServiceClient.getParticipantCountBySessionId(10L)).thenReturn(3L);
        when(reportServiceClient.getReportCountBySessionId(10L)).thenReturn(3);

        SessionDTO result = sessionService.getSessionByCode("ABC123");

        assertThat(result).isNotNull();
        assertThat(result.getSessionCode()).isEqualTo("ABC123");
        assertThat(result.getParticipantCount()).isEqualTo(3);
    }

    @Test
    @DisplayName("getSessionByCode - code introuvable → RuntimeException")
    void getSessionByCode_NotFound_ShouldThrowRuntimeException() {
        when(sessionRepository.findBySessionCode("XXXXXX")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> sessionService.getSessionByCode("XXXXXX"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Session not found");
    }

    // =========================================================
    //  deactivateSession()
    // =========================================================

    @Test
    @DisplayName("deactivateSession - session récente (< 5 min) → statut CANCELLED")
    void deactivateSession_RecentSession_ShouldSetStatusCancelled() {
        Session recentSession = Session.builder()
                .id(1L).sessionCode("NEW001").status(SessionStatus.ACTIVE)
                .createdAt(LocalDateTime.now().minusMinutes(2))
                .expiresAt(LocalDateTime.now().plusHours(1)).build();

        when(sessionRepository.findById(1L)).thenReturn(Optional.of(recentSession));
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(reportServiceClient.getParticipantCountBySessionId(anyLong())).thenReturn(0L);
        when(reportServiceClient.getReportCountBySessionId(anyLong())).thenReturn(0);

        SessionDTO result = sessionService.deactivateSession(1L);

        assertThat(result.getStatus()).isEqualTo("CANCELLED");
    }

    @Test
    @DisplayName("deactivateSession - session ancienne (> 5 min) → statut ENDED")
    void deactivateSession_OldSession_ShouldSetStatusEnded() {
        when(sessionRepository.findById(10L)).thenReturn(Optional.of(activeSession));
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(reportServiceClient.getParticipantCountBySessionId(anyLong())).thenReturn(0L);
        when(reportServiceClient.getReportCountBySessionId(anyLong())).thenReturn(0);

        SessionDTO result = sessionService.deactivateSession(10L);

        assertThat(result.getStatus()).isEqualTo("ENDED");
    }

    @Test
    @DisplayName("deactivateSession - session introuvable → RuntimeException")
    void deactivateSession_NotFound_ShouldThrowRuntimeException() {
        when(sessionRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> sessionService.deactivateSession(999L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Session not found");
    }

    // =========================================================
    //  setDecliquizAccessCode()
    // =========================================================

    @Test
    @DisplayName("setDecliquizAccessCode - session sans code → code persisté")
    void setDecliquizAccessCode_NoExistingCode_ShouldPersist() {
        when(sessionRepository.findById(10L)).thenReturn(Optional.of(activeSession));
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(reportServiceClient.getParticipantCountBySessionId(anyLong())).thenReturn(0L);
        when(reportServiceClient.getReportCountBySessionId(anyLong())).thenReturn(0);

        SessionDTO result = sessionService.setDecliquizAccessCode(10L, "G136XZ");

        assertThat(result.getDecliquizAccessCode()).isEqualTo("G136XZ");
        verify(sessionRepository).save(any());
    }

    @Test
    @DisplayName("setDecliquizAccessCode - code déjà présent → ignoré (idempotent)")
    void setDecliquizAccessCode_AlreadySet_ShouldNotOverwrite() {
        activeSession.setDecliquizAccessCode("G100AA");
        when(sessionRepository.findById(10L)).thenReturn(Optional.of(activeSession));
        when(reportServiceClient.getParticipantCountBySessionId(anyLong())).thenReturn(0L);
        when(reportServiceClient.getReportCountBySessionId(anyLong())).thenReturn(0);

        SessionDTO result = sessionService.setDecliquizAccessCode(10L, "G999ZZ");

        assertThat(result.getDecliquizAccessCode()).isEqualTo("G100AA");
        verify(sessionRepository, never()).save(any());
    }

    @Test
    @DisplayName("setDecliquizAccessCode - session introuvable → RuntimeException")
    void setDecliquizAccessCode_NotFound_ShouldThrow() {
        when(sessionRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> sessionService.setDecliquizAccessCode(999L, "G1AAAA"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Session not found");
    }

    // =========================================================
    //  getAllActiveSessions()
    // =========================================================

    @Test
    @DisplayName("getAllActiveSessions - retourne uniquement les sessions ACTIVE")
    void getAllActiveSessions_ShouldReturnOnlyActiveSessions() {
        when(sessionRepository.findByStatus(SessionStatus.ACTIVE)).thenReturn(List.of(activeSession));
        when(reportServiceClient.getParticipantCountBySessionId(anyLong())).thenReturn(0L);
        when(reportServiceClient.getReportCountBySessionId(anyLong())).thenReturn(0);

        List<SessionDTO> result = sessionService.getAllActiveSessions();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getStatus()).isEqualTo("ACTIVE");
    }

    // =========================================================
    //  getSessionsByUsername()
    // =========================================================

    @Test
    @DisplayName("getSessionsByUsername - retourne les sessions de l'instructeur IAM")
    void getSessionsByUsername_ShouldReturnInstructorSessions() {
        when(sessionRepository.findByInstructorUsername("ahmed.ben_ali")).thenReturn(List.of(activeSession));
        when(reportServiceClient.getParticipantCountBySessionId(anyLong())).thenReturn(0L);
        when(reportServiceClient.getReportCountBySessionId(anyLong())).thenReturn(0);

        List<SessionDTO> result = sessionService.getSessionsByUsername("ahmed.ben_ali");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getInstructorUsername()).isEqualTo("ahmed.ben_ali");
    }
}
