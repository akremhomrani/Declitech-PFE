package com.declitech.report.controller;

import com.declitech.report.dto.AlertEvent;
import com.declitech.report.service.AlertKafkaConsumer;
import com.declitech.report.service.AlertKafkaProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class SseController {

    private final AlertKafkaConsumer alertKafkaConsumer;
    private final AlertKafkaProducer alertKafkaProducer;
    private final ScheduledExecutorService executor = Executors.newScheduledThreadPool(10);

    /**
     * Endpoint pour publier une alerte depuis l'extension
     * URL: POST /api/alerts/publish
     */
    @PostMapping("/publish")
    public ResponseEntity<Map<String, Object>> publishAlert(@RequestBody AlertEvent alertEvent) {
        log.info("📨 Received alert from extension: {} - {}", alertEvent.getAlertType(), alertEvent.getMessage());
        
        alertKafkaProducer.publishAlert(alertEvent);
        
        Map<String, Object> response = new HashMap<>();
        response.put("status", "published");
        response.put("alertType", alertEvent.getAlertType());
        response.put("sessionId", alertEvent.getSessionId());
        response.put("timestamp", System.currentTimeMillis());
        
        return ResponseEntity.ok(response);
    }

    /**
     * Endpoint SSE pour recevoir les alertes en temps réel
     * URL: /api/alerts/stream?sessionId=XXX
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamAlerts(@RequestParam String sessionId) {
        log.info("📡 New SSE connection request for session: {}", sessionId);

        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE); // Pas de timeout

        try {
            // Enregistrer l'emitter auprès du consumer
            alertKafkaConsumer.registerEmitter(sessionId, emitter);

            // Envoyer un message de connexion
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data(Map.of(
                            "message", "SSE connection established",
                            "sessionId", sessionId,
                            "timestamp", System.currentTimeMillis()
                    )));

            // Heartbeat pour maintenir la connexion
            executor.scheduleAtFixedRate(() -> {
                try {
                    emitter.send(SseEmitter.event()
                            .name("heartbeat")
                            .data(Map.of("timestamp", System.currentTimeMillis())));
                } catch (IOException e) {
                    log.debug("Heartbeat failed, client probably disconnected");
                    emitter.complete();
                }
            }, 30, 30, TimeUnit.SECONDS);

        } catch (IOException e) {
            log.error("❌ Error establishing SSE connection: {}", e.getMessage());
            emitter.completeWithError(e);
        }

        return emitter;
    }

    /**
     * Endpoint pour vérifier le statut du service SSE
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("service", "SSE Alert Service");
        status.put("status", "running");
        status.put("activeConnections", alertKafkaConsumer.getTotalActiveConnections());
        status.put("timestamp", System.currentTimeMillis());
        
        log.info("📊 SSE Status check: {} active connections", alertKafkaConsumer.getTotalActiveConnections());
        
        return ResponseEntity.ok(status);
    }
}
