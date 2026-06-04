package com.declitech.report.controller;

import com.declitech.report.dto.EmotionReportDTO;
import com.declitech.report.dto.agent.AnalysisSampleRequest;
import com.declitech.report.dto.agent.DomCodeRequest;
import com.declitech.report.dto.agent.EmotionFrameRequest;
import com.declitech.report.dto.agent.PedagogyProgressRequest;
import com.declitech.report.dto.agent.ScreenAnalysisResult;
import com.declitech.report.dto.agent.SessionAnalysisSummary;
import com.declitech.report.dto.agent.SessionValidationResponse;
import com.declitech.report.model.StudentActivityReport;
import com.declitech.report.repository.StudentActivityReportRepository;
import com.declitech.report.service.EmotionReportService;
import com.declitech.report.service.agent.AnalysisStore;
import com.declitech.report.service.agent.DomCodeService;
import com.declitech.report.service.agent.EmotionTimelineService;
import com.declitech.report.service.agent.ScreenAnalysisService;
import com.declitech.report.service.agent.SessionSummaryService;
import com.declitech.report.service.agent.SessionValidationService;
import com.declitech.report.service.agent.StudentReportService;

import java.util.List;
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
    private final ScreenAnalysisService screenAnalysisService;
    private final SessionSummaryService sessionSummaryService;
    private final AnalysisStore analysisStore;
    private final DomCodeService domCodeService;
    private final StudentReportService studentReportService;
    private final StudentActivityReportRepository studentActivityReportRepository;

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
        sessionSummaryService.buildAndStore(sessionId, sessionCode, loginIdentity);
        studentReportService.generate(sessionCode == null ? "LOCAL" : sessionCode, loginIdentity);
        return ResponseEntity.ok(Map.of("status", "FINALIZED"));
    }

    @PostMapping("/analysis")
    public ResponseEntity<Map<String, Object>> analysis(@RequestBody AnalysisSampleRequest request) {
        String status = screenAnalysisService.analyze(request);
        return ResponseEntity.ok(Map.of("status", status));
    }

    @PostMapping("/session-report")
    public ResponseEntity<Map<String, Object>> generateSessionReport(@RequestBody Map<String, Object> body) {
        String sessionCode = body.get("sessionCode") == null ? "LOCAL" : String.valueOf(body.get("sessionCode"));
        String loginIdentity = body.get("loginIdentity") == null ? null : String.valueOf(body.get("loginIdentity"));
        if (loginIdentity == null || loginIdentity.isBlank()) {
            return ResponseEntity.ok(Map.of("status", "SKIPPED", "reason", "no_identity"));
        }
        StudentActivityReport report = studentReportService.generate(sessionCode, loginIdentity);
        if (report == null) return ResponseEntity.ok(Map.of("status", "EMPTY"));
        return ResponseEntity.ok(Map.of("status", "GENERATED", "report", report));
    }

    @GetMapping("/session-report/{sessionCode}/{loginIdentity}")
    public ResponseEntity<StudentActivityReport> readSessionReport(@PathVariable String sessionCode,
                                                                   @PathVariable String loginIdentity) {
        return studentActivityReportRepository
                .findTopBySessionCodeAndStudentLoginIdentityOrderByGeneratedAtDesc(sessionCode, loginIdentity)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/output-vision")
    public ResponseEntity<Map<String, Object>> outputVision(@RequestBody AnalysisSampleRequest request) {
        if (request.getStudentLoginIdentity() == null || request.getStudentLoginIdentity().isBlank()) {
            return ResponseEntity.ok(Map.of("status", "SKIPPED", "reason", "no_identity"));
        }
        String output = screenAnalysisService.extractOutput(request);
        return ResponseEntity.ok(Map.of(
                "status", "STORED",
                "output", output == null ? "" : output
        ));
    }

    @PostMapping("/dom-code")
    public ResponseEntity<Map<String, Object>> domCode(@RequestBody DomCodeRequest request) {
        if (request.getStudentLoginIdentity() == null || request.getStudentLoginIdentity().isBlank()) {
            return ResponseEntity.ok(Map.of("status", "SKIPPED", "reason", "no_identity"));
        }
        int count = domCodeService.append(request);
        log.info("dom-code stored session={} student={} source={} frame={} codeLen={} total={}",
                request.getSessionCode(), request.getStudentLoginIdentity(), request.getSource(),
                request.getFrameUrl(), request.getCode() == null ? 0 : request.getCode().length(), count);
        return ResponseEntity.ok(Map.of("status", "STORED", "count", count));
    }

    @GetMapping("/dom-code/{sessionCode}/{loginIdentity}")
    public ResponseEntity<List<Map<String, Object>>> readDomCode(@PathVariable String sessionCode,
                                                                 @PathVariable String loginIdentity) {
        return ResponseEntity.ok(domCodeService.read(sessionCode, loginIdentity));
    }

    @GetMapping("/analysis/{sessionCode}/{loginIdentity}")
    public ResponseEntity<List<ScreenAnalysisResult>> readAnalysis(@PathVariable String sessionCode,
                                                                   @PathVariable String loginIdentity) {
        return ResponseEntity.ok(analysisStore.read(sessionCode, loginIdentity));
    }

    @PostMapping("/summary")
    public ResponseEntity<Map<String, Object>> generateSummary(@RequestBody Map<String, Object> body) {
        String sessionId = String.valueOf(body.getOrDefault("sessionId", ""));
        String sessionCode = body.get("sessionCode") == null ? null : String.valueOf(body.get("sessionCode"));
        String loginIdentity = body.get("loginIdentity") == null ? null : String.valueOf(body.get("loginIdentity"));
        if (loginIdentity == null || loginIdentity.isBlank()) {
            return ResponseEntity.ok(Map.of("status", "SKIPPED", "reason", "no_identity"));
        }
        SessionAnalysisSummary summary = sessionSummaryService.buildAndStore(sessionId, sessionCode, loginIdentity);
        if (summary == null) {
            return ResponseEntity.ok(Map.of("status", "EMPTY"));
        }
        return ResponseEntity.ok(Map.of("status", "GENERATED", "summary", summary));
    }

    @GetMapping("/summary/{sessionCode}/{loginIdentity}")
    public ResponseEntity<SessionAnalysisSummary> readSummary(@PathVariable String sessionCode,
                                                              @PathVariable String loginIdentity) {
        SessionAnalysisSummary summary = analysisStore.readSummary(sessionCode, loginIdentity);
        if (summary == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(summary);
    }
}
