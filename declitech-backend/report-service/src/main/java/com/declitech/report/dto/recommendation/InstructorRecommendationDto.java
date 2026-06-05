package com.declitech.report.dto.recommendation;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class InstructorRecommendationDto {
    private String instructorUsername;
    private String fullName;
    private double score;
    private double confidence;
    private int sampleSize;
    private double workedWellRate;
    private double avgEngagement;
    private double avgErrors;
    private String source;
    private boolean alreadyAssigned;
    private String reason;
    private List<String> topSignals;
}
