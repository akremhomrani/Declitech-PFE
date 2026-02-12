package com.declitech.report.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertEvent {
    private String participantId;
    private String sessionId;
    private String studentLoginIdentity;
    private AlertType alertType;
    private AlertSeverity severity;
    private String message;
    private LocalDateTime timestamp;
    private Map<String, Object> metadata;
}
