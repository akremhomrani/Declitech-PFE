package com.declitech.report.service.agent;

import org.springframework.stereotype.Component;

@Component
public class ReliabilityNarrative {

    public enum Confidence { NONE, LOW, MEDIUM, HIGH }

    public Confidence classify(double reliability, int nUsable) {
        if (nUsable < 5)        return Confidence.NONE;
        if (reliability < 0.50) return Confidence.LOW;
        if (reliability < 0.75) return Confidence.MEDIUM;
        return Confidence.HIGH;
    }

    public String narrative(Confidence confidence, String dominant, double dominantFrequency) {
        return switch (confidence) {
            case NONE   -> "Insufficient data to characterize the session.";
            case LOW    -> "Low-confidence signal: avoid drawing conclusions from this report.";
            case MEDIUM -> "Predominantly " + describe(dominant) + ", with notable variability.";
            case HIGH   -> dominantFrequency > 0.45
                    ? "Sustained " + describe(dominant) + " throughout the session."
                    : "Mixed affective state, leaning " + describe(dominant) + ".";
        };
    }

    public String shortLabel(Confidence confidence) {
        return switch (confidence) {
            case NONE   -> "insufficient";
            case LOW    -> "low";
            case MEDIUM -> "medium";
            case HIGH   -> "high";
        };
    }

    private String describe(String dominant) {
        if (dominant == null) return "neutral patterns";
        return switch (dominant) {
            case "happy"    -> "engaged and positive affect";
            case "neutral"  -> "calm and focused affect";
            case "sad"      -> "signs of disengagement";
            case "angry"    -> "signs of frustration";
            case "fear"     -> "signs of anxiety";
            case "surprise" -> "reactive engagement";
            case "disgust"  -> "discomfort signals";
            default         -> "mixed affective patterns";
        };
    }
}
