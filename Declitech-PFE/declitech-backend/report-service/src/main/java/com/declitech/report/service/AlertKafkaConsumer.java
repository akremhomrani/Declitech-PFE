package com.declitech.report.service;

import com.declitech.report.dto.AlertEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
@RequiredArgsConstructor
public class AlertKafkaConsumer {

    private final Map<String, CopyOnWriteArrayList<SseEmitter>> sessionEmitters = new ConcurrentHashMap<>();

    @KafkaListener(topics = "${spring.kafka.topic.participant-alerts}", groupId = "${spring.kafka.consumer.group-id}")
    public void consumeAlert(AlertEvent alertEvent) {
        broadcastToSession(alertEvent.getSessionId(), alertEvent);
    }

    public void registerEmitter(String sessionId, SseEmitter emitter) {
        sessionEmitters.computeIfAbsent(sessionId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> removeEmitter(sessionId, emitter));
        emitter.onTimeout(() -> removeEmitter(sessionId, emitter));
        emitter.onError(e -> removeEmitter(sessionId, emitter));
    }

    private void removeEmitter(String sessionId, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> emitters = sessionEmitters.get(sessionId);
        if (emitters != null) {
            emitters.remove(emitter);
            
            if (emitters.isEmpty()) {
                sessionEmitters.remove(sessionId);
            }
        }
    }

    public void broadcastToSession(String sessionId, AlertEvent alertEvent) {
        CopyOnWriteArrayList<SseEmitter> emitters = sessionEmitters.get(sessionId);
        
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        emitters.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event()
                        .name("alert")
                        .data(alertEvent));
            } catch (IOException e) {
                removeEmitter(sessionId, emitter);
            }
        });
    }

    public int getActiveConnectionsForSession(String sessionId) {
        CopyOnWriteArrayList<SseEmitter> emitters = sessionEmitters.get(sessionId);
        return emitters != null ? emitters.size() : 0;
    }

    public int getTotalActiveConnections() {
        return sessionEmitters.values().stream()
                .mapToInt(CopyOnWriteArrayList::size)
                .sum();
    }
}
