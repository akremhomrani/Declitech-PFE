package com.declitech.report.service.agent;

import com.declitech.report.dto.agent.ScreenAnalysisResult;
import com.declitech.report.dto.agent.SessionAnalysisSummary;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class JsonFileAnalysisStore implements AnalysisStore {

    private final ObjectMapper objectMapper;
    private final Path baseDir;
    private final ConcurrentHashMap<String, Object> locks = new ConcurrentHashMap<>();

    public JsonFileAnalysisStore(ObjectMapper objectMapper,
                                 @Value("${analysis.storage.dir:data/analysis}") String dir) {
        this.objectMapper = objectMapper;
        this.baseDir = Paths.get(dir).toAbsolutePath();
        ensureBaseDir();
    }

    @Override
    public void append(String sessionKey, String loginIdentity, ScreenAnalysisResult result) {
        String key = fileKey(sessionKey, loginIdentity);
        synchronized (lockFor(key)) {
            List<ScreenAnalysisResult> existing = read(sessionKey, loginIdentity);
            existing.add(result);
            writeJson(analysisPath(key), existing);
        }
    }

    @Override
    public List<ScreenAnalysisResult> read(String sessionKey, String loginIdentity) {
        Path path = analysisPath(fileKey(sessionKey, loginIdentity));
        if (!Files.exists(path)) return new ArrayList<>();
        try {
            return objectMapper.readValue(path.toFile(), new TypeReference<List<ScreenAnalysisResult>>() {});
        } catch (IOException e) {
            log.warn("Failed to read analysis file {}: {}", path, e.getMessage());
            return new ArrayList<>();
        }
    }

    @Override
    public void saveSummary(String sessionKey, String loginIdentity, SessionAnalysisSummary summary) {
        writeJson(summaryPath(fileKey(sessionKey, loginIdentity)), summary);
    }

    @Override
    public SessionAnalysisSummary readSummary(String sessionKey, String loginIdentity) {
        Path path = summaryPath(fileKey(sessionKey, loginIdentity));
        if (!Files.exists(path)) return null;
        try {
            return objectMapper.readValue(path.toFile(), SessionAnalysisSummary.class);
        } catch (IOException e) {
            log.warn("Failed to read summary file {}: {}", path, e.getMessage());
            return null;
        }
    }

    @Override
    public void clear(String sessionKey, String loginIdentity) {
        String key = fileKey(sessionKey, loginIdentity);
        synchronized (lockFor(key)) {
            deleteQuietly(analysisPath(key));
        }
    }

    private void writeJson(Path path, Object value) {
        try {
            ensureBaseDir();
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(path.toFile(), value);
        } catch (IOException e) {
            log.warn("Failed to write {}: {}", path, e.getMessage());
        }
    }

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException e) {
            log.warn("Failed to delete {}: {}", path, e.getMessage());
        }
    }

    private void ensureBaseDir() {
        try {
            Files.createDirectories(baseDir);
        } catch (IOException e) {
            log.warn("Failed to create analysis dir {}: {}", baseDir, e.getMessage());
        }
    }

    private Object lockFor(String key) {
        return locks.computeIfAbsent(key, k -> new Object());
    }

    private Path analysisPath(String key) {
        return baseDir.resolve("analysis_" + key + ".json");
    }

    private Path summaryPath(String key) {
        return baseDir.resolve("summary_" + key + ".json");
    }

    private String fileKey(String sessionKey, String loginIdentity) {
        return sanitize(sessionKey) + "_" + sanitize(loginIdentity);
    }

    private String sanitize(String value) {
        if (value == null || value.isBlank()) return "unknown";
        return value.replaceAll("[^A-Za-z0-9._-]", "-");
    }
}
