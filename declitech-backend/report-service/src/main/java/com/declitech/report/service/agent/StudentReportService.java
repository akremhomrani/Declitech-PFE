package com.declitech.report.service.agent;

import com.declitech.report.model.StudentActivityReport;
import com.declitech.report.repository.StudentActivityReportRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class StudentReportService {

    private static final Pattern ERROR_PATTERN =
            Pattern.compile("(?i)(error|traceback|erreur|exception|not defined|invalid|syntaxerror)");
    private static final int MAX_OUTPUTS_PER_ACTIVITY = 6;
    private static final int MAX_CODE_CHARS = 4000;

    private final DomCodeService domCodeService;
    private final OpenRouterClient openRouterClient;
    private final ObjectMapper objectMapper;
    private final StudentActivityReportRepository repository;

    public StudentActivityReport generate(String sessionCode, String loginIdentity) {
        List<Map<String, Object>> entries = domCodeService.read(sessionCode, loginIdentity);
        if (entries.isEmpty()) {
            log.info("Report skipped — no entries session={} student={}", sessionCode, loginIdentity);
            return null;
        }

        Map<String, ActivityAgg> byActivity = aggregate(entries);
        int totalExecutions = byActivity.values().stream().mapToInt(a -> a.executions).sum();
        int totalErrors = byActivity.values().stream().mapToInt(a -> a.errors).sum();

        String context = buildContext(sessionCode, loginIdentity, byActivity);
        JsonNode llm = callModel(context);

        StudentActivityReport report = new StudentActivityReport();
        report.setSessionCode(sessionCode);
        report.setStudentLoginIdentity(loginIdentity);
        report.setActivitiesCount(byActivity.size());
        report.setTotalExecutions(totalExecutions);
        report.setTotalErrors(totalErrors);
        report.setDifficulty(resolveDifficulty(llm, totalErrors, totalExecutions));
        report.setWorkedWell(resolveWorkedWell(llm, totalErrors, totalExecutions));
        report.setSummary(resolveSummary(llm, byActivity, totalExecutions, totalErrors));
        report.setDetails(resolveDetails(llm, byActivity));
        report.setGeneratedAt(LocalDateTime.now());

        StudentActivityReport saved = repository.save(report);
        log.info("Report stored session={} student={} activities={} executions={} errors={} difficulty={}",
                sessionCode, loginIdentity, saved.getActivitiesCount(), totalExecutions, totalErrors, saved.getDifficulty());
        return saved;
    }

    private Map<String, ActivityAgg> aggregate(List<Map<String, Object>> entries) {
        Map<String, ActivityAgg> byActivity = new LinkedHashMap<>();
        for (Map<String, Object> e : entries) {
            String activityId = str(e.get("activityId"));
            String activityName = str(e.get("activity"));
            String key = activityId.isBlank() ? (activityName.isBlank() ? "unknown" : activityName) : activityId;

            ActivityAgg agg = byActivity.computeIfAbsent(key, k -> new ActivityAgg());
            if (agg.name.isBlank() && !activityName.isBlank()) agg.name = activityName;
            agg.activityId = activityId;

            String code = str(e.get("code"));
            if (!code.isBlank()) agg.finalCode = code;

            boolean vision = "vision".equals(str(e.get("source")));
            if (vision) {
                agg.executions++;
                String output = str(e.get("consoleOutput"));
                if (!output.isBlank() && agg.outputs.size() < MAX_OUTPUTS_PER_ACTIVITY) agg.outputs.add(output);
                if (ERROR_PATTERN.matcher(output).find()) agg.errors++;
            }
        }
        return byActivity;
    }

    private String buildContext(String sessionCode, String loginIdentity, Map<String, ActivityAgg> byActivity) {
        Map<String, Object> ctx = new LinkedHashMap<>();
        ctx.put("session", sessionCode);
        ctx.put("student", loginIdentity);
        List<Map<String, Object>> activities = new ArrayList<>();
        for (ActivityAgg a : byActivity.values()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("activity", a.name.isBlank() ? a.activityId : a.name);
            item.put("executions", a.executions);
            item.put("errors", a.errors);
            item.put("finalCode", a.finalCode.length() > MAX_CODE_CHARS
                    ? a.finalCode.substring(0, MAX_CODE_CHARS) : a.finalCode);
            item.put("outputs", a.outputs);
            activities.add(item);
        }
        ctx.put("activities", activities);
        try {
            return objectMapper.writeValueAsString(ctx);
        } catch (Exception e) {
            return ctx.toString();
        }
    }

    private JsonNode callModel(String context) {
        String content = openRouterClient.summarizeSession(context);
        if (content == null || content.isBlank()) return null;
        try {
            return objectMapper.readTree(content);
        } catch (Exception e) {
            log.warn("Failed to parse summary JSON: {}", e.getMessage());
            return null;
        }
    }

    private String resolveDifficulty(JsonNode llm, int errors, int executions) {
        if (llm != null && llm.hasNonNull("difficulty")) return llm.get("difficulty").asText();
        if (errors >= 3) return "high";
        if (errors >= 1) return "medium";
        return "low";
    }

    private boolean resolveWorkedWell(JsonNode llm, int errors, int executions) {
        if (llm != null && llm.has("workedWell")) return llm.get("workedWell").asBoolean();
        return executions > 0 && errors == 0;
    }

    private String resolveSummary(JsonNode llm, Map<String, ActivityAgg> byActivity, int executions, int errors) {
        if (llm != null && llm.hasNonNull("summary")) return llm.get("summary").asText();
        return buildFallbackSummary(byActivity, executions, errors);
    }

    private String buildFallbackSummary(Map<String, ActivityAgg> byActivity, int executions, int errors) {
        int activityCount = byActivity.size();
        StringBuilder sb = new StringBuilder();

        sb.append("The student worked on ").append(activityCount)
                .append(activityCount > 1 ? " activities during this session, " : " activity during this session, ")
                .append("totaling ").append(executions)
                .append(executions > 1 ? " code executions and " : " code execution and ")
                .append(errors).append(errors > 1 ? " errors encountered. " : " error encountered. ");

        if (executions == 0) {
            sb.append("No execution was recorded: the student likely stayed in a reading or reflection phase "
                    + "without running any code yet. ");
        } else if (errors == 0) {
            sb.append("No error was detected across all executions, which shows a good understanding of the "
                    + "instructions and solid autonomy in solving the exercises. ");
        } else if ((double) errors / executions >= 0.5) {
            sb.append("The proportion of errors relative to executions is high, a sign of recurring difficulties "
                    + "that would benefit from targeted support on the concepts involved. ");
        } else {
            sb.append("A few errors occurred during the session but the student progressed overall, which is "
                    + "normal during an active learning phase. ");
        }

        if (!byActivity.isEmpty()) {
            List<String> details = new ArrayList<>();
            for (ActivityAgg a : byActivity.values()) {
                String name = a.name.isBlank() ? a.activityId : a.name;
                details.add("\"" + name + "\" (" + a.executions + " execution(s), " + a.errors + " error(s))");
            }
            sb.append("Breakdown by activity: ").append(String.join(", ", details)).append(". ");
        }

        sb.append(executions > 0 && errors == 0
                ? "It is recommended to now offer slightly more complex exercises to consolidate these skills."
                : "It is recommended to review the points that caused errors with the student and offer "
                        + "targeted reinforcement exercises on these concepts.");

        return sb.toString();
    }

    private String resolveDetails(JsonNode llm, Map<String, ActivityAgg> byActivity) {
        try {
            if (llm != null && llm.has("activities")) return objectMapper.writeValueAsString(llm.get("activities"));
            List<Map<String, Object>> details = new ArrayList<>();
            for (ActivityAgg a : byActivity.values()) {
                Map<String, Object> d = new LinkedHashMap<>();
                d.put("activity", a.name.isBlank() ? a.activityId : a.name);
                d.put("executions", a.executions);
                d.put("errors", a.errors);
                details.add(d);
            }
            return objectMapper.writeValueAsString(details);
        } catch (Exception e) {
            return "[]";
        }
    }

    private String str(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static class ActivityAgg {
        String name = "";
        String activityId = "";
        String finalCode = "";
        int executions = 0;
        int errors = 0;
        List<String> outputs = new ArrayList<>();
    }
}
