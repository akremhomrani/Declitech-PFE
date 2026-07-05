package com.declitech.report.controller;

import com.declitech.report.dto.AlertEvent;
import com.declitech.report.model.SessionAlert;
import com.declitech.report.service.AlertService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class SseController {

    private final AlertService alertService;
    private final ScheduledExecutorService executor = Executors.newScheduledThreadPool(10);

    /**
     * Reçoit une alerte depuis l'extension Chrome.
     * - Broadcast SSE immédiat (temps réel, bordure rouge sur le dashboard)
     * - Dedup 10s + buffer Redis (flush vers PostgreSQL à la fin de session)
     */
    @PostMapping("/publish")
    public ResponseEntity<Map<String, Object>> publishAlert(@RequestBody AlertEvent alertEvent) {
        if (alertEvent.getTimestamp() == null) {
            alertEvent.setTimestamp(LocalDateTime.now());
        }

        alertService.saveAndBroadcast(alertEvent);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "published");
        response.put("alertType", alertEvent.getAlertType());
        response.put("sessionId", alertEvent.getSessionId());
        response.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(response);
    }

    /**
     * Endpoint SSE — le frontend Angular s'y abonne via EventSource.
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamAlerts(
            @RequestParam String sessionId,
            jakarta.servlet.http.HttpServletResponse httpResponse) {

        // CORS is handled by the gateway's globalcors — do NOT set ACAO here
        // or the browser will see conflicting headers and reject the SSE connection.
        httpResponse.setHeader("Cache-Control", "no-cache");
        httpResponse.setHeader("X-Accel-Buffering", "no");

        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);

        try {
            alertService.registerEmitter(sessionId, emitter);

            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data(Map.of(
                            "message", "SSE connection established",
                            "sessionId", sessionId,
                            "timestamp", System.currentTimeMillis())));

            // Heartbeat toutes les 25 secondes — cancel on emitter completion to
            // avoid a runaway scheduled task per connection.
            java.util.concurrent.ScheduledFuture<?>[] heartbeatHandle = new java.util.concurrent.ScheduledFuture<?>[1];
            heartbeatHandle[0] = executor.scheduleAtFixedRate(() -> {
                try {
                    emitter.send(SseEmitter.event()
                            .name("heartbeat")
                            .data(Map.of("timestamp", System.currentTimeMillis())));
                } catch (IOException e) {
                    if (heartbeatHandle[0] != null) heartbeatHandle[0].cancel(false);
                    emitter.complete();
                }
            }, 25, 25, TimeUnit.SECONDS);

            Runnable cancelHeartbeat = () -> {
                if (heartbeatHandle[0] != null) heartbeatHandle[0].cancel(false);
            };
            emitter.onCompletion(cancelHeartbeat);
            emitter.onTimeout(cancelHeartbeat);
            emitter.onError(e -> cancelHeartbeat.run());

        } catch (IOException e) {
            emitter.completeWithError(e);
        }

        return emitter;
    }

    /**
     * Retourne les alertes pour un étudiant dans une session.
     * Vérifie d'abord la DB, puis Redis (session en cours ou rapport pas encore
     * flushé).
     * Si des alertes Redis existent, les persiste et les retourne.
     */
    @GetMapping("/session/{sessionId}/student/{studentLoginIdentity}")
    public ResponseEntity<List<SessionAlert>> getAlertsForStudent(
            @PathVariable String sessionId,
            @PathVariable String studentLoginIdentity) {
        // Try DB first
        List<SessionAlert> dbAlerts = alertService.getAlertsBySessionAndStudent(sessionId, studentLoginIdentity);
        if (!dbAlerts.isEmpty()) {
            return ResponseEntity.ok(dbAlerts);
        }
        // DB empty — flush from Redis (handles sessions ended before this code was
        // deployed)
        try {
            List<SessionAlert> flushed = alertService.flushAlertsToDb(sessionId, studentLoginIdentity);
            return ResponseEntity.ok(flushed);
        } catch (Exception e) {
            return ResponseEntity.ok(List.of());
        }
    }

    /**
     * Returns every alert for a session in a single response — frontend aggregates
     * per-student counts client-side. Replaces N+1 round trips on the session-details
     * page (audit H2). Reads only from the persisted DB; in-flight Redis-buffered
     * alerts are flushed on session end.
     */
    @GetMapping("/session/{sessionId}")
    public ResponseEntity<List<SessionAlert>> getAlertsForSession(@PathVariable String sessionId) {
        return ResponseEntity.ok(alertService.getLiveAlertsBySession(sessionId));
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("service", "Alert Service (Redis-backed)");
        status.put("status", "running");
        status.put("activeConnections", alertService.getTotalActiveConnections());
        status.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(status);
    }
}
