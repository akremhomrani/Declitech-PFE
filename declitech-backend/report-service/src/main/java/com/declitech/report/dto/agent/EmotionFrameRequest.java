package com.declitech.report.dto.agent;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class EmotionFrameRequest {
    private String sessionId;
    private String sessionCode;
    private String studentLoginIdentity;
    private String timestamp;
    private String status;
    private String dominant;
    private Map<String, Double> probabilities;
    private Map<String, Double> burstMedian;
    private Integer framesUsed;
    private Map<String, Integer> framesDropped;
    private Double meanQuality;
    private Double meanConfidence;
    private Double meanEntropy;
    private Double stability;
    private String modelVersion;
    private List<String> classLabels;
    private String detector;
    private String error;
}
