package com.declitech.session.controller;

import com.declitech.session.dto.CreateSessionRequest;
import com.declitech.session.dto.PagedSessionResponse;
import com.declitech.session.dto.SessionDTO;
import com.declitech.session.dto.SessionFilterRequest;
import com.declitech.session.service.SessionService;
import com.declitech.session.util.JwtTokenProvider;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;
    private final JwtTokenProvider jwtTokenProvider;

    @PostMapping
    public ResponseEntity<SessionDTO> createSession(
            @Valid @RequestBody CreateSessionRequest request,
            @CookieValue(value = "accessToken", required = false) String accessToken) {
        String username = jwtTokenProvider.extractUsernameFromToken(accessToken);
        if (username == null || username.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String firstName = jwtTokenProvider.extractFirstName(accessToken);
        String lastName  = jwtTokenProvider.extractLastName(accessToken);

        SessionDTO session = sessionService.createSession(username, firstName, lastName, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(session);
    }

    @GetMapping("/code/{sessionCode}")
    public ResponseEntity<SessionDTO> getSessionByCode(@PathVariable String sessionCode) {
        SessionDTO session = sessionService.getSessionByCode(sessionCode);
        return ResponseEntity.ok(session);
    }

    @GetMapping("/active")
    public ResponseEntity<List<SessionDTO>> getAllActiveSessions() {
        List<SessionDTO> sessions = sessionService.getAllActiveSessions();
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/history")
    public ResponseEntity<List<SessionDTO>> getAllSessions() {
        List<SessionDTO> sessions = sessionService.getAllSessions();
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/history/paginated")
    public ResponseEntity<PagedSessionResponse> getSessionsPaginated(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "sortBy", defaultValue = "createdAt") String sortBy,
            @RequestParam(name = "sortDirection", defaultValue = "DESC") String sortDirection,
            @RequestParam(name = "title", required = false) String title,
            @RequestParam(name = "sessionCode", required = false) String sessionCode,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "instructorUsername", required = false) String instructorUsername) {

        SessionFilterRequest filter = SessionFilterRequest.builder()
                .title(title)
                .sessionCode(sessionCode)
                .status(status)
                .search(search)
                .instructorUsername(instructorUsername)
                .build();

        PagedSessionResponse response = sessionService.getSessionsWithPagination(
                filter, page, size, sortBy, sortDirection);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/instructor/{instructorId}")
    public ResponseEntity<List<SessionDTO>> getSessionsByInstructor(@PathVariable Long instructorId) {
        List<SessionDTO> sessions = sessionService.getSessionsByInstructor(instructorId);
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/instructor/{instructorId}/active")
    public ResponseEntity<List<SessionDTO>> getActiveSessionsByInstructor(@PathVariable Long instructorId) {
        List<SessionDTO> sessions = sessionService.getActiveSessionsByInstructor(instructorId);
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/instructor/username/{username}")
    public ResponseEntity<List<SessionDTO>> getSessionsByUsername(@PathVariable String username) {
        List<SessionDTO> sessions = sessionService.getSessionsByUsername(username);
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/instructor/username/{username}/active")
    public ResponseEntity<List<SessionDTO>> getActiveSessionsByUsername(@PathVariable String username) {
        List<SessionDTO> sessions = sessionService.getActiveSessionsByUsername(username);
        return ResponseEntity.ok(sessions);
    }

    @GetMapping("/my")
    public ResponseEntity<List<SessionDTO>> getMySessions(
            @CookieValue(value = "accessToken", required = false) String accessToken) {
        String username = jwtTokenProvider.extractUsernameFromToken(accessToken);
        if (username == null || username.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(sessionService.getSessionsByUsername(username));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SessionDTO> getSessionById(@PathVariable Long id) {
        SessionDTO session = sessionService.getSessionById(id);
        return ResponseEntity.ok(session);
    }

    @GetMapping("/module/{moduleId}")
    public ResponseEntity<List<SessionDTO>> getSessionsByModuleId(@PathVariable Long moduleId) {
        List<SessionDTO> sessions = sessionService.getSessionsByModuleId(moduleId);
        return ResponseEntity.ok(sessions);
    }

    @PutMapping("/{id}/deactivate")
    public ResponseEntity<SessionDTO> deactivateSession(@PathVariable Long id) {
        SessionDTO session = sessionService.deactivateSession(id);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/{id}/end")
    public ResponseEntity<Void> endSession(@PathVariable Long id) {
        sessionService.deactivateSession(id);
        return ResponseEntity.ok().build();
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<String> handleRuntimeException(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
    }
}
