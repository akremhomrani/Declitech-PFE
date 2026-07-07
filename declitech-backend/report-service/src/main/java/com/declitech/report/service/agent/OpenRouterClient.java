package com.declitech.report.service.agent;

import com.declitech.report.dto.agent.AnalysisSampleRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class OpenRouterClient {

    private static final String SYSTEM_PROMPT = """
            You analyze a screenshot plus extracted text from a DecliTech student coding interface
            (Vittascience Python editor). The subject is "python". Reply with ONLY a JSON object,
            no markdown, matching exactly these keys:
            on_interface (boolean), interface (string), activity (one of: idle, reading, coding,
            running, debugging, off_task), has_code (boolean), code_excerpt (string),
            code_intent (string, French), executed (boolean), output (string), has_error (boolean),
            error_summary (string or null), concepts (array of French strings), progress_estimate
            (number 0..1), engagement (one of: passive, active, distracted), confidence (number 0..1).
            Prefer the extracted text over the image for code and output. Be factual; if unsure,
            lower confidence.
            """;

    private final RestClient client;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;
    private final String referer;
    private final String title;

    public OpenRouterClient(@Qualifier("openRouterRestClient") RestClient client,
                            ObjectMapper objectMapper,
                            @Value("${openrouter.api-key:}") String apiKey,
                            @Value("${openrouter.model:qwen/qwen-2.5-vl-72b-instruct}") String model,
                            @Value("${openrouter.referer:https://learn.decli.tech}") String referer,
                            @Value("${openrouter.title:DecliTrack}") String title) {
        this.client = client;
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
        this.referer = referer;
        this.title = title;
    }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public String analyze(AnalysisSampleRequest request) {
        if (!isConfigured()) {
            log.warn("OpenRouter API key missing — skipping analysis");
            return null;
        }
        Map<String, Object> body = buildBody(request);
        try {
            JsonNode response = client.post()
                    .uri("/chat/completions")
                    .header("Authorization", "Bearer " + apiKey)
                    .header("HTTP-Referer", referer)
                    .header("X-Title", title)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
            return extractContent(response);
        } catch (Exception e) {
            log.warn("OpenRouter call failed: {}", e.getMessage());
            return null;
        }
    }

    public String extractConsoleOutput(String imageBase64) {
        if (!isConfigured()) {
            log.warn("OpenRouter API key missing — skipping output vision");
            return null;
        }
        if (imageBase64 == null || imageBase64.isBlank()) return null;

        List<Map<String, Object>> userContent = new ArrayList<>();
        userContent.add(textPart("Return ONLY the program console/terminal output text visible in this screenshot "
                + "(the printed result lines produced by running the code). No source code, no UI labels, no menu "
                + "buttons, no explanation. If there is no output, return an empty string."));
        userContent.add(imagePart(imageBase64));

        List<Map<String, Object>> messages = List.of(
                Map.of("role", "system", "content",
                        "You read a screenshot of a student coding interface and return only the console output text, nothing else."),
                Map.of("role", "user", "content", userContent)
        );

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("temperature", 0.0);
        body.put("max_tokens", 500);

        try {
            JsonNode response = client.post()
                    .uri("/chat/completions")
                    .header("Authorization", "Bearer " + apiKey)
                    .header("HTTP-Referer", referer)
                    .header("X-Title", title)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
            String content = extractContent(response);
            return content == null ? null : content.trim();
        } catch (Exception e) {
            log.warn("OpenRouter output-vision failed: {}", e.getMessage());
            return null;
        }
    }

    public String summarizeSession(String contextJson) {
        if (!isConfigured()) {
            log.warn("OpenRouter API key missing — skipping session summary");
            return null;
        }
        String system = "You are a pedagogical assistant. From a student's coding session data (code and console "
                + "outputs per activity), produce a detailed report in English. Reply ONLY in JSON with the keys: "
                + "workedWell (boolean), difficulty (\"low\"|\"medium\"|\"high\"), errorsCount (number), "
                + "summary (string), activities (array of {activity, note}). "
                + "The summary field must be a developed paragraph of 6 to 9 sentences that: describes the "
                + "student's overall progress, the concepts mastered and those still fragile, the nature of the "
                + "errors encountered and how the student reacted to them, their level of autonomy and "
                + "engagement, then ends with a concrete pedagogical recommendation for what comes next. Stay "
                + "factual and encouraging.";

        List<Map<String, Object>> messages = List.of(
                Map.of("role", "system", "content", system),
                Map.of("role", "user", "content", "Données de la session:\n" + contextJson)
        );

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("temperature", 0.2);
        body.put("max_tokens", 1200);
        body.put("response_format", Map.of("type", "json_object"));

        try {
            JsonNode response = client.post()
                    .uri("/chat/completions")
                    .header("Authorization", "Bearer " + apiKey)
                    .header("HTTP-Referer", referer)
                    .header("X-Title", title)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
            return extractContent(response);
        } catch (Exception e) {
            log.warn("OpenRouter summarize failed: {}", e.getMessage());
            return null;
        }
    }

    private Map<String, Object> buildBody(AnalysisSampleRequest request) {
        List<Map<String, Object>> userContent = new ArrayList<>();
        userContent.add(textPart(buildUserText(request)));
        if (request.getImageBase64() != null && !request.getImageBase64().isBlank()) {
            userContent.add(imagePart(request.getImageBase64()));
        }

        List<Map<String, Object>> messages = List.of(
                Map.of("role", "system", "content", SYSTEM_PROMPT),
                Map.of("role", "user", "content", userContent)
        );

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("temperature", 0.1);
        body.put("max_tokens", 800);
        body.put("response_format", Map.of("type", "json_object"));
        return body;
    }

    private String buildUserText(AnalysisSampleRequest request) {
        String code = request.getExtractedCode() == null ? "" : request.getExtractedCode();
        String output = request.getExtractedOutput() == null ? "" : request.getExtractedOutput();
        return "matiere: python\n"
                + "extracted_code:\n" + code + "\n"
                + "extracted_output:\n" + output + "\n"
                + "Analyze the attached screenshot together with the text above.";
    }

    private Map<String, Object> textPart(String text) {
        return Map.of("type", "text", "text", text);
    }

    private Map<String, Object> imagePart(String imageBase64) {
        String url = imageBase64.startsWith("data:") ? imageBase64 : "data:image/jpeg;base64," + imageBase64;
        return Map.of("type", "image_url", "image_url", Map.of("url", url));
    }

    private String extractContent(JsonNode response) {
        if (response == null) return null;
        JsonNode content = response.path("choices").path(0).path("message").path("content");
        if (content.isMissingNode() || content.isNull()) return null;
        return content.asText();
    }
}
