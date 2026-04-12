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
import java.time.format.DateTimeFormatter;
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
        String cleanCode = dto.getSessionCode() != null
                ? dto.getSessionCode()
                : stripAgentPrefix(dto.getSessionId());

        Optional<EmotionReport> existingReport = (cleanCode != null && dto.getStudentLoginIdentity() != null)
                ? reportRepository.findBySessionCodeAndStudentLoginIdentity(cleanCode, dto.getStudentLoginIdentity())
                : Optional.empty();

        EmotionReport report;
        if (existingReport.isPresent()) {
            report = existingReport.get();
        } else {
            report = new EmotionReport();
        }

        report.setSessionIdLegacy(dto.getSessionId());
        report.setSessionCode(cleanCode);
        report.setGeneratedAt(dto.getGeneratedAt());
        report.setStudentLoginIdentity(dto.getStudentLoginIdentity());
        
        if (dto.getSummaryMean() != null) {
            Map<String, Double> meanProbs = dto.getSummaryMean().getMeanProbs();
            if (meanProbs != null) {
                report.setAngryMean(meanProbs.getOrDefault("angry", 0.0));
                report.setDisgustMean(meanProbs.getOrDefault("disgust", 0.0));
                report.setFearMean(meanProbs.getOrDefault("fear", 0.0));
                report.setHappyMean(meanProbs.getOrDefault("happy", 0.0));
                report.setSadMean(meanProbs.getOrDefault("sad", 0.0));
                report.setSurpriseMean(meanProbs.getOrDefault("surprise", 0.0));
                report.setNeutralMean(meanProbs.getOrDefault("neutral", 0.0));
            }
            report.setDominantEmotion(dto.getSummaryMean().getDominant());
            report.setNumberOfSamples(dto.getSummaryMean().getNSamples());
        }
        
        if (dto.getFinalState() != null) {
            report.setFinalState(dto.getFinalState().getState());
            report.setFinalSentence(dto.getFinalState().getFinalSentence());
        }
        // Flush Redis alerts → PostgreSQL now that the report is being finalized
        try {
            alertService.flushAlertsToDb(cleanCode, dto.getStudentLoginIdentity());
        } catch (Exception e) {
            log.warn("Could not flush alerts for session={} student={}: {}",
                    dto.getSessionId(), dto.getStudentLoginIdentity(), e.getMessage());
        }

        return reportRepository.save(report);
    }

    public Optional<EmotionReport> getReportBySessionId(String sessionId) {
        return reportRepository.findBySessionId(sessionId);
    }

    public List<EmotionReport> getReportsBySessionCode(String sessionCode) {
        return reportRepository.findBySessionCode(sessionCode);
    }

    public List<EmotionReport> getReportsByNumericSessionId(Long sessionId) {
        return reportRepository.findBySessionId(sessionId);
    }

    public Integer getReportCountBySessionCode(String sessionCode) {
        Integer count = reportRepository.countBySessionCode(sessionCode);
        return count != null ? count : 0;
    }

    public Long getDistinctParticipantCountBySessionCode(String sessionCode) {
        Long count = reportRepository.countDistinctParticipantsBySessionCode(sessionCode);
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
            .mapToDouble(r -> r.getAngryMean() != null ? r.getAngryMean() : 0.0)
            .average().orElse(0.0);
        
        double avgHappy = reports.stream()
            .mapToDouble(r -> r.getHappyMean() != null ? r.getHappyMean() : 0.0)
            .average().orElse(0.0);
        
        double avgSad = reports.stream()
            .mapToDouble(r -> r.getSadMean() != null ? r.getSadMean() : 0.0)
            .average().orElse(0.0);
        
        double avgFear = reports.stream()
            .mapToDouble(r -> r.getFearMean() != null ? r.getFearMean() : 0.0)
            .average().orElse(0.0);
        
        Map<String, Long> stateFrequency = reports.stream()
            .filter(r -> r.getFinalState() != null)
            .collect(Collectors.groupingBy(
                EmotionReport::getFinalState,
                Collectors.counting()
            ));
        
        return Map.of(
            "studentLoginIdentity", studentLoginIdentity,
            "totalSessions", reports.size(),
            "averageEmotions", Map.of(
                "angry", avgAngry,
                "happy", avgHappy,
                "sad", avgSad,
                "fear", avgFear
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

    public List<String> getLiveTimelineFromRedis(String sessionCode, String studentLoginIdentity) {
        String redisKey = "emotion_timeline:" + sessionCode + ":" + studentLoginIdentity;
        // Fetch all elements from the list (0 to -1)
        List<String> timeline = redisTemplate.opsForList().range(redisKey, 0, -1);
        if (timeline == null) {
            return List.of();
        }
        return timeline;
    }

    /** Strip SESSION- or LOCAL- prefix added by the Python agent. */
    private String stripAgentPrefix(String sessionId) {
        if (sessionId == null) return null;
        if (sessionId.startsWith("SESSION-")) return sessionId.substring(8);
        if (sessionId.startsWith("LOCAL-"))   return sessionId.substring(6);
        return sessionId;
    }
}
