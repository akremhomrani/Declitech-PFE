package com.declitech.report.service.agent;

import com.declitech.report.dto.EmotionReportDTO;
import com.declitech.report.dto.agent.EmotionFrameRequest;
import com.declitech.report.service.EmotionReportService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmotionTimelineService {

    private static final long TIMELINE_TTL_HOURS = 24;
    private static final int EXPECTED_SAMPLES_PER_SESSION = 20;

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final EmotionAggregator aggregator;
    private final ReliabilityNarrative narrative;
    private final EmotionReportService emotionReportService;

    public void recordFrame(EmotionFrameRequest request) {
        String sessionKey = chooseSessionKey(request);
        appendToTimeline(sessionKey, request);
        aggregator.ingest(sessionKey, request);
    }

    public void finalizeSession(String sessionId, String sessionCode, String loginIdentity) {
        String sessionKey = sessionCode != null && !sessionCode.isBlank() ? sessionCode : sessionId;
        EmotionAggregator.Aggregate agg = aggregator.snapshot(sessionKey, loginIdentity);
        if (agg.isEmpty()) {
            log.info("Finalize skipped — no aggregate found sessionKey={} student={}", sessionKey, loginIdentity);
            return;
        }

        double reliability = agg.reliability(EXPECTED_SAMPLES_PER_SESSION);
        ReliabilityNarrative.Confidence confidence = narrative.classify(reliability, agg.nUsable);
        String dominant = agg.dominant();
        double dominantFreq = agg.dominantFrequency.getOrDefault(dominant, 0.0);

        EmotionReportDTO dto = buildDto(sessionId, sessionCode, loginIdentity, agg,
                reliability, confidence, dominant, dominantFreq);

        emotionReportService.saveReportFromDTO(dto);
        log.info("Finalized emotion report sessionKey={} student={} samples={} usable={} dominant={} reliability={}",
                sessionKey, loginIdentity, agg.nTotal, agg.nUsable, dominant, String.format("%.2f", reliability));

        aggregator.clear(sessionKey, loginIdentity);
        redis.delete(timelineKey(sessionKey, loginIdentity));
    }

    private void appendToTimeline(String sessionKey, EmotionFrameRequest req) {
        String key = timelineKey(sessionKey, req.getStudentLoginIdentity());
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("ts", req.getTimestamp() == null ? LocalDateTime.now().toString() : req.getTimestamp());
        entry.put("status", req.getStatus() == null ? "ok" : req.getStatus());
        entry.put("dominant", req.getDominant());
        entry.put("probs", req.getProbabilities() == null ? Map.of() : req.getProbabilities());
        entry.put("quality", req.getMeanQuality());
        entry.put("confidence", req.getMeanConfidence());
        entry.put("stability", req.getStability());
        entry.put("model", req.getModelVersion());
        try {
            redis.opsForList().rightPush(key, objectMapper.writeValueAsString(entry));
            redis.expire(key, TIMELINE_TTL_HOURS, TimeUnit.HOURS);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize emotion frame: {}", e.getMessage());
        }
    }

    private EmotionReportDTO buildDto(String sessionId, String sessionCode, String loginIdentity,
                                      EmotionAggregator.Aggregate agg, double reliability,
                                      ReliabilityNarrative.Confidence confidence,
                                      String dominant, double dominantFreq) {
        EmotionReportDTO dto = new EmotionReportDTO();
        dto.setSessionId(sessionId);
        dto.setSessionCode(sessionCode);
        dto.setStudentLoginIdentity(loginIdentity);
        dto.setGeneratedAt(LocalDateTime.now());
        dto.setModelVersion(agg.modelVersion);
        dto.setClassLabels(EmotionAggregator.EMOTION_CLASSES);
        dto.setStatus("COMPLETED");

        EmotionReportDTO.SummaryMean summary = new EmotionReportDTO.SummaryMean();
        summary.setMeanProbs(agg.weightedMean);
        summary.setDominant(dominant);
        summary.setNSamples(agg.nUsable);
        dto.setSummaryMean(summary);

        EmotionReportDTO.FinalState finalState = new EmotionReportDTO.FinalState();
        finalState.setState(dominant);
        finalState.setFinalSentence(narrative.narrative(confidence, dominant, dominantFreq,
                agg.engagement(), agg.meanStability));
        finalState.setFreq(agg.dominantFrequency);
        finalState.setMeanProbs(agg.weightedMean);
        dto.setFinalState(finalState);

        EmotionReportDTO.Diagnostics diag = new EmotionReportDTO.Diagnostics();
        diag.setBaselineMeans(agg.baselineMean);
        diag.setDeltaFromBaseline(agg.deltaFromBaseline);
        diag.setDominantFrequency(agg.dominantFrequency);
        diag.setEngagementScore((float) agg.engagement());
        diag.setStabilityScore((float) Math.max(0, Math.min(1, agg.meanStability)));
        diag.setReliabilityScore((float) reliability);
        diag.setNarrativeConfidence(narrative.shortLabel(confidence));
        diag.setFaceCoveragePct(agg.faceCoveragePct);
        diag.setLowConfidencePct(agg.lowConfidencePct);
        diag.setMultiFacePct(agg.multiFacePct);
        diag.setOffTaskPct(agg.offTaskPct);
        diag.setCameraBlockedPct(agg.cameraBlockedPct);
        diag.setNTotal(agg.nTotal);
        diag.setNUsable(agg.nUsable);
        dto.setDiagnostics(diag);
        return dto;
    }

    private String chooseSessionKey(EmotionFrameRequest req) {
        if (req.getSessionCode() != null && !req.getSessionCode().isBlank()) return req.getSessionCode();
        if (req.getSessionId() != null && !req.getSessionId().isBlank()) return req.getSessionId();
        return "unknown";
    }

    private String timelineKey(String sessionKey, String loginIdentity) {
        return "emotion_timeline:" + sessionKey + ":" + loginIdentity;
    }

    public List<String> getLiveTimelineFromRedis(String sessionKey, String loginIdentity) {
        List<String> entries = redis.opsForList().range(timelineKey(sessionKey, loginIdentity), 0, -1);
        return entries == null ? List.of() : entries;
    }
}
