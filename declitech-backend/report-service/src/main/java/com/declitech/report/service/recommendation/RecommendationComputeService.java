package com.declitech.report.service.recommendation;

import com.declitech.report.client.SessionServiceClient;
import com.declitech.report.client.dto.SessionView;
import com.declitech.report.model.EmotionReport;
import com.declitech.report.model.InstructorModuleScore;
import com.declitech.report.model.StudentActivityReport;
import com.declitech.report.repository.EmotionReportRepository;
import com.declitech.report.repository.InstructorModuleScoreRepository;
import com.declitech.report.repository.StudentActivityReportRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RecommendationComputeService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationComputeService.class);

    private final StudentActivityReportRepository activityRepository;
    private final EmotionReportRepository emotionRepository;
    private final SessionServiceClient sessionServiceClient;
    private final InstructorModuleScoreRepository scoreRepository;
    private final InstructorModuleScorer scorer;

    @Transactional
    public int recompute() {
        Map<String, SessionView> sessionsByCode = loadSessions();
        Map<String, EmotionReport> emotionByKey = loadEmotionIndex();
        Map<String, GroupStats> groups = buildGroups(sessionsByCode, emotionByKey);

        if (groups.isEmpty()) {
            scoreRepository.deleteAllInBatch();
            log.info("Recommendation recompute: no groups produced, cache cleared");
            return 0;
        }

        double globalMean = globalMean(groups.values());
        List<InstructorModuleScore> rows = new ArrayList<>(groups.size());
        LocalDateTime now = LocalDateTime.now();
        for (GroupStats g : groups.values()) {
            rows.add(toEntity(g, globalMean, now));
        }

        scoreRepository.deleteAllInBatch();
        scoreRepository.saveAll(rows);
        log.info("Recommendation recompute: {} instructor-module scores from {} sessions, globalMean={}",
                rows.size(), sessionsByCode.size(), String.format("%.3f", globalMean));
        return rows.size();
    }

    private Map<String, SessionView> loadSessions() {
        Map<String, SessionView> byCode = new HashMap<>();
        for (SessionView s : sessionServiceClient.getSessionHistory()) {
            if (s.getSessionCode() != null) {
                byCode.put(s.getSessionCode(), s);
            }
        }
        return byCode;
    }

    private Map<String, EmotionReport> loadEmotionIndex() {
        Map<String, EmotionReport> index = new HashMap<>();
        for (EmotionReport r : emotionRepository.findAll()) {
            if (r.getSessionCode() == null || r.getStudentLoginIdentity() == null) continue;
            index.put(emotionKey(r.getSessionCode(), r.getStudentLoginIdentity()), r);
        }
        return index;
    }

    private Map<String, GroupStats> buildGroups(Map<String, SessionView> sessionsByCode,
                                                Map<String, EmotionReport> emotionByKey) {
        Map<String, GroupStats> groups = new LinkedHashMap<>();
        for (StudentActivityReport r : activityRepository.findAll()) {
            SessionView s = sessionsByCode.get(r.getSessionCode());
            if (s == null || isBlank(s.getInstructorUsername()) || s.getModuleId() == null) continue;

            String key = s.getInstructorUsername() + "|" + s.getModuleId() + "|" + safe(s.getSiteName());
            GroupStats g = groups.computeIfAbsent(key,
                    k -> new GroupStats(s.getInstructorUsername(), s.getModuleId(), s.getModuleName(), s.getSiteName()));

            g.addActivity(r.getSessionCode(), r.isWorkedWell(), r.getTotalErrors(), r.getTotalExecutions(), r.getDifficulty());

            EmotionReport em = emotionByKey.get(emotionKey(r.getSessionCode(), r.getStudentLoginIdentity()));
            if (em != null) {
                g.addEngagement(toDouble(em.getEngagementScore()), toDouble(em.getOffTaskPct()));
            }
        }
        return groups;
    }

    private double globalMean(Iterable<GroupStats> groups) {
        double weighted = 0;
        long total = 0;
        for (GroupStats g : groups) {
            weighted += scorer.rawQuality(g) * g.students;
            total += g.students;
        }
        return total == 0 ? 0.6 : weighted / total;
    }

    private InstructorModuleScore toEntity(GroupStats g, double globalMean, LocalDateTime now) {
        double raw = scorer.rawQuality(g);
        InstructorModuleScore e = new InstructorModuleScore();
        e.setInstructorUsername(g.instructorUsername);
        e.setModuleId(g.moduleId);
        e.setModuleName(g.moduleName);
        e.setSiteName(g.siteName);
        e.setScore((float) scorer.shrunkScore(raw, g.students, globalMean));
        e.setConfidence((float) scorer.confidence(g.students));
        e.setSampleSize(g.students);
        e.setSessionsCount(g.sessionCodes.size());
        e.setWorkedWellRate((float) g.workedWellRate());
        Double eng = g.avgEngagement();
        e.setAvgEngagement(eng == null ? null : eng.floatValue());
        e.setAvgErrors((float) (g.students == 0 ? 0 : (double) g.sumErrors / g.students));
        e.setDifficultyFactor((float) g.difficultyFactor());
        e.setComputedAt(now);
        return e;
    }

    private String emotionKey(String sessionCode, String student) {
        return sessionCode + "|" + student;
    }

    private Double toDouble(Float f) {
        return f == null ? null : f.doubleValue();
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }
}
