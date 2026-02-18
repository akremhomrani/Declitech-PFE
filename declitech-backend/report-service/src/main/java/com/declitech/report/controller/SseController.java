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
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class SseController {

    private final AlertKafkaConsumer alertKafkaConsumer;
    private final AlertKafkaProducer alertKafkaProducer;
    private final ScheduledExecutorService executor = Executors.newScheduledThreadPool(10);

    @PostMapping("/publish")
    public ResponseEntity<Map<String, Object>> publishAlert(@RequestBody AlertEvent alertEvent) {
        alertKafkaProducer.publishAlert(alertEvent);
        
        Map<String, Object> response = new HashMap<>();
        response.put("status", "published");
        response.put("alertType", alertEvent.getAlertType());
        response.put("sessionId", alertEvent.getSessionId());
        response.put("timestamp", System.currentTimeMillis());
        
        return ResponseEntity.ok(response);
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamAlerts(@RequestParam String sessionId) {
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

            executor.scheduleAtFixedRate(() -> {
                try {
                    emitter.send(SseEmitter.event()
                            .name("heartbeat")
                            .data(Map.of("timestamp", System.currentTimeMillis())));
                } catch (IOException e) {
                    emitter.complete();
                }
            }, 30, 30, TimeUnit.SECONDS);

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
