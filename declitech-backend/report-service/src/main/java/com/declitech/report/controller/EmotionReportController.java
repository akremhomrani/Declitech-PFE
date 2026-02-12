package com.declitech.report.controller;

import com.declitech.report.dto.EmotionReportDTO;
import com.declitech.report.model.EmotionReport;
import com.declitech.report.service.EmotionReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
@CrossOrigin(origins = "*")
public class EmotionReportController {

    private final EmotionReportService reportService;

    /**
     * Import report from Python agent's JSON file
     */
    @PostMapping("/import")
    public ResponseEntity<?> importReportFromJson(@RequestParam String filePath) {
        try {
            EmotionReport report = reportService.importReportFromJson(filePath);
            return ResponseEntity.ok(Map.of(
                "message", "Report imported successfully",
                "sessionId", report.getSessionId(),
                "studentLoginIdentity", report.getStudentLoginIdentity()
            ));
        } catch (Exception e) {
            log.error("Failed to import report", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Receive report directly from Python agent
     */
    @PostMapping
    public ResponseEntity<?> createReport(@RequestBody EmotionReportDTO reportDTO) {
        try {
            EmotionReport report = reportService.saveReportFromDTO(reportDTO);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Report saved successfully",
                "id", report.getId(),
                "sessionId", report.getSessionId()
            ));
        } catch (Exception e) {
            log.error("Failed to save report", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get report by session ID
     */
    @GetMapping("/session/{sessionId}")
    public ResponseEntity<?> getReportBySessionId(@PathVariable String sessionId) {
        return reportService.getReportBySessionId(sessionId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get all reports for a session by session code
     */
    @GetMapping("/session-code/{sessionCode}")
    public ResponseEntity<List<EmotionReport>> getReportsBySessionCode(@PathVariable String sessionCode) {
        List<EmotionReport> reports = reportService.getReportsBySessionCode(sessionCode);
        return ResponseEntity.ok(reports);
    }

    /**
     * Get count of reports for a session by session code
     */
    @GetMapping("/count")
    public ResponseEntity<Integer> getReportCountBySessionCode(@RequestParam String sessionCode) {
        Integer count = reportService.getReportCountBySessionCode(sessionCode);
        return ResponseEntity.ok(count);
    }

    /**
     * Get all reports for a student by login identity
     */
    @GetMapping("/student/{studentLoginIdentity}")
    public ResponseEntity<List<EmotionReport>> getStudentReports(
            @PathVariable String studentLoginIdentity) {
        List<EmotionReport> reports = reportService.getReportsByStudentLoginIdentity(studentLoginIdentity);
        return ResponseEntity.ok(reports);
    }

    /**
     * Get student statistics
     */
    @GetMapping("/student/{studentLoginIdentity}/statistics")
    public ResponseEntity<Map<String, Object>> getStudentStatistics(
            @PathVariable String studentLoginIdentity) {
        Map<String, Object> stats = reportService.getStudentStatistics(studentLoginIdentity);
        return ResponseEntity.ok(stats);
    }

    /**
     * Get all reports
     */
    @GetMapping
    public ResponseEntity<List<EmotionReport>> getAllReports() {
        List<EmotionReport> reports = reportService.getAllReports();
        return ResponseEntity.ok(reports);
    }

    /**
     * Get reports by date range
     */
    @GetMapping("/date-range")
    public ResponseEntity<List<EmotionReport>> getReportsByDateRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        List<EmotionReport> reports = reportService.getReportsByDateRange(start, end);
        return ResponseEntity.ok(reports);
    }

    /**
     * Get student reports by date range
     */
    @GetMapping("/student/{studentLoginIdentity}/date-range")
    public ResponseEntity<List<EmotionReport>> getStudentReportsByDateRange(
            @PathVariable String studentLoginIdentity,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        List<EmotionReport> reports = reportService.getStudentReportsByDateRange(
            studentLoginIdentity, start, end
        );
        return ResponseEntity.ok(reports);
    }

    /**
     * Health check
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "report-service",
            "timestamp", LocalDateTime.now().toString()
        ));
    }
}
