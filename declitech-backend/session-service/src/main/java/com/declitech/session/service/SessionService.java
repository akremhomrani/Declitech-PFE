package com.declitech.session.service;

import com.declitech.session.client.ReportServiceClient;
import com.declitech.session.dto.CreateSessionRequest;
import com.declitech.session.dto.JoinSessionResponse;
import com.declitech.session.dto.PagedSessionResponse;
import com.declitech.session.dto.SessionDTO;
import com.declitech.session.dto.SessionFilterRequest;
import com.declitech.session.model.Session;
import com.declitech.session.model.SessionStatus;
import com.declitech.session.repository.SessionRepository;
import com.declitech.session.repository.SessionSpecification;
import com.declitech.session.util.SessionCodeGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class SessionService {

    private final SessionRepository sessionRepository;
    private final SessionCodeGenerator codeGenerator;
    private final ReportServiceClient reportServiceClient;
    private final SessionTokenService sessionTokenService;

    @Value("${declitech.session.duration-hours:1.5}")
    private Double defaultDurationHours;

    @Transactional
    public SessionDTO createSession(String username, String firstName, String lastName,
                                    CreateSessionRequest request) {
        String sessionCode = generateUniqueSessionCode();

        Double duration = request.getDurationHours() != null ? request.getDurationHours() : defaultDurationHours;
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes((long) (duration * 60));

        Session session = Session.builder()
                .sessionCode(sessionCode)
                .title(request.getTitle())
                .instructorUsername(username)
                .instructorEmail(username + "@iam.declitech.local")
                .moduleId(request.getModuleId())
                .expiresAt(expiresAt)
                .status(SessionStatus.ACTIVE)
                .build();

        session = sessionRepository.save(session);
        log.info("Session created: code={}, instructor={}", sessionCode, username);

        return convertToDTO(session);
    }

    private String generateUniqueSessionCode() {
        String code;
        int attempts = 0;
        do {
            code = codeGenerator.generateCode();
            attempts++;
            if (attempts > 10) {
                throw new RuntimeException("Failed to generate unique session code after 10 attempts");
            }
        } while (sessionRepository.existsBySessionCode(code));
        return code;
    }

    @Transactional(readOnly = true)
    public SessionDTO getSessionByCode(String sessionCode) {
        Session session = sessionRepository.findBySessionCode(sessionCode)
                .orElseThrow(() -> new RuntimeException("Session not found with code: " + sessionCode));
        return convertToDTO(session);
    }

    @Transactional(readOnly = true)
    public SessionDTO getSessionById(Long id) {
        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found with ID: " + id));
        return convertToDTO(session);
    }

    @Transactional(readOnly = true)
    public List<SessionDTO> getSessionsByUsername(String username) {
        List<Session> sessions = sessionRepository.findByInstructorUsername(username);
        return sessions.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SessionDTO> getActiveSessionsByUsername(String username) {
        List<Session> sessions = sessionRepository.findActiveSessionsByInstructorUsername(username, LocalDateTime.now());
        return sessions.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SessionDTO> getAllActiveSessions() {
        List<Session> sessions = sessionRepository.findByStatus(SessionStatus.ACTIVE);
        return sessions.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SessionDTO> getAllSessions() {
        List<Session> sessions = sessionRepository.findAll();
        return sessions.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SessionDTO> getSessionsByModuleId(Long moduleId) {
        log.info("Fetching sessions for module ID: {}", moduleId);
        List<Session> sessions = sessionRepository.findByModuleId(moduleId);
        return sessions.stream().map(this::convertToDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PagedSessionResponse getSessionsWithPagination(
            SessionFilterRequest filter,
            int page,
            int size,
            String sortBy,
            String sortDirection) {

        if (page < 0) page = 0;
        if (size <= 0 || size > 100) size = 10;

        Sort sort = Sort.by(Sort.Direction.fromString(sortDirection.toUpperCase()), sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);
        Specification<Session> spec = SessionSpecification.filterBy(filter != null ? filter : new SessionFilterRequest());
        Page<Session> sessionPage = sessionRepository.findAll(spec, pageable);

        List<SessionDTO> sessionDTOs = sessionPage.getContent().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());

        return PagedSessionResponse.builder()
                .sessions(sessionDTOs)
                .currentPage(sessionPage.getNumber())
                .totalPages(sessionPage.getTotalPages())
                .totalElements(sessionPage.getTotalElements())
                .pageSize(sessionPage.getSize())
                .hasNext(sessionPage.hasNext())
                .hasPrevious(sessionPage.hasPrevious())
                .build();
    }

    @Transactional(readOnly = true)
    public JoinSessionResponse joinSession(String sessionCode, String studentLoginIdentity) {
        Session session = sessionRepository.findBySessionCode(sessionCode)
                .orElseThrow(() -> new RuntimeException("Session not found with code: " + sessionCode));

        if (session.getStatus() != SessionStatus.ACTIVE) {
            throw new RuntimeException("Session is not active");
        }

        String token = sessionTokenService.issueSessionToken(
                session.getId(), session.getSessionCode(), studentLoginIdentity, session.getExpiresAt());

        log.info("Student '{}' joined session code={}", studentLoginIdentity, sessionCode);

        return JoinSessionResponse.builder()
                .sessionToken(token)
                .sessionId(session.getId())
                .sessionCode(session.getSessionCode())
                .sessionTitle(session.getTitle())
                .expiresAt(session.getExpiresAt())
                .build();
    }

    @Transactional
    public SessionDTO deactivateSession(Long id) {
        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found with ID: " + id));

        long minutesSinceCreation = java.time.Duration.between(session.getCreatedAt(), LocalDateTime.now()).toMinutes();
        session.setStatus(minutesSinceCreation <= 5 ? SessionStatus.CANCELLED : SessionStatus.ENDED);

        session = sessionRepository.save(session);
        return convertToDTO(session);
    }

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void expireOldSessions() {
        LocalDateTime now = LocalDateTime.now();
        List<Session> expiredSessions = sessionRepository.findByStatusAndExpiresAtBefore(SessionStatus.ACTIVE, now);
        expiredSessions.forEach(s -> s.setStatus(SessionStatus.EXPIRED));
        sessionRepository.saveAll(expiredSessions);
    }

    private SessionDTO convertToDTO(Session session) {
        double durationHours = 0.0;
        if (session.getCreatedAt() != null && session.getExpiresAt() != null) {
            long minutes = java.time.Duration.between(session.getCreatedAt(), session.getExpiresAt()).toMinutes();
            durationHours = minutes / 60.0;
        }

        Integer actualParticipantCount = 0;
        Integer actualReportCount = 0;
        try {
            Long participantCount = reportServiceClient.getParticipantCountBySessionId(session.getId());
            actualParticipantCount = participantCount != null ? participantCount.intValue() : 0;
            actualReportCount = reportServiceClient.getReportCountBySessionId(session.getId());
            actualReportCount = actualReportCount != null ? actualReportCount : 0;
        } catch (Exception e) {
            // report-service may be unavailable — counts default to 0
        }

        return SessionDTO.builder()
                .id(session.getId())
                .sessionCode(session.getSessionCode())
                .title(session.getTitle())
                .instructorUsername(session.getInstructorUsername())
                .instructorEmail(session.getInstructorEmail())
                .moduleId(session.getModuleId())
                .durationHours(durationHours)
                .createdAt(session.getCreatedAt())
                .expiresAt(session.getExpiresAt())
                .status(session.getStatus().name())
                .participantCount(actualParticipantCount)
                .reportCount(actualReportCount)
                .build();
    }
}
