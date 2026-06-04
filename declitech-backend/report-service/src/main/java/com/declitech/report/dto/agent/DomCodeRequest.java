package com.declitech.report.dto.agent;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class DomCodeRequest {

    @JsonAlias({"session_code", "sessionCode"})
    private String sessionCode;

    @JsonAlias({"student_login_identity", "studentLoginIdentity"})
    private String studentLoginIdentity;

    private String timestamp;

    @JsonAlias({"frame_url", "frameUrl"})
    private String frameUrl;

    @JsonAlias({"activity_id", "activityId"})
    private String activityId;

    private String activity;
    private String source;
    private String code;
    private String output;
    private String trigger;
    private Boolean executed;

    @JsonAlias({"console_output", "consoleOutput"})
    private String consoleOutput;
}
