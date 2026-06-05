package com.declitech.report.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "recommendation")
public class RecommendationProperties {

    private double weightWorkedWell = 0.45;
    private double weightEngagement = 0.22;
    private double weightError = 0.16;
    private double weightOffTask = 0.11;

    private double difficultyBonus = 0.06;
    private double errorNorm = 0.5;

    private double shrinkageK = 30;
    private double globalPrior = 0.6;

    private double minScore = 0.55;
    private double minConfidence = 0.3;
    private double strongFitScore = 0.78;

    private double similarityFloor = 0.25;
    private int maxPerModule = 8;
}
