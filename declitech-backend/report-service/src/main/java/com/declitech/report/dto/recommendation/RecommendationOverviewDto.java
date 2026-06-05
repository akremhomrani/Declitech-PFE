package com.declitech.report.dto.recommendation;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class RecommendationOverviewDto {
    private LocalDateTime computedAt;
    private int totalModules;
    private int modulesCovered;
    private int activeInstructors;
    private int strongFitInstructors;
    private double avgWorkedWellRate;
    private int modulesNeedingAttention;
    private List<ModuleSummary> modules;

    @Data
    @Builder
    public static class ModuleSummary {
        private Long moduleId;
        private String moduleTitle;
        private String siteName;
        private int sessionsCount;
        private int studentsCount;
        private boolean unassigned;
        private boolean coldStart;
        private String topInstructorUsername;
        private String topInstructorName;
        private double topScore;
        private double topConfidence;
        private String source;
    }
}
