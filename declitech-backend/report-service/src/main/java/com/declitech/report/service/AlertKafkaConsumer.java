package com.declitech.report.service;

import com.declitech.report.dto.AlertEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
@RequiredArgsConstructor
@Slf4j
public class AlertKafkaConsumer {

    // Map: sessionId -> List of SSE emitters
    private final Map<String, CopyOnWriteArrayList<SseEmitter>> sessionEmitters = new ConcurrentHashMap<>();

    /**
     * Consomme les alertes depuis Kafka et les diffuse aux clients SSE
     */
    @KafkaListener(topics = "${spring.kafka.topic.participant-alerts}", groupId = "${spring.kafka.consumer.group-id}")
    public void consumeAlert(AlertEvent alertEvent) {
        log.info("📥 Received alert from Kafka: {} - {} (session: {})", 
                alertEvent.getAlertType(), 
                alertEvent.getMessage(), 
                alertEvent.getSessionId());

        // Diffuser l'alerte aux clients SSE connectés pour cette session
        broadcastToSession(alertEvent.getSessionId(), alertEvent);
    }

    /**
     * Enregistre un nouveau client SSE pour une session
     */
    public void registerEmitter(String sessionId, SseEmitter emitter) {
        sessionEmitters.computeIfAbsent(sessionId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        log.info("✅ SSE client registered for session: {} (total: {})", 
                sessionId, sessionEmitters.get(sessionId).size());

        // Nettoyer l'emitter quand il se déconnecte
        emitter.onCompletion(() -> removeEmitter(sessionId, emitter));
        emitter.onTimeout(() -> removeEmitter(sessionId, emitter));
        emitter.onError(e -> removeEmitter(sessionId, emitter));
    }

    /**
     * Supprime un emitter
     */
    private void removeEmitter(String sessionId, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> emitters = sessionEmitters.get(sessionId);
        if (emitters != null) {
            emitters.remove(emitter);
            log.info("🔌 SSE client disconnected from session: {} (remaining: {})", 
                    sessionId, emitters.size());
            
            if (emitters.isEmpty()) {
                sessionEmitters.remove(sessionId);
            }
        }
    }

    /**
     * Diffuse une alerte à tous les clients SSE d'une session
     */
    private void broadcastToSession(String sessionId, AlertEvent alertEvent) {
        CopyOnWriteArrayList<SseEmitter> emitters = sessionEmitters.get(sessionId);
        
        if (emitters == null || emitters.isEmpty()) {
            log.warn("⚠️ No SSE clients connected for session: {}", sessionId);
            return;
        }

        log.info("📡 Broadcasting alert to {} SSE client(s) for session: {}", emitters.size(), sessionId);

        emitters.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event()
                        .name("alert")
                        .data(alertEvent));
                log.debug("✅ Alert sent to SSE client");
            } catch (IOException e) {
                log.error("❌ Error sending alert to SSE client: {}", e.getMessage());
                removeEmitter(sessionId, emitter);
            }
        });
    }

    /**
     * Retourne le nombre de connexions actives pour une session
     */
    public int getActiveConnectionsForSession(String sessionId) {
        CopyOnWriteArrayList<SseEmitter> emitters = sessionEmitters.get(sessionId);
        return emitters != null ? emitters.size() : 0;
    }

    /**
     * Retourne le nombre total de connexions actives
     */
    public int getTotalActiveConnections() {
        return sessionEmitters.values().stream()
                .mapToInt(CopyOnWriteArrayList::size)
                .sum();
    }
}
