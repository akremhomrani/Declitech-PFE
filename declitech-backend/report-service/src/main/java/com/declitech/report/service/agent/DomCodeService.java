package com.declitech.report.service.agent;

import com.declitech.report.dto.agent.DomCodeRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class DomCodeService {

    private static final long TTL_HOURS = 6;

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public int append(DomCodeRequest req) {
        String key = key(req.getSessionCode(), req.getStudentLoginIdentity());

        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("timestamp", req.getTimestamp() == null ? LocalDateTime.now().toString() : req.getTimestamp());
        entry.put("activity", req.getActivity());
        entry.put("activityId", req.getActivityId());
        entry.put("code", req.getCode());
        entry.put("consoleOutput", req.getConsoleOutput());
        entry.put("executed", req.getExecuted() != null && req.getExecuted());
        entry.put("source", req.getSource());
        entry.put("trigger", req.getTrigger());
        entry.put("codeLength", req.getCode() == null ? 0 : req.getCode().length());

        try {
            Long size = redis.opsForList().rightPush(key, objectMapper.writeValueAsString(entry));
            redis.expire(key, TTL_HOURS, TimeUnit.HOURS);
            return size == null ? 0 : size.intValue();
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize dom-code entry: {}", e.getMessage());
            return 0;
        }
    }

    public List<Map<String, Object>> read(String sessionCode, String loginIdentity) {
        List<String> raw = redis.opsForList().range(key(sessionCode, loginIdentity), 0, -1);
        if (raw == null) return new ArrayList<>();
        List<Map<String, Object>> out = new ArrayList<>();
        for (String s : raw) {
            try {
                out.add(objectMapper.readValue(s, new TypeReference<Map<String, Object>>() {}));
            } catch (Exception e) {
                log.warn("Failed to parse dom-code entry: {}", e.getMessage());
            }
        }
        return out;
    }

    public void clear(String sessionCode, String loginIdentity) {
        redis.delete(key(sessionCode, loginIdentity));
    }

    private String key(String sessionCode, String loginIdentity) {
        String session = sessionCode == null || sessionCode.isBlank() ? "LOCAL" : sessionCode;
        return "dom_code:" + sanitize(session) + ":" + sanitize(loginIdentity);
    }

    private String sanitize(String value) {
        if (value == null || value.isBlank()) return "unknown";
        return value.replaceAll("[^A-Za-z0-9._-]", "-");
    }
}
