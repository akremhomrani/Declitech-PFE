package com.declitech.report.controller;

import com.declitech.report.dto.EmotionReportDTO;
import com.declitech.report.model.EmotionReport;
import com.declitech.report.service.EmotionReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class EmotionReportController {

    private final EmotionReportService reportService;

    @PostMapping("/import")
    public ResponseEntity<?> importReportFromJson(@RequestParam String filePath) {
        try {
            EmotionReport report = reportService.importReportFromJson(filePath);
            return ResponseEntity.ok(Map.of(
                "message", "Report imported successfully",
                "sessionId", String.valueOf(report.getSessionId()),
                "studentLoginIdentity", report.getStudentLoginIdentity()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    @PostMapping
    public ResponseEntity<?> createReport(@Valid @RequestBody EmotionReportDTO reportDTO) {
        try {
            EmotionReport report = reportService.saveReportFromDTO(reportDTO);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Report saved successfully",
                "id", report.getId(),
                "sessionId", String.valueOf(report.getSessionId())
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    @GetMapping("/session/{sessionId}")
    public ResponseEntity<List<EmotionReport>> getReportsBySessionId(@PathVariable Long sessionId) {
        return ResponseEntity.ok(reportService.getReportsBySessionId(sessionId));
    }

    @GetMapping("/session-code/{sessionCode}")
    public ResponseEntity<List<EmotionReport>> getReportsBySessionCode(@PathVariable String sessionCode) {
        return ResponseEntity.ok(reportService.getReportsBySessionCode(sessionCode));
    }

    @GetMapping("/count")
    public ResponseEntity<Integer> getReportCount(
            @RequestParam(required = false) Long sessionId,
            @RequestParam(required = false) String sessionCode) {
        if (sessionCode != null && !sessionCode.isBlank()) {
            return ResponseEntity.ok(reportService.getReportCountBySessionCode(sessionCode));
        }
        if (sessionId != null) {
            return ResponseEntity.ok(reportService.getReportCountBySessionId(sessionId));
        }
        return ResponseEntity.badRequest().build();
    }

    @GetMapping("/participants/count")
    public ResponseEntity<Long> getParticipantCountBySessionId(@RequestParam Long sessionId) {
        return ResponseEntity.ok(reportService.getDistinctParticipantCountBySessionId(sessionId));
    }

    @GetMapping("/student/{studentLoginIdentity}")
    public ResponseEntity<List<EmotionReport>> getStudentReports(@PathVariable String studentLoginIdentity) {
        return ResponseEntity.ok(reportService.getReportsByStudentLoginIdentity(studentLoginIdentity));
    }

    @GetMapping("/student/{studentLoginIdentity}/statistics")
    public ResponseEntity<Map<String, Object>> getStudentStatistics(@PathVariable String studentLoginIdentity) {
        return ResponseEntity.ok(reportService.getStudentStatistics(studentLoginIdentity));
    }

    @GetMapping
    public ResponseEntity<List<EmotionReport>> getAllReports() {
        return ResponseEntity.ok(reportService.getAllReports());
    }

    @GetMapping("/date-range")
    public ResponseEntity<List<EmotionReport>> getReportsByDateRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return ResponseEntity.ok(reportService.getReportsByDateRange(start, end));
    }

    @GetMapping("/student/{studentLoginIdentity}/date-range")
    public ResponseEntity<List<EmotionReport>> getStudentReportsByDateRange(
            @PathVariable String studentLoginIdentity,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return ResponseEntity.ok(reportService.getStudentReportsByDateRange(studentLoginIdentity, start, end));
    }

    @PatchMapping("/{id}/note")
    public ResponseEntity<?> updateNote(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String note = body.getOrDefault("note", "");
        return reportService.updateInstructorNote(id, note)
                .<ResponseEntity<?>>map(r -> ResponseEntity.ok(
                    Map.of("id", r.getId(), "note", r.getInstructorNote() != null ? r.getInstructorNote() : "")))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "report-service",
            "timestamp", LocalDateTime.now().toString()
        ));
    }

    @GetMapping("/emotions/live/{sessionKey}/{studentLoginIdentity}")
    public ResponseEntity<List<String>> getLiveTimeline(
            @PathVariable String sessionKey,
            @PathVariable String studentLoginIdentity) {
        return ResponseEntity.ok(reportService.getLiveTimelineFromRedis(sessionKey, studentLoginIdentity));
    }
}
