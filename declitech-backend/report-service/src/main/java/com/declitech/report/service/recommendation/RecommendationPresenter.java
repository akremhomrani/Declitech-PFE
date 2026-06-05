package com.declitech.report.service.recommendation;

import com.declitech.report.client.dto.UserView;
import com.declitech.report.dto.recommendation.InstructorRecommendationDto;
import com.declitech.report.model.InstructorModuleScore;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class RecommendationPresenter {

    public InstructorRecommendationDto toDto(InstructorModuleScore row, UserView user,
                                             String source, double effectiveScore) {
        List<String> signals = buildSignals(row, source);
        return InstructorRecommendationDto.builder()
                .instructorUsername(row.getInstructorUsername())
                .fullName(fullName(user, row.getInstructorUsername()))
                .score(round(effectiveScore))
                .confidence(round(row.getConfidence()))
                .sampleSize(row.getSampleSize())
                .workedWellRate(round(orZero(row.getWorkedWellRate())))
                .avgEngagement(round(orZero(row.getAvgEngagement())))
                .avgErrors(round(orZero(row.getAvgErrors())))
                .source(source)
                .alreadyAssigned(isAssigned(user, row))
                .reason(String.join(", ", signals))
                .topSignals(signals)
                .build();
    }

    private List<String> buildSignals(InstructorModuleScore row, String source) {
        List<String> signals = new ArrayList<>();
        if (row.getWorkedWellRate() != null) {
            signals.add(Math.round(row.getWorkedWellRate() * 100) + "% worked well");
        }
        if (row.getAvgErrors() != null) {
            signals.add(row.getAvgErrors() <= 2.0 ? "low error rate"
                    : String.format("%.1f errors/student", row.getAvgErrors()));
        }
        if (row.getAvgEngagement() != null) {
            signals.add(row.getAvgEngagement() >= 0.75 ? "high engagement"
                    : String.format("engagement %.2f", row.getAvgEngagement()));
        }
        if ("SIMILARITY".equals(source)) {
            signals.add("suggested by similarity");
        }
        return signals;
    }

    private boolean isAssigned(UserView user, InstructorModuleScore row) {
        if (user == null || user.getModuleAssignments() == null) return false;
        return user.getModuleAssignments().stream().anyMatch(a ->
                row.getModuleId().equals(a.getModuleId())
                        && (row.getSiteName() == null || row.getSiteName().isBlank()
                        || row.getSiteName().equalsIgnoreCase(a.getSiteName())));
    }

    private String fullName(UserView user, String username) {
        if (user == null) return username;
        String first = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String last = user.getLastName() == null ? "" : user.getLastName().trim();
        String full = (first + " " + last).trim();
        return full.isEmpty() ? username : full;
    }

    private double orZero(Float f) {
        return f == null ? 0 : f;
    }

    private double round(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }
}
