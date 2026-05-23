package com.declitech.report.service;

import com.declitech.report.dto.EmotionReportDTO;
import com.declitech.report.model.EmotionReport;
import com.declitech.report.model.EmotionReportStatus;
import com.declitech.report.repository.EmotionReportRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmotionReportService {

    private final EmotionReportRepository reportRepository;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;
    private final AlertService alertService;

    @Transactional
    public EmotionReport importReportFromJson(String jsonFilePath) throws Exception {
        File jsonFile = new File(jsonFilePath);
        EmotionReportDTO dto = objectMapper.readValue(jsonFile, EmotionReportDTO.class);
        return saveReportFromDTO(dto);
    }

    @Transactional
    public EmotionReport saveReportFromDTO(EmotionReportDTO dto) {
        Long numericSessionId = resolveSessionId(dto.getSessionId());

        Optional<EmotionReport> existingReport = Optional.empty();
        if (dto.getStudentLoginIdentity() != null) {
            if (numericSessionId != null) {
                existingReport = reportRepository.findBySessionIdAndStudentLoginIdentity(numericSessionId, dto.getStudentLoginIdentity());
            }
            if (existingReport.isEmpty() && dto.getSessionCode() != null && !dto.getSessionCode().isBlank()) {
                existingReport = reportRepository.findBySessionCodeAndStudentLoginIdentity(dto.getSessionCode(), dto.getStudentLoginIdentity());
            }
        }

        EmotionReport report = existingReport.orElse(new EmotionReport());

        Long resolvedSessionId = numericSessionId != null ? numericSessionId : report.getSessionId();
        report.setSessionId(resolvedSessionId);
        report.setSessionCode(dto.getSessionCode() != null ? dto.getSessionCode() : report.getSessionCode());
        report.setGeneratedAt(dto.getGeneratedAt());
        report.setStudentLoginIdentity(dto.getStudentLoginIdentity());

        if (dto.getSummaryMean() != null) {
            report.setEmotionMeans(dto.getSummaryMean().getMeanProbs());
            report.setDominantEmotion(dto.getSummaryMean().getDominant());
            report.setNumberOfSamples(dto.getSummaryMean().getNSamples());
        }

        if (dto.getFinalState() != null) {
            report.setFinalState(dto.getFinalState().getState());
            report.setFinalSentence(dto.getFinalState().getFinalSentence());
        }

        if (dto.getModelVersion() != null) report.setModelVersion(dto.getModelVersion());
        if (dto.getClassLabels() != null) report.setClassLabels(dto.getClassLabels().toArray(new String[0]));
        if (dto.getStatus() != null) {
            try {
                report.setStatus(EmotionReportStatus.valueOf(dto.getStatus()));
            } catch (IllegalArgumentException e) {
                log.warn("Unknown report status '{}' — keeping {}", dto.getStatus(), report.getStatus());
            }
        }

        EmotionReportDTO.Diagnostics diag = dto.getDiagnostics();
        if (diag != null) {
            report.setBaselineMeans(diag.getBaselineMeans());
            report.setDeltaFromBaseline(diag.getDeltaFromBaseline());
            report.setDominantFrequency(diag.getDominantFrequency());
            report.setEngagementScore(diag.getEngagementScore());
            report.setStabilityScore(diag.getStabilityScore());
            report.setReliabilityScore(diag.getReliabilityScore());
            report.setFaceCoveragePct(diag.getFaceCoveragePct());
            report.setLowConfidencePct(diag.getLowConfidencePct());
            report.setMultiFacePct(diag.getMultiFacePct());
            report.setOffTaskPct(diag.getOffTaskPct());
            report.setCameraBlockedPct(diag.getCameraBlockedPct());
            report.setNarrativeConfidence(diag.getNarrativeConfidence());
            if (diag.getNTotal() != null) report.setNSamplesTotal(diag.getNTotal());
            if (diag.getNUsable() != null) report.setNSamplesUsable(diag.getNUsable());
        }

        String sessionKey = dto.getSessionCode() != null ? dto.getSessionCode() : dto.getSessionId();
        try {
            alertService.flushAlertsToDb(sessionKey, dto.getStudentLoginIdentity());
        } catch (Exception e) {
            log.warn("Could not flush alerts for session={} student={}: {}",
                    sessionKey, dto.getStudentLoginIdentity(), e.getMessage());
        }

        return reportRepository.save(report);
    }

    public List<EmotionReport> getReportsBySessionId(Long sessionId) {
        return reportRepository.findBySessionId(sessionId);
    }

    public List<EmotionReport> getReportsBySessionCode(String sessionCode) {
        List<EmotionReport> reports = reportRepository.findBySessionCode(sessionCode);
        reports.forEach(this::hydrateMeansFromRedisIfMissing);
        return reports;
    }

    private static final List<String> EMOTION_KEYS =
            List.of("angry", "disgust", "fear", "happy", "sad", "surprise", "neutral");

    private void hydrateMeansFromRedisIfMissing(EmotionReport report) {
        if (report.getEmotionMeans() != null && !report.getEmotionMeans().isEmpty()) {
            return;
        }
        if (report.getSessionCode() == null || report.getStudentLoginIdentity() == null) {
            return;
        }

        List<String> timeline = getLiveTimelineFromRedis(report.getSessionCode(), report.getStudentLoginIdentity());
        if (timeline.isEmpty()) {
            return;
        }

        Map<String, Double> means = aggregateMeansFromTimeline(timeline);
        if (means.isEmpty()) {
            return;
        }

        report.setEmotionMeans(means);
        if (report.getDominantEmotion() == null) {
            report.setDominantEmotion(
                    means.entrySet().stream()
                            .max(Map.Entry.comparingByValue())
                            .map(Map.Entry::getKey)
                            .orElse(null)
            );
        }
    }

    private Map<String, Double> aggregateMeansFromTimeline(List<String> timeline) {
        Map<String, Double> sums = new LinkedHashMap<>();
        EMOTION_KEYS.forEach(k -> sums.put(k, 0.0));
        int validSamples = 0;

        for (String raw : timeline) {
            try {
                Map<String, Object> event = objectMapper.readValue(raw, new TypeReference<Map<String, Object>>() {});
                if (!"ok".equals(event.get("status"))) continue;
                Object probs = event.get("probs");
                if (!(probs instanceof Map<?, ?> probsMap)) continue;

                for (String key : EMOTION_KEYS) {
                    Object value = probsMap.get(key);
                    if (value instanceof Number num) {
                        sums.merge(key, num.doubleValue(), Double::sum);
                    }
                }
                validSamples++;
            } catch (Exception e) {
                log.debug("Skipping malformed timeline entry: {}", e.getMessage());
            }
        }

        if (validSamples == 0) {
            return new HashMap<>();
        }

        Map<String, Double> means = new LinkedHashMap<>();
        for (String key : EMOTION_KEYS) {
            means.put(key, sums.get(key) / validSamples);
        }
        return means;
    }

    public Integer getReportCountBySessionId(Long sessionId) {
        Integer count = reportRepository.countBySessionId(sessionId);
        return count != null ? count : 0;
    }

    public Integer getReportCountBySessionCode(String sessionCode) {
        Integer count = reportRepository.countBySessionCode(sessionCode);
        return count != null ? count : 0;
    }

    public Long getDistinctParticipantCountBySessionId(Long sessionId) {
        Long count = reportRepository.countDistinctParticipantsBySessionId(sessionId);
        return count != null ? count : 0L;
    }

    public List<EmotionReport> getReportsByStudentLoginIdentity(String studentLoginIdentity) {
        return reportRepository.findByStudentLoginIdentity(studentLoginIdentity);
    }

    public List<EmotionReport> getAllReports() {
        return reportRepository.findAll();
    }

    public List<EmotionReport> getReportsByDateRange(LocalDateTime start, LocalDateTime end) {
        return reportRepository.findByGeneratedAtBetween(start, end);
    }

    public List<EmotionReport> getStudentReportsByDateRange(
            String studentLoginIdentity,
            LocalDateTime start,
            LocalDateTime end) {
        return reportRepository.findByStudentLoginIdentityAndGeneratedAtBetween(
            studentLoginIdentity, start, end
        );
    }

    public Map<String, Object> getStudentStatistics(String studentLoginIdentity) {
        List<EmotionReport> reports = reportRepository.findByStudentLoginIdentity(studentLoginIdentity);

        if (reports.isEmpty()) {
            return Map.of("message", "No reports found for student");
        }

        double avgAngry = reports.stream()
            .mapToDouble(r -> emotionValue(r, "angry"))
            .average().orElse(0.0);

        double avgHappy = reports.stream()
            .mapToDouble(r -> emotionValue(r, "happy"))
            .average().orElse(0.0);

        double avgSad = reports.stream()
            .mapToDouble(r -> emotionValue(r, "sad"))
            .average().orElse(0.0);

        double avgFear = reports.stream()
            .mapToDouble(r -> emotionValue(r, "fear"))
            .average().orElse(0.0);

        Map<String, Long> stateFrequency = reports.stream()
            .filter(r -> r.getFinalState() != null)
            .collect(Collectors.groupingBy(EmotionReport::getFinalState, Collectors.counting()));

        return Map.of(
            "studentLoginIdentity", studentLoginIdentity,
            "totalSessions", reports.size(),
            "averageEmotions", Map.of(
                "angry", avgAngry,
                "happy", avgHappy,
                "sad",   avgSad,
                "fear",  avgFear
            ),
            "stateFrequency", stateFrequency,
            "latestReport", reports.get(reports.size() - 1).getGeneratedAt()
        );
    }

    public Optional<EmotionReport> updateInstructorNote(Long id, String note) {
        return reportRepository.findById(id).map(report -> {
            report.setInstructorNote(note);
            return reportRepository.save(report);
        });
    }

    public List<String> getLiveTimelineFromRedis(String sessionKey, String studentLoginIdentity) {
        String redisKey = "emotion_timeline:" + sessionKey + ":" + studentLoginIdentity;
        List<String> timeline = redisTemplate.opsForList().range(redisKey, 0, -1);
        return timeline != null ? timeline : List.of();
    }

    private double emotionValue(EmotionReport report, String emotion) {
        if (report.getEmotionMeans() == null) return 0.0;
        return report.getEmotionMeans().getOrDefault(emotion, 0.0);
    }

    /** Parse numeric session ID from agent string (e.g. "SESSION-42" → 42, "42" → 42). */
    private Long resolveSessionId(String rawId) {
        if (rawId == null) return null;
        String stripped = rawId;
        if (rawId.startsWith("SESSION-")) stripped = rawId.substring(8);
        else if (rawId.startsWith("LOCAL-")) stripped = rawId.substring(6);
        try {
            return Long.parseLong(stripped);
        } catch (NumberFormatException e) {
            log.warn("Cannot resolve numeric sessionId from '{}' — storing null", rawId);
            return null;
        }
    }
}
