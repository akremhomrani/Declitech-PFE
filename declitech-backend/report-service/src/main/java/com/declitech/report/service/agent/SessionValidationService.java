package com.declitech.report.service.agent;

import com.declitech.report.dto.agent.SessionValidationResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Service
@Slf4j
public class SessionValidationService {

    private final RestClient sessionServiceRestClient;
    private final String gatewaySecret;

    public SessionValidationService(@Qualifier("sessionServiceRestClient") RestClient sessionServiceRestClient,
                                    @Value("${gateway.secret}") String gatewaySecret) {
        this.sessionServiceRestClient = sessionServiceRestClient;
        this.gatewaySecret = gatewaySecret;
    }

    @SuppressWarnings("unchecked")
    public SessionValidationResponse validate(String sessionCode) {
        try {
            Map<String, Object> body = sessionServiceRestClient.get()
                    .uri("/api/sessions/code/{code}", sessionCode)
                    .header("X-Gateway-Secret", gatewaySecret)
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> { /* swallow */ })
                    .body(Map.class);

            if (body == null) {
                return SessionValidationResponse.builder().valid(false).reason("not_found").build();
            }

            String status = String.valueOf(body.getOrDefault("status", ""));
            return switch (status) {
                case "ACTIVE" -> SessionValidationResponse.builder()
                        .valid(true).reason("ok").session(body).build();
                case "EXPIRED" -> SessionValidationResponse.builder()
                        .valid(false).reason("expired").session(body).build();
                default -> SessionValidationResponse.builder()
                        .valid(false).reason("inactive").session(body).build();
            };
        } catch (Exception e) {
            log.warn("Session-service unreachable when validating {}: {}", sessionCode, e.getMessage());
            return SessionValidationResponse.builder()
                    .valid(true)
                    .reason("server_unreachable")
                    .build();
        }
    }
}
