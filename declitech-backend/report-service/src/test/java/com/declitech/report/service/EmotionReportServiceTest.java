package com.declitech.report.service;

import com.declitech.report.dto.EmotionReportDTO;
import com.declitech.report.model.EmotionReport;
import com.declitech.report.repository.EmotionReportRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Tests unitaires — EmotionReportService")
class EmotionReportServiceTest {

    @Mock private EmotionReportRepository reportRepository;
    @Mock private ObjectMapper objectMapper;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private AlertService alertService;

    @InjectMocks
    private EmotionReportService reportService;

    private EmotionReport sampleReport;
    private EmotionReportDTO sampleDTO;

    @BeforeEach
    void setUp() {
        sampleReport = new EmotionReport();
        sampleReport.setId(1L);
        sampleReport.setSessionId(42L);
        sampleReport.setStudentLoginIdentity("eya@declitech.com");
        sampleReport.setEmotionMeans(Map.of(
                "happy", 0.7, "sad", 0.05, "angry", 0.05,
                "fear", 0.05, "neutral", 0.1, "disgust", 0.03, "surprise", 0.02
        ));
        sampleReport.setFinalState("SATISFAIT_ENGAGE");
        sampleReport.setDominantEmotion("happy");
        sampleReport.setGeneratedAt(LocalDateTime.now());

        EmotionReportDTO.SummaryMean summaryMean = new EmotionReportDTO.SummaryMean();
        summaryMean.setDominant("happy");
        summaryMean.setNSamples(10);
        summaryMean.setMeanProbs(Map.of(
                "happy", 0.7, "sad", 0.05, "angry", 0.05,
                "fear", 0.05, "neutral", 0.1, "disgust", 0.03, "surprise", 0.02
        ));

        EmotionReportDTO.FinalState finalState = new EmotionReportDTO.FinalState();
        finalState.setState("SATISFAIT_ENGAGE");
        finalState.setFinalSentence("L'enfant semble satisfait et engagé pendant la séance.");

        sampleDTO = new EmotionReportDTO();
        sampleDTO.setSessionId("SESSION-42");
        sampleDTO.setSessionCode("SESSION-42");
        sampleDTO.setStudentLoginIdentity("eya@declitech.com");
        sampleDTO.setGeneratedAt(LocalDateTime.now());
        sampleDTO.setSummaryMean(summaryMean);
        sampleDTO.setFinalState(finalState);
        sampleDTO.setTimeline(Collections.emptyList());
    }

    // =========================================================
    //  saveReportFromDTO()
    // =========================================================

    @Test
    @DisplayName("saveReportFromDTO - nouveau rapport → sauvegardé en DB")
    void saveReportFromDTO_NewReport_ShouldPersistCorrectly() {
        when(reportRepository.findBySessionIdAndStudentLoginIdentity(42L, "eya@declitech.com"))
                .thenReturn(Optional.empty());
        when(reportRepository.save(any(EmotionReport.class))).thenReturn(sampleReport);

        EmotionReport result = reportService.saveReportFromDTO(sampleDTO);

        assertThat(result).isNotNull();
        assertThat(result.getDominantEmotion()).isEqualTo("happy");
        assertThat(result.getFinalState()).isEqualTo("SATISFAIT_ENGAGE");
        verify(reportRepository).save(any(EmotionReport.class));
    }

    @Test
    @DisplayName("saveReportFromDTO - rapport existant → mis à jour (pas de doublon)")
    void saveReportFromDTO_ExistingReport_ShouldUpdateAndNotDuplicate() {
        when(reportRepository.findBySessionIdAndStudentLoginIdentity(42L, "eya@declitech.com"))
                .thenReturn(Optional.of(sampleReport));
        when(reportRepository.save(any(EmotionReport.class))).thenReturn(sampleReport);

        EmotionReport result = reportService.saveReportFromDTO(sampleDTO);

        assertThat(result).isNotNull();
        verify(reportRepository, times(1)).save(sampleReport);
    }

    @Test
    @DisplayName("saveReportFromDTO - sessionId mismatch → fallback by sessionCode (no duplicate)")
    void saveReportFromDTO_SessionIdMismatch_FallsBackToSessionCode() {
        EmotionReportDTO dto = new EmotionReportDTO();
        dto.setSessionId("SESSION-999");
        dto.setSessionCode("ABC123");
        dto.setStudentLoginIdentity("eya@declitech.com");
        dto.setGeneratedAt(LocalDateTime.now());

        EmotionReport seedRow = new EmotionReport();
        seedRow.setId(7L);
        seedRow.setSessionId(42L);
        seedRow.setSessionCode("ABC123");
        seedRow.setStudentLoginIdentity("eya@declitech.com");

        when(reportRepository.findBySessionIdAndStudentLoginIdentity(999L, "eya@declitech.com"))
                .thenReturn(Optional.empty());
        when(reportRepository.findBySessionCodeAndStudentLoginIdentity("ABC123", "eya@declitech.com"))
                .thenReturn(Optional.of(seedRow));
        when(reportRepository.save(any(EmotionReport.class))).thenAnswer(inv -> inv.getArgument(0));

        EmotionReport result = reportService.saveReportFromDTO(dto);

        assertThat(result).isSameAs(seedRow);
        assertThat(result.getId()).isEqualTo(7L);
        assertThat(result.getSessionId()).isEqualTo(999L);
        assertThat(result.getSessionCode()).isEqualTo("ABC123");
        verify(reportRepository, times(1)).save(seedRow);
    }

    @Test
    @DisplayName("saveReportFromDTO - sessionId missing in DTO → still finds row via sessionCode")
    void saveReportFromDTO_SessionIdMissing_StillFindsViaSessionCode() {
        EmotionReportDTO dto = new EmotionReportDTO();
        dto.setSessionCode("ABC123");
        dto.setStudentLoginIdentity("eya@declitech.com");
        dto.setGeneratedAt(LocalDateTime.now());

        EmotionReport seedRow = new EmotionReport();
        seedRow.setId(7L);
        seedRow.setSessionId(42L);
        seedRow.setSessionCode("ABC123");
        seedRow.setStudentLoginIdentity("eya@declitech.com");

        when(reportRepository.findBySessionCodeAndStudentLoginIdentity("ABC123", "eya@declitech.com"))
                .thenReturn(Optional.of(seedRow));
        when(reportRepository.save(any(EmotionReport.class))).thenAnswer(inv -> inv.getArgument(0));

        EmotionReport result = reportService.saveReportFromDTO(dto);

        assertThat(result).isSameAs(seedRow);
        assertThat(result.getSessionId()).isEqualTo(42L);
        verify(reportRepository, never()).findBySessionIdAndStudentLoginIdentity(anyLong(), anyString());
        verify(reportRepository, times(1)).save(seedRow);
    }

    // =========================================================
    //  getReportsBySessionId()
    // =========================================================

    @Test
    @DisplayName("getReportsBySessionId - rapport existant → liste avec un élément")
    void getReportsBySessionId_Exists_ShouldReturnList() {
        when(reportRepository.findBySessionId(42L)).thenReturn(List.of(sampleReport));

        List<EmotionReport> result = reportService.getReportsBySessionId(42L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getStudentLoginIdentity()).isEqualTo("eya@declitech.com");
    }

    @Test
    @DisplayName("getReportsBySessionId - aucun rapport → liste vide")
    void getReportsBySessionId_NotFound_ShouldReturnEmptyList() {
        when(reportRepository.findBySessionId(999L)).thenReturn(Collections.emptyList());

        List<EmotionReport> result = reportService.getReportsBySessionId(999L);

        assertThat(result).isEmpty();
    }

    // =========================================================
    //  getReportCountBySessionId()
    // =========================================================

    @Test
    @DisplayName("getReportCountBySessionId - retourne le bon compte")
    void getReportCountBySessionId_ShouldReturnCorrectCount() {
        when(reportRepository.countBySessionId(42L)).thenReturn(5);

        Integer count = reportService.getReportCountBySessionId(42L);

        assertThat(count).isEqualTo(5);
    }

    @Test
    @DisplayName("getReportCountBySessionId - repository retourne null → retourne 0")
    void getReportCountBySessionId_NullFromRepo_ShouldReturnZero() {
        when(reportRepository.countBySessionId(99L)).thenReturn(null);

        Integer count = reportService.getReportCountBySessionId(99L);

        assertThat(count).isEqualTo(0);
    }

    // =========================================================
    //  getStudentStatistics()
    // =========================================================

    @Test
    @DisplayName("getStudentStatistics - étudiant sans rapport → message 'no reports found'")
    void getStudentStatistics_NoReports_ShouldReturnEmptyMessage() {
        when(reportRepository.findByStudentLoginIdentity("unknown@test.com"))
                .thenReturn(Collections.emptyList());

        Map<String, Object> stats = reportService.getStudentStatistics("unknown@test.com");

        assertThat(stats).containsKey("message");
        assertThat(stats.get("message").toString()).contains("No reports found");
    }

    @Test
    @DisplayName("getStudentStatistics - étudiant avec rapports → statistiques calculées")
    void getStudentStatistics_WithReports_ShouldReturnCalculatedStats() {
        when(reportRepository.findByStudentLoginIdentity("eya@declitech.com"))
                .thenReturn(List.of(sampleReport));

        Map<String, Object> stats = reportService.getStudentStatistics("eya@declitech.com");

        assertThat(stats).containsKeys("totalSessions", "averageEmotions", "stateFrequency");
        assertThat(stats.get("totalSessions")).isEqualTo(1);

        @SuppressWarnings("unchecked")
        Map<String, Double> avgEmotions = (Map<String, Double>) stats.get("averageEmotions");
        assertThat(avgEmotions.get("happy")).isEqualTo(0.7);
    }

    // =========================================================
    //  getDistinctParticipantCountBySessionId()
    // =========================================================

    @Test
    @DisplayName("getDistinctParticipantCountBySessionId - retourne le bon nombre de participants")
    void getDistinctParticipantCount_ShouldReturnCorrectCount() {
        when(reportRepository.countDistinctParticipantsBySessionId(42L)).thenReturn(12L);

        Long count = reportService.getDistinctParticipantCountBySessionId(42L);

        assertThat(count).isEqualTo(12L);
    }

    @Test
    @DisplayName("getDistinctParticipantCountBySessionId - null du repo → 0L")
    void getDistinctParticipantCount_NullFromRepo_ShouldReturnZero() {
        when(reportRepository.countDistinctParticipantsBySessionId(99L)).thenReturn(null);

        Long count = reportService.getDistinctParticipantCountBySessionId(99L);

        assertThat(count).isEqualTo(0L);
    }
}
