package com.declitech.session.service;

import com.declitech.session.client.ReportServiceClient;
import com.declitech.session.client.UserServiceClient;
import com.declitech.session.dto.CreateSessionRequest;
import com.declitech.session.dto.SessionDTO;
import com.declitech.session.dto.UserDTO;
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
    @Mock private UserServiceClient userServiceClient;
    @Mock private ReportServiceClient reportServiceClient;

    @InjectMocks
    private SessionService sessionService;

    private UserDTO instructor;
    private Session activeSession;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(sessionService, "defaultDurationHours", 1.5);

        instructor = new UserDTO();
        instructor.setId(1L);
        instructor.setUsername("prof.dupont");
        instructor.setEmail("prof@declitech.com");

        activeSession = Session.builder()
                .id(10L)
                .sessionCode("ABC123")
                .title("Test Java")
                .instructorId(1L)
                .instructorUsername("prof.dupont")
                .instructorEmail("prof@declitech.com")
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

        when(userServiceClient.getUserById(1L)).thenReturn(instructor);
        when(codeGenerator.generateCode()).thenReturn("XYZ999");
        when(sessionRepository.existsBySessionCode("XYZ999")).thenReturn(false);
        when(sessionRepository.save(any(Session.class))).thenReturn(activeSession);
        when(reportServiceClient.getParticipantCountBySessionCode(anyString())).thenReturn(0L);
        when(reportServiceClient.getReportCountBySessionCode(anyString())).thenReturn(0);

        SessionDTO result = sessionService.createSession(1L, request);

        assertThat(result).isNotNull();
        assertThat(result.getSessionCode()).isEqualTo("ABC123");
        assertThat(result.getTitle()).isEqualTo("Test Java");
        assertThat(result.getStatus()).isEqualTo("ACTIVE");
        verify(sessionRepository).save(any(Session.class));
    }

    @Test
    @DisplayName("createSession - instructeur introuvable → RuntimeException")
    void createSession_InstructorNotFound_ShouldThrowRuntimeException() {
        CreateSessionRequest request = new CreateSessionRequest();
        request.setTitle("Module Test");

        when(userServiceClient.getUserById(99L)).thenReturn(null);

        assertThatThrownBy(() -> sessionService.createSession(99L, request))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Instructor not found");
    }

    @Test
    @DisplayName("createSession - code généré déjà existant → génère un nouveau code")
    void createSession_DuplicateCode_ShouldRetryAndGenerateNewCode() {
        CreateSessionRequest request = new CreateSessionRequest();
        request.setTitle("Module Collision");

        when(userServiceClient.getUserById(1L)).thenReturn(instructor);
        when(codeGenerator.generateCode()).thenReturn("DUP111").thenReturn("UNI222");
        when(sessionRepository.existsBySessionCode("DUP111")).thenReturn(true);
        when(sessionRepository.existsBySessionCode("UNI222")).thenReturn(false);
        when(sessionRepository.save(any(Session.class))).thenReturn(activeSession);
        when(reportServiceClient.getParticipantCountBySessionCode(anyString())).thenReturn(0L);
        when(reportServiceClient.getReportCountBySessionCode(anyString())).thenReturn(0);

        SessionDTO result = sessionService.createSession(1L, request);

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
        when(reportServiceClient.getParticipantCountBySessionCode("ABC123")).thenReturn(3L);
        when(reportServiceClient.getReportCountBySessionCode("ABC123")).thenReturn(3);

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
        when(reportServiceClient.getParticipantCountBySessionCode(anyString())).thenReturn(0L);
        when(reportServiceClient.getReportCountBySessionCode(anyString())).thenReturn(0);

        SessionDTO result = sessionService.deactivateSession(1L);

        assertThat(result.getStatus()).isEqualTo("CANCELLED");
    }

    @Test
    @DisplayName("deactivateSession - session ancienne (> 5 min) → statut ENDED")
    void deactivateSession_OldSession_ShouldSetStatusEnded() {
        when(sessionRepository.findById(10L)).thenReturn(Optional.of(activeSession));
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(reportServiceClient.getParticipantCountBySessionCode(anyString())).thenReturn(0L);
        when(reportServiceClient.getReportCountBySessionCode(anyString())).thenReturn(0);

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
    //  getAllActiveSessions()
    // =========================================================

    @Test
    @DisplayName("getAllActiveSessions - retourne uniquement les sessions ACTIVE")
    void getAllActiveSessions_ShouldReturnOnlyActiveSessions() {
        when(sessionRepository.findByStatus(SessionStatus.ACTIVE)).thenReturn(List.of(activeSession));
        when(reportServiceClient.getParticipantCountBySessionCode(anyString())).thenReturn(0L);
        when(reportServiceClient.getReportCountBySessionCode(anyString())).thenReturn(0);

        List<SessionDTO> result = sessionService.getAllActiveSessions();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getStatus()).isEqualTo("ACTIVE");
    }
}
