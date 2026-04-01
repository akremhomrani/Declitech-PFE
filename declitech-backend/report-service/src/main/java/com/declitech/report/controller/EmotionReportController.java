package com.declitech.report.controller;

import com.declitech.report.dto.EmotionReportDTO;
import com.declitech.report.model.EmotionReport;
import com.declitech.report.service.EmotionReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;

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
                "sessionId", report.getSessionId(),
                "studentLoginIdentity", report.getStudentLoginIdentity()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", String.valueOf(e.getMessage())));
        }
    }

    @GetMapping("/session/{sessionId}")
    public ResponseEntity<?> getReportBySessionId(@PathVariable String sessionId) {
        return reportService.getReportBySessionId(sessionId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/session-code/{sessionCode}")
    public ResponseEntity<List<EmotionReport>> getReportsBySessionCode(@PathVariable String sessionCode) {
        List<EmotionReport> reports = reportService.getReportsBySessionCode(sessionCode);
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/session-id/{sessionId}")
    public ResponseEntity<List<EmotionReport>> getReportsByNumericSessionId(@PathVariable Long sessionId) {
        List<EmotionReport> reports = reportService.getReportsByNumericSessionId(sessionId);
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/count")
    public ResponseEntity<Integer> getReportCountBySessionCode(@RequestParam String sessionCode) {
        Integer count = reportService.getReportCountBySessionCode(sessionCode);
        return ResponseEntity.ok(count);
    }

    @GetMapping("/participants/count")
    public ResponseEntity<Long> getParticipantCountBySessionCode(@RequestParam String sessionCode) {
        Long count = reportService.getDistinctParticipantCountBySessionCode(sessionCode);
        return ResponseEntity.ok(count);
    }

    @GetMapping("/student/{studentLoginIdentity}")
    public ResponseEntity<List<EmotionReport>> getStudentReports(
            @PathVariable String studentLoginIdentity) {
        List<EmotionReport> reports = reportService.getReportsByStudentLoginIdentity(studentLoginIdentity);
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/student/{studentLoginIdentity}/statistics")
    public ResponseEntity<Map<String, Object>> getStudentStatistics(
            @PathVariable String studentLoginIdentity) {
        Map<String, Object> stats = reportService.getStudentStatistics(studentLoginIdentity);
        return ResponseEntity.ok(stats);
    }

    @GetMapping
    public ResponseEntity<List<EmotionReport>> getAllReports() {
        List<EmotionReport> reports = reportService.getAllReports();
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/date-range")
    public ResponseEntity<List<EmotionReport>> getReportsByDateRange(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        List<EmotionReport> reports = reportService.getReportsByDateRange(start, end);
        return ResponseEntity.ok(reports);
    }

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

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "report-service",
            "timestamp", LocalDateTime.now().toString()
        ));
    }

    @GetMapping("/emotions/live/{sessionCode}/{studentLoginIdentity}")
    public ResponseEntity<List<String>> getLiveTimeline(
            @PathVariable String sessionCode,
            @PathVariable String studentLoginIdentity) {
        List<String> timeline = reportService.getLiveTimelineFromRedis(sessionCode, studentLoginIdentity);
        return ResponseEntity.ok(timeline);
    }
}
