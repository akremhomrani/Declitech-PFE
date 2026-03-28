package com.declitech.report.service;

import com.declitech.report.dto.EmotionReportDTO;
import com.declitech.report.model.EmotionReport;
import com.declitech.report.model.EmotionTimeline;
import com.declitech.report.repository.EmotionReportRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EmotionReportService {

    private final EmotionReportRepository reportRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public EmotionReport importReportFromJson(String jsonFilePath) throws Exception {
        File jsonFile = new File(jsonFilePath);
        EmotionReportDTO dto = objectMapper.readValue(jsonFile, EmotionReportDTO.class);
        
        return saveReportFromDTO(dto);
    }

    @Transactional
    public EmotionReport saveReportFromDTO(EmotionReportDTO dto) {
        Optional<EmotionReport> existingReport = reportRepository.findBySessionId(dto.getSessionId());
        EmotionReport report;
        
        if (existingReport.isPresent()) {
            report = existingReport.get();
        } else {
            report = new EmotionReport();
        }
        
        report.setSessionId_legacy(dto.getSessionId());
        report.setSessionCode(dto.getSessionCode() != null ? dto.getSessionCode() : dto.getSessionId());
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
        
        if (dto.getTimeline() != null && !dto.getTimeline().isEmpty()) {
            List<EmotionTimeline> timelineEntries = new ArrayList<>();
            
            for (EmotionReportDTO.TimelineEntry entry : dto.getTimeline()) {
                EmotionTimeline timeline = new EmotionTimeline();
                timeline.setReport(report);
                timeline.setTimestamp(parseTimestamp(entry.getTs()));
                timeline.setStatus(entry.getStatus());
                timeline.setDominantEmotion(entry.getDominant());
                
                if (entry.getProbs() != null) {
                    Map<String, Double> probs = entry.getProbs();
                    timeline.setAngry(probs.getOrDefault("angry", 0.0));
                    timeline.setDisgust(probs.getOrDefault("disgust", 0.0));
                    timeline.setFear(probs.getOrDefault("fear", 0.0));
                    timeline.setHappy(probs.getOrDefault("happy", 0.0));
                    timeline.setSad(probs.getOrDefault("sad", 0.0));
                    timeline.setSurprise(probs.getOrDefault("surprise", 0.0));
                    timeline.setNeutral(probs.getOrDefault("neutral", 0.0));
                }
                
                timeline.setErrorMessage(entry.getError());
                timelineEntries.add(timeline);
            }
            
            if (report.getTimeline() != null) {
                report.getTimeline().clear();
                report.getTimeline().addAll(timelineEntries);
            } else {
                report.setTimeline(timelineEntries);
            }
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

    private LocalDateTime parseTimestamp(String timestamp) {
        try {
            return LocalDateTime.parse(timestamp, DateTimeFormatter.ISO_DATE_TIME);
        } catch (Exception e) {
            return LocalDateTime.now();
        }
    }
}
