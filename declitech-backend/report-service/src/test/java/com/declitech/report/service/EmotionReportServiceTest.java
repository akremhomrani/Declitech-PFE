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

    @InjectMocks
    private EmotionReportService reportService;

    private EmotionReport sampleReport;
    private EmotionReportDTO sampleDTO;

    @BeforeEach
    void setUp() {
        sampleReport = new EmotionReport();
        sampleReport.setId(1L);
        sampleReport.setSessionCode("SESSION-ABC");
        sampleReport.setStudentLoginIdentity("eya@declitech.com");
        sampleReport.setHappyMean(0.7);
        sampleReport.setAngryMean(0.05);
        sampleReport.setSadMean(0.05);
        sampleReport.setFearMean(0.05);
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
        sampleDTO.setSessionId("SESSION-ABC");
        sampleDTO.setSessionCode("SESSION-ABC");
        sampleDTO.setParticipantId("PARTICIPANT-001");
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
        when(reportRepository.findBySessionId("SESSION-ABC")).thenReturn(Optional.empty());
        when(reportRepository.save(any(EmotionReport.class))).thenReturn(sampleReport);

        EmotionReport result = reportService.saveReportFromDTO(sampleDTO);

        assertThat(result).isNotNull();
        assertThat(result.getSessionCode()).isEqualTo("SESSION-ABC");
        assertThat(result.getDominantEmotion()).isEqualTo("happy");
        assertThat(result.getFinalState()).isEqualTo("SATISFAIT_ENGAGE");
        verify(reportRepository).save(any(EmotionReport.class));
    }

    @Test
    @DisplayName("saveReportFromDTO - rapport existant → mis à jour (pas de doublon)")
    void saveReportFromDTO_ExistingReport_ShouldUpdateAndNotDuplicate() {
        when(reportRepository.findBySessionId("SESSION-ABC")).thenReturn(Optional.of(sampleReport));
        when(reportRepository.save(any(EmotionReport.class))).thenReturn(sampleReport);

        EmotionReport result = reportService.saveReportFromDTO(sampleDTO);

        assertThat(result).isNotNull();
        // Vérifie qu'on sauvegarde le rapport existant, pas un nouveau
        verify(reportRepository, times(1)).save(sampleReport);
    }

    // =========================================================
    //  getReportBySessionId()
    // =========================================================

    @Test
    @DisplayName("getReportBySessionId - rapport existant → Optional.of(rapport)")
    void getReportBySessionId_Exists_ShouldReturnReport() {
        when(reportRepository.findBySessionId("SESSION-ABC")).thenReturn(Optional.of(sampleReport));

        Optional<EmotionReport> result = reportService.getReportBySessionId("SESSION-ABC");

        assertThat(result).isPresent();
        assertThat(result.get().getSessionCode()).isEqualTo("SESSION-ABC");
    }

    @Test
    @DisplayName("getReportBySessionId - rapport absent → Optional.empty()")
    void getReportBySessionId_NotFound_ShouldReturnEmptyOptional() {
        when(reportRepository.findBySessionId("UNKNOWN")).thenReturn(Optional.empty());

        Optional<EmotionReport> result = reportService.getReportBySessionId("UNKNOWN");

        assertThat(result).isEmpty();
    }

    // =========================================================
    //  getReportsBySessionCode()
    // =========================================================

    @Test
    @DisplayName("getReportsBySessionCode - retourne la liste des rapports pour la session")
    void getReportsBySessionCode_ShouldReturnList() {
        when(reportRepository.findBySessionCode("SESSION-ABC")).thenReturn(List.of(sampleReport));

        List<EmotionReport> result = reportService.getReportsBySessionCode("SESSION-ABC");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getStudentLoginIdentity()).isEqualTo("eya@declitech.com");
    }

    // =========================================================
    //  getReportCountBySessionCode()
    // =========================================================

    @Test
    @DisplayName("getReportCountBySessionCode - retourne le bon compte")
    void getReportCountBySessionCode_ShouldReturnCorrectCount() {
        when(reportRepository.countBySessionCode("SESSION-ABC")).thenReturn(5);

        Integer count = reportService.getReportCountBySessionCode("SESSION-ABC");

        assertThat(count).isEqualTo(5);
    }

    @Test
    @DisplayName("getReportCountBySessionCode - repository retourne null → retourne 0")
    void getReportCountBySessionCode_NullFromRepo_ShouldReturnZero() {
        when(reportRepository.countBySessionCode("SESSION-XYZ")).thenReturn(null);

        Integer count = reportService.getReportCountBySessionCode("SESSION-XYZ");

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
    //  getDistinctParticipantCountBySessionCode()
    // =========================================================

    @Test
    @DisplayName("getDistinctParticipantCountBySessionCode - retourne le bon nombre de participants")
    void getDistinctParticipantCount_ShouldReturnCorrectCount() {
        when(reportRepository.countDistinctParticipantsBySessionCode("SESSION-ABC")).thenReturn(12L);

        Long count = reportService.getDistinctParticipantCountBySessionCode("SESSION-ABC");

        assertThat(count).isEqualTo(12L);
    }

    @Test
    @DisplayName("getDistinctParticipantCountBySessionCode - null du repo → 0L")
    void getDistinctParticipantCount_NullFromRepo_ShouldReturnZero() {
        when(reportRepository.countDistinctParticipantsBySessionCode("EMPTY")).thenReturn(null);

        Long count = reportService.getDistinctParticipantCountBySessionCode("EMPTY");

        assertThat(count).isEqualTo(0L);
    }
}
