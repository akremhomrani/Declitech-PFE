package com.declitech.session.controller;

import com.declitech.session.dto.CreateSessionRequest;
import com.declitech.session.dto.JoinSessionRequest;
import com.declitech.session.dto.JoinSessionResponse;
import com.declitech.session.dto.PagedSessionResponse;
import com.declitech.session.dto.SessionDTO;
import com.declitech.session.dto.SessionFilterRequest;
import com.declitech.session.dto.SiteModuleDto;
import com.declitech.session.service.SessionService;
import com.declitech.session.util.JwtTokenProvider;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;
    private final JwtTokenProvider jwtTokenProvider;

    private static final String APP_SLUG = "declitrack";

    @PostMapping
    public ResponseEntity<SessionDTO> createSession(
            @Valid @RequestBody CreateSessionRequest request,
            @CookieValue(value = "accessToken", required = false) String accessToken,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String token = pickToken(accessToken, authHeader);
        String username = jwtTokenProvider.extractUsernameFromToken(token);
        if (username == null || username.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // IAM v6 enriched JWT — only staff (INSTRUCTEUR / FREELANCE / COLLABORATEUR) can create
        // monitoring sessions. STUDENT/PARENT have no business creating sessions on DecliTrack.
        // PARENT also has no apps[declitrack] entry → already blocked by the empty feature check below.
        if (jwtTokenProvider.extractAppFeatures(token, APP_SLUG).isEmpty() || !jwtTokenProvider.isStaff(token)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        // IAM v6 (2026-05-04) — capture site/module from JWT claims. INSTRUCTEUR/FREELANCE
        // are scoped to their `siteModules` slots; COLLABORATEUR carries a free-form `site` string.
        SiteModuleDto siteModule = null;
        String collaborateurSite = null;
        String userType = jwtTokenProvider.extractUserType(token);
        boolean isInstructorLike = "INSTRUCTEUR".equalsIgnoreCase(userType)
                || "FREELANCE".equalsIgnoreCase(userType);

        if (isInstructorLike && request.getModuleId() != null) {
            Optional<SiteModuleDto> match = jwtTokenProvider.findSiteModule(token, request.getModuleId());
            if (match.isEmpty()) {
                // Tentative de créer une session sur un module hors affectations → 403
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            siteModule = match.get();
        } else if ("COLLABORATEUR".equalsIgnoreCase(userType)) {
            collaborateurSite = jwtTokenProvider.extractSite(token);
        }

        String firstName = jwtTokenProvider.extractFirstName(token);
        String lastName  = jwtTokenProvider.extractLastName(token);

        SessionDTO session = sessionService.createSession(
                username, firstName, lastName, request, siteModule, collaborateurSite);
        return ResponseEntity.status(HttpStatus.CREATED).body(session);
    }

    private String pickToken(String cookieValue, String authHeader) {
        if (cookieValue != null && !cookieValue.isBlank()) return cookieValue;
        if (authHeader != null && authHeader.startsWith("Bearer ")) return authHeader.substring(7);
        return null;
    }

    @PostMapping("/join/{sessionCode}")
    public ResponseEntity<JoinSessionResponse> joinSession(
            @PathVariable String sessionCode,
            @Valid @RequestBody JoinSessionRequest request) {
        JoinSessionResponse response = sessionService.joinSession(sessionCode, request.getStudentLoginIdentity());
        return ResponseEntity.ok(response);
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
            @CookieValue(value = "accessToken", required = false) String accessToken,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String token = pickToken(accessToken, authHeader);
        String username = jwtTokenProvider.extractUsernameFromToken(token);
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
