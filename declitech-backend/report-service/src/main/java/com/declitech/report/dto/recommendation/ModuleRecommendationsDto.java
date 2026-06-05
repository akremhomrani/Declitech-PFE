package com.declitech.report.dto.recommendation;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ModuleRecommendationsDto {
    private Long moduleId;
    private String moduleTitle;
    private String siteName;
    private int sessionsCount;
    private int studentsCount;
    private boolean coldStart;
    private List<InstructorRecommendationDto> recommendations;
}
