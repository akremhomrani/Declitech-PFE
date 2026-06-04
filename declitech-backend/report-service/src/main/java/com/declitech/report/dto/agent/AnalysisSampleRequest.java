package com.declitech.report.dto.agent;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class AnalysisSampleRequest {

    @JsonAlias({"session_id", "sessionId"})
    private String sessionId;

    @JsonAlias({"session_code", "sessionCode"})
    private String sessionCode;

    @JsonAlias({"student_login_identity", "studentLoginIdentity"})
    private String studentLoginIdentity;

    private String matiere;
    private String trigger;
    private String timestamp;

    @JsonAlias({"activity_id", "activityId"})
    private String activityId;

    private String activity;

    @JsonAlias({"extracted_code", "extractedCode"})
    private String extractedCode;

    @JsonAlias({"extracted_output", "extractedOutput"})
    private String extractedOutput;

    @JsonAlias({"content_hash", "contentHash"})
    private String contentHash;

    @JsonAlias({"image_base64", "imageBase64"})
    private String imageBase64;
}
