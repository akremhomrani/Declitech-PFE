package com.declitech.report.service.recommendation;

import java.util.HashSet;
import java.util.Set;

public class GroupStats {

    final String instructorUsername;
    final Long moduleId;
    final String moduleName;
    final String siteName;

    int students;
    int workedWellTrue;
    long sumErrors;
    long sumExecutions;
    double engagementSum;
    int engagementCount;
    double offTaskSum;
    int offTaskCount;
    double difficultySum;
    int difficultyCount;
    final Set<String> sessionCodes = new HashSet<>();

    GroupStats(String instructorUsername, Long moduleId, String moduleName, String siteName) {
        this.instructorUsername = instructorUsername;
        this.moduleId = moduleId;
        this.moduleName = moduleName;
        this.siteName = siteName;
    }

    void addActivity(String sessionCode, boolean workedWell, int errors, int executions, String difficulty) {
        students++;
        if (workedWell) workedWellTrue++;
        sumErrors += Math.max(0, errors);
        sumExecutions += Math.max(0, executions);
        if (sessionCode != null) sessionCodes.add(sessionCode);
        Double factor = difficultyFactor(difficulty);
        if (factor != null) {
            difficultySum += factor;
            difficultyCount++;
        }
    }

    void addEngagement(Double engagement, Double offTaskPct) {
        if (engagement != null) {
            engagementSum += clamp01(engagement);
            engagementCount++;
        }
        if (offTaskPct != null) {
            offTaskSum += offTaskPct;
            offTaskCount++;
        }
    }

    double workedWellRate() {
        return students == 0 ? 0 : (double) workedWellTrue / students;
    }

    double avgErrorsPerExecution() {
        if (sumExecutions > 0) return (double) sumErrors / sumExecutions;
        return sumErrors > 0 ? 1.0 : 0.0;
    }

    Double avgEngagement() {
        return engagementCount == 0 ? null : engagementSum / engagementCount;
    }

    Double avgOffTaskPct() {
        return offTaskCount == 0 ? null : offTaskSum / offTaskCount;
    }

    double difficultyFactor() {
        return difficultyCount == 0 ? 0 : difficultySum / difficultyCount;
    }

    private static Double difficultyFactor(String difficulty) {
        if (difficulty == null) return null;
        return switch (difficulty.trim().toLowerCase()) {
            case "faible", "low" -> 0.0;
            case "moyenne", "medium" -> 0.5;
            case "élevée", "elevee", "high", "élevé" -> 1.0;
            default -> null;
        };
    }

    private static double clamp01(double v) {
        return Math.max(0, Math.min(1, v));
    }
}
