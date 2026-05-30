package com.declitech.auth.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LoginAttemptService {

    private static final Logger log = LoggerFactory.getLogger(LoginAttemptService.class);

    private static final int MAX_ATTEMPTS = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final Duration LOCKOUT = Duration.ofMinutes(30);

    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();

    public boolean isBlocked(String key) {
        Attempt attempt = attempts.get(normalize(key));
        if (attempt == null) {
            return false;
        }
        if (attempt.lockedUntil != null && Instant.now().isBefore(attempt.lockedUntil)) {
            return true;
        }
        return false;
    }

    public void recordFailure(String key, String clientIp) {
        String normalized = normalize(key);
        Instant now = Instant.now();
        attempts.compute(normalized, (k, existing) -> {
            Attempt attempt = (existing == null || windowExpired(existing, now)) ? new Attempt() : existing;
            attempt.count++;
            attempt.lastAttempt = now;
            if (attempt.count >= MAX_ATTEMPTS) {
                attempt.lockedUntil = now.plus(LOCKOUT);
            }
            return attempt;
        });
        Attempt updated = attempts.get(normalized);
        log.warn("Failed login attempt {} for '{}' from IP {}{}",
                updated.count, normalized, clientIp,
                updated.lockedUntil != null ? " (account temporarily locked)" : "");
    }

    public void recordSuccess(String key) {
        attempts.remove(normalize(key));
    }

    private boolean windowExpired(Attempt attempt, Instant now) {
        if (attempt.lockedUntil != null && now.isAfter(attempt.lockedUntil)) {
            return true;
        }
        return attempt.lastAttempt != null && now.isAfter(attempt.lastAttempt.plus(WINDOW));
    }

    private String normalize(String key) {
        return key == null ? "" : key.trim().toLowerCase();
    }

    private static final class Attempt {
        private int count;
        private Instant lastAttempt;
        private Instant lockedUntil;
    }
}
