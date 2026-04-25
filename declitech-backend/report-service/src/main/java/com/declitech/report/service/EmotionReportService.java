package com.declitech.report.service;

import com.declitech.report.dto.EmotionReportDTO;
import com.declitech.report.model.EmotionReport;
import com.declitech.report.repository.EmotionReportRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.time.LocalDateTime;
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

        Optional<EmotionReport> existingReport = (numericSessionId != null && dto.getStudentLoginIdentity() != null)
                ? reportRepository.findBySessionIdAndStudentLoginIdentity(numericSessionId, dto.getStudentLoginIdentity())
                : Optional.empty();

        EmotionReport report = existingReport.orElse(new EmotionReport());

        report.setSessionId(numericSessionId);
        report.setSessionCode(dto.getSessionCode());
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
        return reportRepository.findBySessionCode(sessionCode);
    }

    public Integer getReportCountBySessionId(Long sessionId) {
        Integer count = reportRepository.countBySessionId(sessionId);
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
