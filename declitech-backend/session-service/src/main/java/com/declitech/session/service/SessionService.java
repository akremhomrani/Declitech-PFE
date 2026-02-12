package com.declitech.session.service;

import com.declitech.session.client.ReportServiceClient;
import com.declitech.session.client.UserServiceClient;
import com.declitech.session.dto.CreateSessionRequest;
import com.declitech.session.dto.SessionDTO;
import com.declitech.session.dto.UserDTO;
import com.declitech.session.model.Session;
import com.declitech.session.repository.SessionRepository;
import com.declitech.session.util.SessionCodeGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SessionService {

    private final SessionRepository sessionRepository;
    private final SessionCodeGenerator codeGenerator;
    private final UserServiceClient userServiceClient;
    private final ReportServiceClient reportServiceClient;

    @Value("${declitech.session.duration-hours:1.5}")
    private Double defaultDurationHours;

    @Transactional
    public SessionDTO createSession(Long instructorId, CreateSessionRequest request) {
        log.info("Creating session for instructor ID: {}", instructorId);

        // Fetch instructor information from user-service
        UserDTO instructor = userServiceClient.getUserById(instructorId);
        
        if (instructor == null) {
            throw new RuntimeException("Instructor not found with ID: " + instructorId);
        }

        // Generate unique session code
        String sessionCode = generateUniqueSessionCode();

        // Calculate expiration time
        Double duration = request.getDurationHours() != null ? request.getDurationHours() : defaultDurationHours;
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes((long) (duration * 60));

        // Create session
        Session session = Session.builder()
                .sessionCode(sessionCode)
                .title(request.getTitle())
                .instructorId(instructor.getId())
                .instructorUsername(instructor.getUsername())
                .instructorEmail(instructor.getEmail())
                .expiresAt(expiresAt)
                .isActive(true)
                .participantCount(0)
                .reportCount(0)
                .build();

        session = sessionRepository.save(session);
        log.info("Session created successfully with code: {}", sessionCode);

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
        log.info("Fetching session with code: {}", sessionCode);
        Session session = sessionRepository.findBySessionCode(sessionCode)
                .orElseThrow(() -> new RuntimeException("Session not found with code: " + sessionCode));
        
        // Update report count from report-service
        try {
            Integer reportCount = reportServiceClient.getReportCountBySessionCode(sessionCode);
            session.setReportCount(reportCount);
        } catch (Exception e) {
            log.warn("Failed to fetch report count for session: {}", sessionCode, e);
        }

        return convertToDTO(session);
    }

    @Transactional(readOnly = true)
    public SessionDTO getSessionById(Long id) {
        log.info("Fetching session with ID: {}", id);
        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found with ID: " + id));
        return convertToDTO(session);
    }

    @Transactional(readOnly = true)
    public List<SessionDTO> getSessionsByInstructor(Long instructorId) {
        log.info("Fetching sessions for instructor ID: {}", instructorId);
        List<Session> sessions = sessionRepository.findByInstructorId(instructorId);
        return sessions.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SessionDTO> getActiveSessionsByInstructor(Long instructorId) {
        log.info("Fetching active sessions for instructor ID: {}", instructorId);
        List<Session> sessions = sessionRepository.findActiveSessionsByInstructorId(instructorId, LocalDateTime.now());
        return sessions.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SessionDTO> getAllActiveSessions() {
        log.info("Fetching all active sessions");
        List<Session> sessions = sessionRepository.findAllActiveSessions(LocalDateTime.now());
        return sessions.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SessionDTO> getAllSessions() {
        log.info("Fetching all sessions (history)");
        List<Session> sessions = sessionRepository.findAll();
        return sessions.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public SessionDTO deactivateSession(Long id) {
        log.info("Deactivating session with ID: {}", id);
        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Session not found with ID: " + id));
        
        session.setIsActive(false);
        session = sessionRepository.save(session);
        
        return convertToDTO(session);
    }

    @Transactional
    public void incrementParticipantCount(String sessionCode) {
        log.info("Incrementing participant count for session: {}", sessionCode);
        Session session = sessionRepository.findBySessionCode(sessionCode)
                .orElseThrow(() -> new RuntimeException("Session not found with code: " + sessionCode));
        
        session.setParticipantCount(session.getParticipantCount() + 1);
        sessionRepository.save(session);
    }

    @Transactional
    public void incrementReportCount(String sessionCode) {
        log.info("Incrementing report count for session: {}", sessionCode);
        Session session = sessionRepository.findBySessionCode(sessionCode)
                .orElseThrow(() -> new RuntimeException("Session not found with code: " + sessionCode));
        
        session.setReportCount(session.getReportCount() + 1);
        sessionRepository.save(session);
    }

    @Transactional
    public void cleanupExpiredSessions() {
        log.info("Cleaning up expired sessions");
        List<Session> expiredSessions = sessionRepository.findExpiredSessions(LocalDateTime.now());
        
        for (Session session : expiredSessions) {
            session.setIsActive(false);
            sessionRepository.save(session);
        }
        
        log.info("Deactivated {} expired sessions", expiredSessions.size());
    }

    private SessionDTO convertToDTO(Session session) {
        // Calculate duration in hours from createdAt and expiresAt
        double durationHours = 0.0;
        if (session.getCreatedAt() != null && session.getExpiresAt() != null) {
            long minutes = java.time.Duration.between(session.getCreatedAt(), session.getExpiresAt()).toMinutes();
            durationHours = minutes / 60.0;
        }
        
        return SessionDTO.builder()
                .id(session.getId())
                .sessionCode(session.getSessionCode())
                .title(session.getTitle())
                .instructorId(session.getInstructorId())
                .instructorUsername(session.getInstructorUsername())
                .instructorEmail(session.getInstructorEmail())
                .durationHours(durationHours)
                .createdAt(session.getCreatedAt())
                .expiresAt(session.getExpiresAt())
                .isActive(session.getIsActive())
                .isExpired(session.isExpired())
                .participantCount(session.getParticipantCount())
                .reportCount(session.getReportCount())
                .build();
    }
}
