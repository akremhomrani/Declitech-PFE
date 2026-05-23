package com.declitech.report.dto.agent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionValidationResponse {
    private boolean valid;
    private String reason;
    private Map<String, Object> session;
}
