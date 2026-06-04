package com.declitech.report.dto.agent;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@Data
public class ScreenAnalysisResult {

    private String timestamp;
    private String trigger;
    private String matiere;

    @JsonProperty("on_interface")
    private Boolean onInterface;

    @JsonProperty("interface")
    private String interfaceName;

    private String activity;

    @JsonProperty("has_code")
    private Boolean hasCode;

    @JsonProperty("code_excerpt")
    private String codeExcerpt;

    @JsonProperty("code_intent")
    private String codeIntent;

    private Boolean executed;
    private String output;

    @JsonProperty("has_error")
    private Boolean hasError;

    @JsonProperty("error_summary")
    private String errorSummary;

    private List<String> concepts;

    @JsonProperty("progress_estimate")
    private Double progressEstimate;

    private String engagement;
    private Double confidence;
}
