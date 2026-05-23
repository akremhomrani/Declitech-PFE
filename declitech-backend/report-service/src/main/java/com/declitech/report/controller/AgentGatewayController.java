package com.declitech.report.controller;

import com.declitech.report.dto.EmotionReportDTO;
import com.declitech.report.dto.agent.EmotionFrameRequest;
import com.declitech.report.dto.agent.PedagogyProgressRequest;
import com.declitech.report.dto.agent.SessionValidationResponse;
import com.declitech.report.service.EmotionReportService;
import com.declitech.report.service.agent.EmotionTimelineService;
import com.declitech.report.service.agent.SessionValidationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/agent")
@RequiredArgsConstructor
@Slf4j
public class AgentGatewayController {

    private final SessionValidationService sessionValidationService;
    private final EmotionReportService emotionReportService;
    private final EmotionTimelineService emotionTimelineService;

    @GetMapping("/")
    public ResponseEntity<Map<String, Object>> root() {
        return ResponseEntity.ok(Map.of(
                "ok", true,
                "name", "DecliTrack Agent Gateway",
                "version", "3.0.0"
        ));
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of(
                "running", true,
                "mode", "extension-native"
        ));
    }

    @GetMapping("/validate/{sessionCode}")
    public ResponseEntity<SessionValidationResponse> validate(@PathVariable String sessionCode) {
        return ResponseEntity.ok(sessionValidationService.validate(sessionCode));
    }

    @PostMapping("/start")
    public ResponseEntity<Map<String, Object>> start(@RequestBody Map<String, Object> body) {
        String code = String.valueOf(body.getOrDefault("code", ""));
        String loginIdentity = readLoginIdentity(body);

        SessionValidationResponse validation = sessionValidationService.validate(code);

        Long numericSessionId = extractNumericSessionId(validation);
        String sessionId = numericSessionId != null
                ? "SESSION-" + numericSessionId
                : (validation.isValid() ? "SESSION-" + code : "LOCAL-" + code);

        if (validation.isValid() && loginIdentity != null && !loginIdentity.isBlank()) {
            seedParticipantReport(sessionId, code, loginIdentity);
        } else {
            log.warn("Skip seeding participant — valid={} loginIdentity='{}'",
                    validation.isValid(), loginIdentity);
        }

        return ResponseEntity.ok(Map.of(
                "status", "STARTED",
                "session_id", sessionId,
                "valid", validation.isValid(),
                "reason", validation.getReason() == null ? "" : validation.getReason()
        ));
    }

    private String readLoginIdentity(Map<String, Object> body) {
        for (String key : new String[]{"loginIdentity", "login_identity", "studentLoginIdentity"}) {
            Object v = body.get(key);
            if (v != null && !String.valueOf(v).isBlank()) return String.valueOf(v).trim();
        }
        return null;
    }

    private Long extractNumericSessionId(SessionValidationResponse validation) {
        if (validation == null || validation.getSession() == null) return null;
        Object id = validation.getSession().get("id");
        if (id instanceof Number n) return n.longValue();
        try { return id == null ? null : Long.parseLong(String.valueOf(id)); }
        catch (NumberFormatException e) { return null; }
    }

    private void seedParticipantReport(String sessionId, String sessionCode, String loginIdentity) {
        try {
            EmotionReportDTO dto = new EmotionReportDTO();
            dto.setSessionId(sessionId);
            dto.setSessionCode(sessionCode);
            dto.setStudentLoginIdentity(loginIdentity);
            dto.setGeneratedAt(LocalDateTime.now());
            emotionReportService.saveReportFromDTO(dto);
            log.info("Seeded participant report sessionId={} student={}", sessionId, loginIdentity);
        } catch (Exception e) {
            log.warn("Failed to seed participant report sessionId={} student={}: {}",
                    sessionId, loginIdentity, e.getMessage());
        }
    }

    @PostMapping("/stop")
    public ResponseEntity<Map<String, Object>> stop() {
        return ResponseEntity.ok(Map.of("status", "STOPPED"));
    }

    @PostMapping("/pedagogy/progress")
    public ResponseEntity<Map<String, Object>> pedagogyProgress(@RequestBody PedagogyProgressRequest request) {
        log.info("pedagogy/progress session={} student={} platform={}",
                request.getSessionId(),
                request.getStudentLoginIdentity(),
                request.getPlatform());
        return ResponseEntity.ok(Map.of("status", "RECEIVED"));
    }

    @PostMapping("/emotion-frame")
    public ResponseEntity<Map<String, Object>> emotionFrame(@RequestBody EmotionFrameRequest request) {
        if (request.getStudentLoginIdentity() == null || request.getStudentLoginIdentity().isBlank()) {
            return ResponseEntity.ok(Map.of("status", "SKIPPED", "reason", "no_identity"));
        }
        emotionTimelineService.recordFrame(request);
        return ResponseEntity.ok(Map.of("status", "RECORDED"));
    }

    @PostMapping("/finalize")
    public ResponseEntity<Map<String, Object>> finalizeSession(@RequestBody Map<String, Object> body) {
        String sessionId = String.valueOf(body.getOrDefault("sessionId", ""));
        String sessionCode = body.get("sessionCode") == null ? null : String.valueOf(body.get("sessionCode"));
        String loginIdentity = body.get("loginIdentity") == null ? null : String.valueOf(body.get("loginIdentity"));
        if (loginIdentity == null || loginIdentity.isBlank()) {
            return ResponseEntity.ok(Map.of("status", "SKIPPED", "reason", "no_identity"));
        }
        emotionTimelineService.finalizeSession(sessionId, sessionCode, loginIdentity);
        return ResponseEntity.ok(Map.of("status", "FINALIZED"));
    }
}
