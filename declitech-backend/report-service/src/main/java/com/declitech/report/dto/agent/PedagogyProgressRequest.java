package com.declitech.report.dto.agent;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PedagogyProgressRequest {

    @JsonAlias({"session_id", "sessionId"})
    private String sessionId;

    @JsonAlias({"student_login_identity", "studentLoginIdentity"})
    private String studentLoginIdentity;

    private String timestamp;
    private String platform;

    @JsonAlias({"page_url", "pageUrl"})
    private String pageUrl;

    private Map<String, Object> data;
}
