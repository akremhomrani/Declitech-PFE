package com.declitech.report.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmotionReportDTO {
    private String sessionId;
    private String sessionCode;
    private String participantId;
    private LocalDateTime generatedAt;
    private String studentLoginIdentity;
    
    private SummaryMean summaryMean;
    private FinalState finalState;
    private List<TimelineEntry> timeline;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SummaryMean {
        private Map<String, Double> meanProbs;
        private String dominant;
        private Integer nSamples;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FinalState {
        private String state;
        private String finalSentence;
        private Map<String, Double> freq;
        private Map<String, Double> meanProbs;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimelineEntry {
        private String ts;
        private String status;
        private String dominant;
        private Map<String, Double> probs;
        private String error;
    }
}
