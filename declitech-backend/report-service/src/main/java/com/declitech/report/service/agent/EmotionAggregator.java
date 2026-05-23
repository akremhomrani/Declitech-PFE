package com.declitech.report.service.agent;

import com.declitech.report.dto.agent.EmotionFrameRequest;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class EmotionAggregator {

    public static final List<String> EMOTION_CLASSES =
            List.of("angry", "disgust", "fear", "happy", "sad", "surprise", "neutral");
    public static final long TTL_HOURS = 24;
    public static final long BASELINE_WINDOW_MS = 60_000L;

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public String aggregateKey(String sessionKey, String loginIdentity) {
        return "emotion_agg:" + sessionKey + ":" + loginIdentity;
    }

    public void ingest(String sessionKey, EmotionFrameRequest req) {
        String key = aggregateKey(sessionKey, req.getStudentLoginIdentity());
        HashOperations<String, Object, Object> hash = redis.opsForHash();

        long now = System.currentTimeMillis();
        Long firstTs = parseLong(hash.get(key, "first_ts"));
        if (firstTs == null) {
            hash.put(key, "first_ts", String.valueOf(now));
            firstTs = now;
        }
        boolean withinBaseline = (now - firstTs) <= BASELINE_WINDOW_MS;

        incrementCounter(hash, key, "n_total", 1);

        String status = req.getStatus() == null ? "ok" : req.getStatus();
        switch (status) {
            case "no_face"        -> incrementCounter(hash, key, "n_no_face", 1);
            case "low_quality"    -> incrementCounter(hash, key, "n_low_quality", 1);
            case "low_confidence" -> incrementCounter(hash, key, "n_low_confidence", 1);
            case "off_task"       -> incrementCounter(hash, key, "n_off_task", 1);
            case "camera_blocked" -> incrementCounter(hash, key, "n_camera_blocked", 1);
            case "camera_lost"    -> incrementCounter(hash, key, "n_camera_lost", 1);
            case "multi_face"     -> incrementCounter(hash, key, "n_multi_face", 1);
            case "error"          -> incrementCounter(hash, key, "n_error", 1);
            case "ok"             -> ingestUsable(hash, key, req, withinBaseline);
            default               -> log.debug("Unknown sample status: {}", status);
        }

        if (req.getModelVersion() != null) {
            hash.put(key, "model_version", req.getModelVersion());
        }
        redis.expire(key, TTL_HOURS, TimeUnit.HOURS);
    }

    public Aggregate snapshot(String sessionKey, String loginIdentity) {
        String key = aggregateKey(sessionKey, loginIdentity);
        Map<Object, Object> raw = redis.opsForHash().entries(key);
        if (raw.isEmpty()) return Aggregate.empty();

        double sumW = parseDouble(raw.get("sum_w"), 0);
        Map<String, Double> sumWp = decodeJsonDoubleMap(raw.get("sum_wp"));
        Map<String, Double> baselineSum = decodeJsonDoubleMap(raw.get("baseline_sum"));
        double baselineW = parseDouble(raw.get("baseline_sum_w"), 0);
        Map<String, Integer> domCounts = decodeJsonIntMap(raw.get("dominant_counts"));

        Aggregate agg = new Aggregate();
        agg.modelVersion = stringOrNull(raw.get("model_version"));
        agg.weightedMean = sumW > 1e-9 ? divideMap(sumWp, sumW) : zeroMap();
        agg.baselineMean = baselineW > 1e-9 ? divideMap(baselineSum, baselineW) : zeroMap();
        agg.deltaFromBaseline = subtractMap(agg.weightedMean, agg.baselineMean);
        agg.dominantFrequency = frequencyMap(domCounts);

        agg.meanQuality = parseDouble(raw.get("sum_q"), 0) / Math.max(1L, parseLong(raw.get("n_usable"), 1L));
        agg.meanConfidence = parseDouble(raw.get("sum_conf"), 0) / Math.max(1L, parseLong(raw.get("n_usable"), 1L));
        agg.meanStability = parseDouble(raw.get("sum_stability"), 0) / Math.max(1L, parseLong(raw.get("n_usable"), 1L));

        agg.nTotal = parseInt(raw.get("n_total"), 0);
        agg.nUsable = parseInt(raw.get("n_usable"), 0);
        agg.nNoFace = parseInt(raw.get("n_no_face"), 0);
        agg.nLowConfidence = parseInt(raw.get("n_low_confidence"), 0);
        agg.nLowQuality = parseInt(raw.get("n_low_quality"), 0);
        agg.nOffTask = parseInt(raw.get("n_off_task"), 0);
        agg.nCameraBlocked = parseInt(raw.get("n_camera_blocked"), 0);
        agg.nCameraLost = parseInt(raw.get("n_camera_lost"), 0);
        agg.nMultiFace = parseInt(raw.get("n_multi_face"), 0);

        agg.faceCoveragePct = ratio(agg.nTotal - agg.nNoFace - agg.nOffTask - agg.nCameraBlocked - agg.nCameraLost, agg.nTotal);
        agg.lowConfidencePct = ratio(agg.nLowConfidence, agg.nTotal);
        agg.multiFacePct = ratio(agg.nMultiFace, agg.nTotal);
        agg.offTaskPct = ratio(agg.nOffTask, agg.nTotal);
        agg.cameraBlockedPct = ratio(agg.nCameraBlocked + agg.nCameraLost, agg.nTotal);

        return agg;
    }

    public void clear(String sessionKey, String loginIdentity) {
        redis.delete(aggregateKey(sessionKey, loginIdentity));
    }

    private void ingestUsable(HashOperations<String, Object, Object> hash, String key,
                              EmotionFrameRequest req, boolean withinBaseline) {
        if (req.getProbabilities() == null || req.getProbabilities().isEmpty()) return;

        double w = clamp(coalesce(req.getMeanQuality()), 0, 1)
                * clamp(coalesce(req.getMeanConfidence()), 0, 1);
        if (w <= 0) return;

        Map<String, Double> sumWp = decodeJsonDoubleMap(hash.get(key, "sum_wp"));
        Map<String, Double> baselineSum = decodeJsonDoubleMap(hash.get(key, "baseline_sum"));
        Map<String, Integer> domCounts = decodeJsonIntMap(hash.get(key, "dominant_counts"));

        for (String c : EMOTION_CLASSES) {
            double p = doubleOr(req.getProbabilities().get(c), 0);
            sumWp.merge(c, w * p, Double::sum);
            if (withinBaseline) baselineSum.merge(c, w * p, Double::sum);
        }

        if (req.getDominant() != null) {
            domCounts.merge(req.getDominant(), 1, Integer::sum);
        }

        incrementCounter(hash, key, "n_usable", 1);
        incrementDouble(hash, key, "sum_w", w);
        incrementDouble(hash, key, "sum_q", coalesce(req.getMeanQuality()));
        incrementDouble(hash, key, "sum_conf", coalesce(req.getMeanConfidence()));
        incrementDouble(hash, key, "sum_stability", coalesce(req.getStability()));
        if (withinBaseline) incrementDouble(hash, key, "baseline_sum_w", w);

        hash.put(key, "sum_wp", encodeJson(sumWp));
        hash.put(key, "baseline_sum", encodeJson(baselineSum));
        hash.put(key, "dominant_counts", encodeJson(domCounts));
    }

    private void incrementCounter(HashOperations<String, Object, Object> hash, String key, String field, long by) {
        hash.increment(key, field, by);
    }

    private void incrementDouble(HashOperations<String, Object, Object> hash, String key, String field, double by) {
        hash.increment(key, field, by);
    }

    private Map<String, Double> decodeJsonDoubleMap(Object raw) {
        if (raw == null) return blankMap();
        try {
            Map<String, Double> parsed = objectMapper.readValue(String.valueOf(raw), new TypeReference<>() {});
            Map<String, Double> out = blankMap();
            out.putAll(parsed);
            return out;
        } catch (Exception e) {
            return blankMap();
        }
    }

    private Map<String, Integer> decodeJsonIntMap(Object raw) {
        if (raw == null) return new LinkedHashMap<>();
        try {
            return objectMapper.readValue(String.valueOf(raw), new TypeReference<>() {});
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    private String encodeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "{}";
        }
    }

    private Map<String, Double> blankMap() {
        Map<String, Double> out = new LinkedHashMap<>();
        for (String c : EMOTION_CLASSES) out.put(c, 0.0);
        return out;
    }

    private Map<String, Double> zeroMap() { return blankMap(); }

    private Map<String, Double> divideMap(Map<String, Double> num, double denom) {
        Map<String, Double> out = new LinkedHashMap<>();
        for (String c : EMOTION_CLASSES) out.put(c, num.getOrDefault(c, 0.0) / denom);
        return out;
    }

    private Map<String, Double> subtractMap(Map<String, Double> a, Map<String, Double> b) {
        Map<String, Double> out = new LinkedHashMap<>();
        for (String c : EMOTION_CLASSES) out.put(c, a.getOrDefault(c, 0.0) - b.getOrDefault(c, 0.0));
        return out;
    }

    private Map<String, Double> frequencyMap(Map<String, Integer> counts) {
        int total = counts.values().stream().mapToInt(Integer::intValue).sum();
        Map<String, Double> out = new LinkedHashMap<>();
        if (total == 0) return out;
        counts.forEach((k, v) -> out.put(k, (double) v / total));
        return out;
    }

    private static float ratio(int part, int total) {
        return total == 0 ? 0f : (float) part / total;
    }

    private static double coalesce(Double v) { return v == null ? 0 : v; }

    private static double doubleOr(Object o, double fallback) {
        if (o instanceof Number n) return n.doubleValue();
        if (o == null) return fallback;
        try { return Double.parseDouble(String.valueOf(o)); }
        catch (NumberFormatException e) { return fallback; }
    }

    private static double parseDouble(Object o, double fallback) {
        if (o == null) return fallback;
        try { return Double.parseDouble(String.valueOf(o)); }
        catch (NumberFormatException e) { return fallback; }
    }

    private static int parseInt(Object o, int fallback) {
        if (o == null) return fallback;
        try { return Integer.parseInt(String.valueOf(o)); }
        catch (NumberFormatException e) { return fallback; }
    }

    private static Long parseLong(Object o) { return parseLong(o, null); }
    private static Long parseLong(Object o, Long fallback) {
        if (o == null) return fallback;
        try { return Long.parseLong(String.valueOf(o)); }
        catch (NumberFormatException e) { return fallback; }
    }

    private static String stringOrNull(Object o) { return o == null ? null : String.valueOf(o); }

    private static double clamp(double v, double lo, double hi) { return Math.max(lo, Math.min(hi, v)); }

    public static class Aggregate {
        public Map<String, Double> weightedMean;
        public Map<String, Double> baselineMean;
        public Map<String, Double> deltaFromBaseline;
        public Map<String, Double> dominantFrequency;
        public double meanQuality;
        public double meanConfidence;
        public double meanStability;
        public int nTotal;
        public int nUsable;
        public int nNoFace;
        public int nLowQuality;
        public int nLowConfidence;
        public int nOffTask;
        public int nCameraBlocked;
        public int nCameraLost;
        public int nMultiFace;
        public float faceCoveragePct;
        public float lowConfidencePct;
        public float multiFacePct;
        public float offTaskPct;
        public float cameraBlockedPct;
        public String modelVersion;

        public static Aggregate empty() { return new Aggregate(); }

        public boolean isEmpty() { return nTotal == 0; }

        public double reliability(int expectedSamples) {
            if (nTotal == 0 || nUsable == 0) return 0;
            double coverage = clamp(faceCoveragePct, 0, 1);
            double quality = clamp(meanQuality, 0, 1);
            double confidence = clamp(meanConfidence, 0, 1);
            double saturation = Math.min(1.0, (double) nUsable / Math.max(1, expectedSamples));
            double geomMean = Math.pow(
                    Math.max(1e-9, quality * confidence * coverage * saturation),
                    0.25);
            return clamp(geomMean, 0, 1);
        }

        public double engagement() {
            if (weightedMean == null) return 0;
            double pos = weightedMean.getOrDefault("happy", 0.0)
                    + 0.5 * weightedMean.getOrDefault("surprise", 0.0)
                    + 0.5 * weightedMean.getOrDefault("neutral", 0.0);
            double neg = weightedMean.getOrDefault("sad", 0.0)
                    + 0.7 * weightedMean.getOrDefault("angry", 0.0)
                    + 0.5 * weightedMean.getOrDefault("disgust", 0.0)
                    + 0.3 * weightedMean.getOrDefault("fear", 0.0);
            return clamp((pos - neg + 1) / 2, 0, 1);
        }

        public String dominant() {
            if (weightedMean == null) return null;
            return weightedMean.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse(null);
        }
    }
}
