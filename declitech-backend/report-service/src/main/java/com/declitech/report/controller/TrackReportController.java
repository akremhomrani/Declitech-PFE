package com.declitech.report.controller;

import com.declitech.report.dto.TrackReportDTO;
import com.declitech.report.service.TrackReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reports/track")
@RequiredArgsConstructor
@Slf4j
public class TrackReportController {

    private final TrackReportService trackReportService;

    @PostMapping
    public ResponseEntity<TrackReportDTO> submitTrackReport(@RequestBody TrackReportDTO request) {
        try {
            TrackReportDTO created = trackReportService.createTrackReport(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (Exception e) {
            log.error("Failed to create track report: ", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/session/{sessionCode}")
    public ResponseEntity<List<TrackReportDTO>> getTrackReportsBySessionCode(@PathVariable String sessionCode) {
        List<TrackReportDTO> reports = trackReportService.getTrackReportsBySessionCode(sessionCode);
        return ResponseEntity.ok(reports);
    }

    @GetMapping("/student/{studentIdentity}")
    public ResponseEntity<List<TrackReportDTO>> getTrackReportsByStudentIdentity(@PathVariable String studentIdentity) {
        List<TrackReportDTO> reports = trackReportService.getTrackReportsByStudentIdentity(studentIdentity);
        return ResponseEntity.ok(reports);
    }

    @GetMapping
    public ResponseEntity<List<TrackReportDTO>> getAllTrackReports() {
        return ResponseEntity.ok(trackReportService.getAllTrackReports());
    }
}
