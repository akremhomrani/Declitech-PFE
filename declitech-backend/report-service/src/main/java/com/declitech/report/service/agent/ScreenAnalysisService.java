package com.declitech.report.service.agent;

import com.declitech.report.dto.agent.AnalysisSampleRequest;
import com.declitech.report.dto.agent.DomCodeRequest;
import com.declitech.report.dto.agent.ScreenAnalysisResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScreenAnalysisService {

    private final OpenRouterClient openRouterClient;
    private final AnalysisStore analysisStore;
    private final DomCodeService domCodeService;
    private final ObjectMapper objectMapper;

    public String extractOutput(AnalysisSampleRequest request) {
        if (request.getStudentLoginIdentity() == null || request.getStudentLoginIdentity().isBlank()) {
            return null;
        }
        String visionOutput = openRouterClient.extractConsoleOutput(request.getImageBase64());

        DomCodeRequest entry = new DomCodeRequest();
        entry.setSessionCode(request.getSessionCode());
        entry.setStudentLoginIdentity(request.getStudentLoginIdentity());
        entry.setTimestamp(request.getTimestamp());
        entry.setActivityId(request.getActivityId());
        entry.setActivity(request.getActivity());
        entry.setSource("vision");
        entry.setTrigger("run");
        entry.setExecuted(true);
        entry.setCode(request.getExtractedCode());
        entry.setConsoleOutput(visionOutput == null ? "" : visionOutput);
        domCodeService.append(entry);

        log.info("output-vision stored session={} student={} outputLen={}",
                request.getSessionCode(), request.getStudentLoginIdentity(),
                visionOutput == null ? 0 : visionOutput.length());
        return visionOutput;
    }

    public String analyze(AnalysisSampleRequest request) {
        if (request.getStudentLoginIdentity() == null || request.getStudentLoginIdentity().isBlank()) {
            return "SKIPPED_NO_IDENTITY";
        }
        String sessionKey = chooseSessionKey(request);

        String content = openRouterClient.analyze(request);
        ScreenAnalysisResult result = parse(content);
        if (result == null) {
            result = fallback(request);
        }
        result.setMatiere(request.getMatiere() == null ? "python" : request.getMatiere());
        result.setTrigger(request.getTrigger());
        result.setTimestamp(request.getTimestamp() == null
                ? LocalDateTime.now().toString() : request.getTimestamp());

        analysisStore.append(sessionKey, request.getStudentLoginIdentity(), result);
        log.info("Analysis stored sessionKey={} student={} activity={} executed={} hasError={}",
                sessionKey, request.getStudentLoginIdentity(),
                result.getActivity(), result.getExecuted(), result.getHasError());
        return openRouterClient.isConfigured() ? "RECORDED" : "RECORDED_FALLBACK";
    }

    private ScreenAnalysisResult parse(String content) {
        if (content == null || content.isBlank()) return null;
        String json = extractJson(content);
        try {
            return objectMapper.readValue(json, ScreenAnalysisResult.class);
        } catch (Exception e) {
            log.warn("Failed to parse model JSON: {}", e.getMessage());
            return null;
        }
    }

    private String extractJson(String content) {
        String trimmed = content.trim();
        if (trimmed.startsWith("```")) {
            int firstBrace = trimmed.indexOf('{');
            int lastBrace = trimmed.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) {
                return trimmed.substring(firstBrace, lastBrace + 1);
            }
        }
        return trimmed;
    }

    private ScreenAnalysisResult fallback(AnalysisSampleRequest request) {
        ScreenAnalysisResult result = new ScreenAnalysisResult();
        result.setOnInterface(true);
        result.setActivity("coding");
        boolean hasCode = request.getExtractedCode() != null && !request.getExtractedCode().isBlank();
        result.setHasCode(hasCode);
        result.setCodeExcerpt(request.getExtractedCode());
        result.setOutput(request.getExtractedOutput());
        result.setExecuted(request.getExtractedOutput() != null && !request.getExtractedOutput().isBlank());
        result.setHasError(false);
        result.setConfidence(0.0);
        result.setEngagement("active");
        return result;
    }

    private String chooseSessionKey(AnalysisSampleRequest req) {
        if (req.getSessionCode() != null && !req.getSessionCode().isBlank()) return req.getSessionCode();
        if (req.getSessionId() != null && !req.getSessionId().isBlank()) return req.getSessionId();
        return "unknown";
    }
}
