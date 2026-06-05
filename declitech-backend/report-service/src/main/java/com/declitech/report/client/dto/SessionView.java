package com.declitech.report.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class SessionView {
    private String sessionCode;
    private String instructorUsername;
    private Long moduleId;
    private String moduleName;
    private String siteName;
    private String status;
}
