package com.declitech.session.controller;

import com.declitech.session.dto.CreateSessionRequest;
import com.declitech.session.dto.SessionDTO;
import com.declitech.session.service.SessionService;
import com.declitech.session.util.JwtTokenProvider;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "http://localhost:4200", allowCredentials = "true")
public class SessionController {

    private final SessionService sessionService;
    private final JwtTokenProvider jwtTokenProvider;

    @PostMapping
    public ResponseEntity<SessionDTO> createSession(
            @Valid @RequestBody CreateSessionRequest request,
            @CookieValue(value = "accessToken", required = false) String accessToken) {
        log.info("POST /api/sessions - Creating new session");
        
        // Extract user ID from token
        Long instructorId = extractUserIdFromToken(accessToken);
        if (instructorId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new SessionDTO()); // Return empty with 401
        }

        SessionDTO session = sessionService.createSession(instructorId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(session);
    }

    @GetMapping("/code/{sessionCode}")
    public ResponseEntity<SessionDTO> getSessionByCode(@PathVariable String sessionCode) {
        log.info("GET /api/sessions/code/{} - Fetching session by code", sessionCode);
        SessionDTO session = sessionService.getSessionByCode(sessionCode);
        return ResponseEntity.ok(session);
    }

    @GetMapping("/active")
    public ResponseEntity<List<SessionDTO>> getAllActiveSessions() {
        log.info("GET /api/sessions/active - Fetching all active sessions");
        List<SessionDTO> sessions = sessionService.getAllActiveSessions();
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/history")
    public ResponseEntity<List<SessionDTO>> getAllSessions() {
        log.info("GET /api/sessions/history - Fetching all sessions (history)");
        List<SessionDTO> sessions = sessionService.getAllSessions();
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/instructor/{instructorId}")
    public ResponseEntity<List<SessionDTO>> getSessionsByInstructor(@PathVariable Long instructorId) {
        log.info("GET /api/sessions/instructor/{} - Fetching sessions for instructor", instructorId);
        List<SessionDTO> sessions = sessionService.getSessionsByInstructor(instructorId);
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/instructor/{instructorId}/active")
    public ResponseEntity<List<SessionDTO>> getActiveSessionsByInstructor(@PathVariable Long instructorId) {
        log.info("GET /api/sessions/instructor/{}/active - Fetching active sessions for instructor", instructorId);
        List<SessionDTO> sessions = sessionService.getActiveSessionsByInstructor(instructorId);
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SessionDTO> getSessionById(@PathVariable Long id) {
        log.info("GET /api/sessions/{} - Fetching session by ID", id);
        SessionDTO session = sessionService.getSessionById(id);
        return ResponseEntity.ok(session);
    }

    @PutMapping("/{id}/deactivate")
    public ResponseEntity<SessionDTO> deactivateSession(@PathVariable Long id) {
        log.info("PUT /api/sessions/{}/deactivate - Deactivating session", id);
        SessionDTO session = sessionService.deactivateSession(id);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/code/{sessionCode}/join")
    public ResponseEntity<Void> joinSession(@PathVariable String sessionCode) {
        log.info("POST /api/sessions/code/{}/join - Participant joining session", sessionCode);
        sessionService.incrementParticipantCount(sessionCode);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/code/{sessionCode}/report")
    public ResponseEntity<Void> addReport(@PathVariable String sessionCode) {
        log.info("POST /api/sessions/code/{}/report - Adding report to session", sessionCode);
        sessionService.incrementReportCount(sessionCode);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/cleanup")
    public ResponseEntity<Void> cleanupExpiredSessions() {
        log.info("POST /api/sessions/cleanup - Cleaning up expired sessions");
        sessionService.cleanupExpiredSessions();
        return ResponseEntity.ok().build();
    }

    private Long extractUserIdFromToken(String token) {
        if (token == null || token.isEmpty()) {
            log.error("Access token cookie is missing");
            return null;
        }
        
        Long userId = jwtTokenProvider.extractUserIdFromToken(token);
        if (userId == null) {
            log.error("Failed to extract user ID from token");
        }
        return userId;
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<String> handleRuntimeException(RuntimeException e) {
        log.error("Error occurred: ", e);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
    }
}
