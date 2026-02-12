package com.declitech.report.controller;

import com.declitech.report.model.EmotionReport;
import com.declitech.report.repository.EmotionReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class SessionController {

    private final EmotionReportRepository emotionReportRepository;

    /**
     * Récupère la session active la plus récente
     * Utilisé par le dashboard pour synchroniser le sessionId avec l'extension
     */
    @GetMapping("/active")
    public ResponseEntity<Map<String, Object>> getActiveSession() {
        log.info("📡 Request for active session");

        // Récupérer tous les rapports IN_PROGRESS triés par date de création (le plus récent en premier)
        List<EmotionReport> activeReports = emotionReportRepository
                .findByStatusOrderByCreatedAtDesc(EmotionReport.SessionStatus.IN_PROGRESS);

        if (activeReports.isEmpty()) {
            log.warn("⚠️ No active session found");
            return ResponseEntity.ok(Map.of(
                    "hasActiveSession", false,
                    "message", "No active session found"
            ));
        }

        // Prendre la session la plus récente
        EmotionReport latestReport = activeReports.get(0);

        Map<String, Object> response = new HashMap<>();
        response.put("hasActiveSession", true);
        response.put("sessionId", latestReport.getSessionId());
        response.put("participantId", latestReport.getParticipantId());
        response.put("studentLoginIdentity", latestReport.getStudentLoginIdentity());
        response.put("sessionStartedAt", latestReport.getCreatedAt());
        response.put("totalActiveSessions", activeReports.size());

        log.info("✅ Active session found: {} (participant: {})", 
                latestReport.getSessionId(), latestReport.getParticipantId());

        return ResponseEntity.ok(response);
    }

    /**
     * Récupère toutes les sessions actives
     */
    @GetMapping("/active/all")
    public ResponseEntity<List<EmotionReport>> getAllActiveSessions() {
        log.info("📡 Request for all active sessions");
        
        List<EmotionReport> activeReports = emotionReportRepository
                .findByStatusOrderByCreatedAtDesc(EmotionReport.SessionStatus.IN_PROGRESS);

        log.info("✅ Found {} active session(s)", activeReports.size());
        
        return ResponseEntity.ok(activeReports);
    }
}
