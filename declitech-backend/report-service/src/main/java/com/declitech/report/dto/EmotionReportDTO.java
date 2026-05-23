package com.declitech.report.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EmotionReportDTO {
    private String sessionId;
    private String sessionCode;
    private LocalDateTime generatedAt;
    private String studentLoginIdentity;
    private String modelVersion;
    private List<String> classLabels;
    private String status;

    private SummaryMean summaryMean;
    private FinalState finalState;
    private Diagnostics diagnostics;
    private List<TimelineEntry> timeline;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SummaryMean {
        @JsonAlias("mean_probs")
        private Map<String, Double> meanProbs;
        private String dominant;
        @JsonAlias("n_samples")
        private Integer nSamples;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FinalState {
        private String state;
        private String finalSentence;
        private Map<String, Double> freq;
        @JsonAlias("mean_probs")
        private Map<String, Double> meanProbs;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Diagnostics {
        private Map<String, Double> baselineMeans;
        private Map<String, Double> deltaFromBaseline;
        private Map<String, Double> dominantFrequency;
        private Float engagementScore;
        private Float stabilityScore;
        private Float reliabilityScore;
        private Float faceCoveragePct;
        private Float lowConfidencePct;
        private Float multiFacePct;
        private Float offTaskPct;
        private Float cameraBlockedPct;
        private Integer nTotal;
        private Integer nUsable;
        private String narrativeConfidence;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TimelineEntry {
        private String ts;
        private String status;
        private String dominant;
        private Map<String, Double> probs;
        private String error;
    }
}
