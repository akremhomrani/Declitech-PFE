package com.declitech.report.controller;

import com.declitech.report.dto.AlertEvent;
import com.declitech.report.service.AlertKafkaConsumer;
import com.declitech.report.service.AlertKafkaProducer;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", allowedHeaders = "*")
public class SseController {

    private final AlertKafkaConsumer alertKafkaConsumer;
    private final AlertKafkaProducer alertKafkaProducer;
    private final ScheduledExecutorService executor = Executors.newScheduledThreadPool(10);

    /**
     * Reçoit une alerte (depuis l'extension Chrome) et la diffuse en double voie :
     *  1. Directement aux SSE emitters actifs (latence zéro)
     *  2. Via Kafka pour la persistance et les autres consommateurs
     */
    @PostMapping("/publish")
    public ResponseEntity<Map<String, Object>> publishAlert(@RequestBody AlertEvent alertEvent) {

        // Corriger le timestamp si absent
        if (alertEvent.getTimestamp() == null) {
            alertEvent.setTimestamp(LocalDateTime.now());
        }

        // ✅ Diffusion directe SSE — latence zéro, pas besoin de Kafka actif
        alertKafkaConsumer.broadcastToSession(alertEvent.getSessionId(), alertEvent);

        // Kafka (persistance / autres consumers) — erreur silencieuse si Kafka est down
        try {
            alertKafkaProducer.publishAlert(alertEvent);
        } catch (Exception ignored) {
            // Kafka indisponible → l'alerte SSE a déjà été diffusée, on continue
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", "published");
        response.put("alertType", alertEvent.getAlertType());
        response.put("sessionId", alertEvent.getSessionId());
        response.put("timestamp", System.currentTimeMillis());

        return ResponseEntity.ok(response);
    }

    /**
     * Endpoint SSE — le frontend Angular s'y abonne via EventSource.
     * Le header CORS est ajouté manuellement pour garantir la compatibilité SSE.
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamAlerts(
            @RequestParam String sessionId,
            jakarta.servlet.http.HttpServletResponse httpResponse) {

        // CORS explicite pour SSE (EventSource ne passe pas par @CrossOrigin normalement)
        httpResponse.setHeader("Access-Control-Allow-Origin", "*");
        httpResponse.setHeader("Access-Control-Allow-Headers", "*");
        httpResponse.setHeader("Cache-Control", "no-cache");
        httpResponse.setHeader("X-Accel-Buffering", "no"); // désactive le buffering nginx

        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);

        try {
            alertKafkaConsumer.registerEmitter(sessionId, emitter);

            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data(Map.of(
                            "message", "SSE connection established",
                            "sessionId", sessionId,
                            "timestamp", System.currentTimeMillis()
                    )));

            // Heartbeat toutes les 25 secondes pour garder la connexion alive
            executor.scheduleAtFixedRate(() -> {
                try {
                    emitter.send(SseEmitter.event()
                            .name("heartbeat")
                            .data(Map.of("timestamp", System.currentTimeMillis())));
                } catch (IOException e) {
                    emitter.complete();
                }
            }, 25, 25, TimeUnit.SECONDS);

        } catch (IOException e) {
            emitter.completeWithError(e);
        }

        return emitter;
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("service", "SSE Alert Service");
        status.put("status", "running");
        status.put("activeConnections", alertKafkaConsumer.getTotalActiveConnections());
        status.put("timestamp", System.currentTimeMillis());

        return ResponseEntity.ok(status);
    }
}
