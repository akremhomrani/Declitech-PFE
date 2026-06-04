package com.declitech.report.dto.agent;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class SessionAnalysisSummary {

    private String sessionId;
    private String sessionCode;
    private String studentLoginIdentity;
    private String matiere;

    private int samples;
    private String firstAt;
    private String lastAt;
    private long durationMin;

    private double onTaskRatio;
    private int executions;
    private int errorsEncountered;

    private List<String> conceptsCovered;
    private Map<String, Integer> activityBreakdown;

    private double avgConfidence;
    private double avgProgress;
    private double maxProgress;

    private String engagementTrend;
    private String narrative;
    private String generatedAt;
}
