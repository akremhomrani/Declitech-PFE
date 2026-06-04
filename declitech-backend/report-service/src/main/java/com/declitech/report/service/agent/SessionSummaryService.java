package com.declitech.report.service.agent;

import com.declitech.report.dto.agent.ScreenAnalysisResult;
import com.declitech.report.dto.agent.SessionAnalysisSummary;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class SessionSummaryService {

    private final AnalysisStore analysisStore;

    public SessionAnalysisSummary buildAndStore(String sessionId, String sessionCode, String loginIdentity) {
        String sessionKey = sessionCode != null && !sessionCode.isBlank() ? sessionCode : sessionId;
        List<ScreenAnalysisResult> samples = analysisStore.read(sessionKey, loginIdentity);
        if (samples.isEmpty()) {
            log.info("Summary skipped — no analysis samples sessionKey={} student={}", sessionKey, loginIdentity);
            return null;
        }

        SessionAnalysisSummary summary = aggregate(sessionId, sessionCode, loginIdentity, samples);
        analysisStore.saveSummary(sessionKey, loginIdentity, summary);
        log.info("Summary stored sessionKey={} student={} samples={} onTaskRatio={}",
                sessionKey, loginIdentity, summary.getSamples(),
                String.format("%.2f", summary.getOnTaskRatio()));
        return summary;
    }

    private SessionAnalysisSummary aggregate(String sessionId, String sessionCode, String loginIdentity,
                                             List<ScreenAnalysisResult> samples) {
        SessionAnalysisSummary summary = new SessionAnalysisSummary();
        summary.setSessionId(sessionId);
        summary.setSessionCode(sessionCode);
        summary.setStudentLoginIdentity(loginIdentity);
        summary.setMatiere(firstMatiere(samples));
        summary.setSamples(samples.size());

        Set<String> concepts = new LinkedHashSet<>();
        Map<String, Integer> activityBreakdown = new LinkedHashMap<>();
        int onTask = 0;
        int executions = 0;
        int errors = 0;
        double sumConfidence = 0;
        double sumProgress = 0;
        double maxProgress = 0;
        List<String> timestamps = new ArrayList<>();
        List<String> engagementSeq = new ArrayList<>();

        for (ScreenAnalysisResult s : samples) {
            if (s.getConcepts() != null) concepts.addAll(s.getConcepts());
            String activity = s.getActivity() == null ? "unknown" : s.getActivity();
            activityBreakdown.merge(activity, 1, Integer::sum);
            if (Boolean.TRUE.equals(s.getOnInterface()) && !"off_task".equals(activity)) onTask++;
            if (Boolean.TRUE.equals(s.getExecuted())) executions++;
            if (Boolean.TRUE.equals(s.getHasError())) errors++;
            if (s.getConfidence() != null) sumConfidence += s.getConfidence();
            if (s.getProgressEstimate() != null) {
                sumProgress += s.getProgressEstimate();
                maxProgress = Math.max(maxProgress, s.getProgressEstimate());
            }
            if (s.getTimestamp() != null) timestamps.add(s.getTimestamp());
            if (s.getEngagement() != null) engagementSeq.add(s.getEngagement());
        }

        int n = samples.size();
        summary.setConceptsCovered(new ArrayList<>(concepts));
        summary.setActivityBreakdown(activityBreakdown);
        summary.setOnTaskRatio(round(onTask / (double) n));
        summary.setExecutions(executions);
        summary.setErrorsEncountered(errors);
        summary.setAvgConfidence(round(sumConfidence / n));
        summary.setAvgProgress(round(sumProgress / n));
        summary.setMaxProgress(round(maxProgress));

        if (!timestamps.isEmpty()) {
            String first = timestamps.get(0);
            String last = timestamps.get(timestamps.size() - 1);
            summary.setFirstAt(first);
            summary.setLastAt(last);
            summary.setDurationMin(durationMinutes(first, last));
        }

        summary.setEngagementTrend(trend(engagementSeq));
        summary.setNarrative(narrative(summary));
        summary.setGeneratedAt(LocalDateTime.now().toString());
        return summary;
    }

    private String firstMatiere(List<ScreenAnalysisResult> samples) {
        for (ScreenAnalysisResult s : samples) {
            if (s.getMatiere() != null && !s.getMatiere().isBlank()) return s.getMatiere();
        }
        return "python";
    }

    private long durationMinutes(String first, String last) {
        try {
            LocalDateTime start = LocalDateTime.parse(first);
            LocalDateTime end = LocalDateTime.parse(last);
            return Math.max(0, Duration.between(start, end).toMinutes());
        } catch (DateTimeParseException e) {
            return 0;
        }
    }

    private String trend(List<String> engagementSeq) {
        if (engagementSeq.isEmpty()) return "unknown";
        int third = Math.max(1, engagementSeq.size() / 3);
        double early = activeRatio(engagementSeq.subList(0, third));
        double late = activeRatio(engagementSeq.subList(engagementSeq.size() - third, engagementSeq.size()));
        double delta = late - early;
        String level = late >= 0.6 ? "high" : late >= 0.3 ? "medium" : "low";
        if (delta > 0.15) return "rising-" + level;
        if (delta < -0.15) return "declining-" + level;
        return "stable-" + level;
    }

    private double activeRatio(List<String> segment) {
        if (segment.isEmpty()) return 0;
        long active = segment.stream().filter("active"::equals).count();
        return active / (double) segment.size();
    }

    private String narrative(SessionAnalysisSummary s) {
        StringBuilder sb = new StringBuilder();
        sb.append("Élève suivi sur ").append(s.getSamples()).append(" relevés");
        if (s.getDurationMin() > 0) sb.append(" (").append(s.getDurationMin()).append(" min)");
        sb.append(". Temps sur tâche ").append(Math.round(s.getOnTaskRatio() * 100)).append("%.");
        sb.append(" ").append(s.getExecutions()).append(" exécutions");
        sb.append(", ").append(s.getErrorsEncountered()).append(" erreurs.");
        if (s.getConceptsCovered() != null && !s.getConceptsCovered().isEmpty()) {
            sb.append(" Concepts abordés : ").append(String.join(", ", s.getConceptsCovered())).append(".");
        }
        sb.append(" Tendance d'engagement : ").append(s.getEngagementTrend()).append(".");
        return sb.toString();
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
