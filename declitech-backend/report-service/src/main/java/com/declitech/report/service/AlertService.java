package com.declitech.report.service;

import com.declitech.report.dto.AlertEvent;
import com.declitech.report.dto.AlertType;
import com.declitech.report.model.SessionAlert;
import com.declitech.report.repository.SessionAlertRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AlertService {

    private static final String REDIS_ALERT_PREFIX   = "session:alerts:";
    private static final String REDIS_DEDUP_PREFIX   = "alert:dedup:";
    private static final long   DEDUP_WINDOW_SECONDS = 30;
    private static final long   REDIS_TTL_HOURS      = 24;
    private static final int    SCAN_BATCH_SIZE      = 256;

    private final StringRedisTemplate redisTemplate;
    private final SessionAlertRepository alertRepository;
    private final ObjectMapper objectMapper;

    // In-memory SSE emitters — keyed by sessionId string (sessionCode or raw ID from client)
    private final Map<String, CopyOnWriteArrayList<SseEmitter>> sessionEmitters = new ConcurrentHashMap<>();

    // =========================================================
    //  SSE registration
    // =========================================================

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
            if (emitters.isEmpty()) sessionEmitters.remove(sessionId);
        }
    }

    // =========================================================
    //  Core: broadcast + store
    // =========================================================

    public void saveAndBroadcast(AlertEvent alertEvent) {
        broadcastToSession(alertEvent.getSessionId(), alertEvent);

        if (alertEvent.getAlertType() != AlertType.ALERT_RESOLVED) {
            String dedupKey = REDIS_DEDUP_PREFIX
                    + alertEvent.getSessionId() + ":"
                    + alertEvent.getStudentLoginIdentity() + ":"
                    + alertEvent.getAlertType();
            Boolean isNew = redisTemplate.opsForValue()
                    .setIfAbsent(dedupKey, "1", DEDUP_WINDOW_SECONDS, TimeUnit.SECONDS);
            if (!Boolean.TRUE.equals(isNew)) {
                return;
            }
        }

        String redisKey = REDIS_ALERT_PREFIX
                + alertEvent.getSessionId() + ":"
                + alertEvent.getStudentLoginIdentity();
        try {
            String json = objectMapper.writeValueAsString(alertEvent);
            redisTemplate.opsForList().rightPush(redisKey, json);
            redisTemplate.expire(redisKey, REDIS_TTL_HOURS, TimeUnit.HOURS);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize alert to Redis: {}", e.getMessage());
        }
    }

    public void broadcastToSession(String sessionId, AlertEvent alertEvent) {
        CopyOnWriteArrayList<SseEmitter> emitters = sessionEmitters.get(sessionId);
        if (emitters == null || emitters.isEmpty()) return;

        emitters.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name("alert").data(alertEvent));
            } catch (IOException e) {
                removeEmitter(sessionId, emitter);
            }
        });
    }

    // =========================================================
    //  Flush Redis → PostgreSQL (called at report generation)
    // =========================================================

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public List<SessionAlert> flushAlertsToDb(String sessionKey, String studentLoginIdentity) {
        String redisKey = REDIS_ALERT_PREFIX + sessionKey + ":" + studentLoginIdentity;
        List<String> rawAlerts = redisTemplate.opsForList().range(redisKey, 0, -1);

        if (rawAlerts == null || rawAlerts.isEmpty()) {
            return alertRepository.findBySessionIdAndStudentLoginIdentityOrderByTimestampAsc(
                    sessionKey, studentLoginIdentity);
        }

        List<SessionAlert> entities = rawAlerts.stream()
                .map(raw -> {
                    try {
                        AlertEvent event = objectMapper.readValue(raw, AlertEvent.class);
                        return toEntity(event);
                    } catch (Exception e) {
                        log.warn("Failed to deserialize alert from Redis: {}", e.getMessage());
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        List<SessionAlert> saved = alertRepository.saveAll(entities);
        redisTemplate.delete(redisKey);
        log.info("Flushed {} alerts to DB for session={} student={}", saved.size(), sessionKey, studentLoginIdentity);
        return saved;
    }

    // =========================================================
    //  Query from DB
    // =========================================================

    public List<SessionAlert> getAlertsBySessionAndStudent(String sessionKey, String studentLoginIdentity) {
        return alertRepository.findBySessionIdAndStudentLoginIdentityOrderByTimestampAsc(
                sessionKey, studentLoginIdentity);
    }

    /**
     * Live-session fetch — merges DB-persisted alerts with Redis-buffered alerts
     * (read-only, no flush). Powers the dashboard polling fallback when SSE is
     * unavailable so cards still color and the sidebar still lists alerts.
     */
    public List<SessionAlert> getLiveAlertsBySession(String sessionKey) {
        List<SessionAlert> dbAlerts = alertRepository.findBySessionIdOrderByTimestampAsc(sessionKey);
        java.util.Set<String> redisKeys = scanKeys(REDIS_ALERT_PREFIX + sessionKey + ":*");
        if (redisKeys.isEmpty()) {
            return dbAlerts;
        }
        java.util.List<SessionAlert> merged = new java.util.ArrayList<>(dbAlerts);
        for (String redisKey : redisKeys) {
            List<String> raws = redisTemplate.opsForList().range(redisKey, 0, -1);
            if (raws == null) continue;
            for (String raw : raws) {
                try {
                    AlertEvent event = objectMapper.readValue(raw, AlertEvent.class);
                    merged.add(toEntity(event));
                } catch (Exception e) {
                    log.warn("Failed to deserialize live alert: {}", e.getMessage());
                }
            }
        }
        merged.sort(java.util.Comparator.comparing(
                SessionAlert::getTimestamp,
                java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())));
        return merged;
    }

    // =========================================================
    //  Status helpers
    // =========================================================

    public int getTotalActiveConnections() {
        return sessionEmitters.values().stream().mapToInt(CopyOnWriteArrayList::size).sum();
    }

    // =========================================================
    //  Private helpers
    // =========================================================

    private java.util.Set<String> scanKeys(String pattern) {
        java.util.Set<String> keys = new java.util.HashSet<>();
        org.springframework.data.redis.core.ScanOptions options =
                org.springframework.data.redis.core.ScanOptions.scanOptions()
                        .match(pattern)
                        .count(SCAN_BATCH_SIZE)
                        .build();
        redisTemplate.execute((org.springframework.data.redis.core.RedisCallback<Void>) connection -> {
            try (org.springframework.data.redis.core.Cursor<byte[]> cursor = connection.keyCommands().scan(options)) {
                while (cursor.hasNext()) {
                    keys.add(new String(cursor.next(), java.nio.charset.StandardCharsets.UTF_8));
                }
            }
            return null;
        });
        return keys;
    }

    private SessionAlert toEntity(AlertEvent event) {
        String tabUrl   = null;
        String tabTitle = null;
        Integer switchCount = null;

        if (event.getMetadata() != null) {
            tabUrl   = (String) event.getMetadata().get("currentUrl");
            tabTitle = (String) event.getMetadata().get("tabTitle");
            Object sc = event.getMetadata().get("switchCount");
            if (sc instanceof Number) switchCount = ((Number) sc).intValue();
        }

        return SessionAlert.builder()
                .sessionId(event.getSessionId())
                .studentLoginIdentity(event.getStudentLoginIdentity())
                .alertType(event.getAlertType())
                .severity(event.getSeverity())
                .message(event.getMessage())
                .timestamp(event.getTimestamp())
                .tabUrl(tabUrl)
                .tabTitle(tabTitle)
                .switchCount(switchCount)
                .build();
    }

}
