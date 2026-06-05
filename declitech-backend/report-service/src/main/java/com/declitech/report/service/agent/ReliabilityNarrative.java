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

    public String narrative(Confidence confidence, String dominant, double dominantFrequency,
                            double engagement, double stability) {
        if (confidence == Confidence.NONE) {
            return "Not enough reliable signal was captured during this session to characterize the "
                    + "student's emotional state. Too few usable samples were recorded, which can happen "
                    + "when the camera was blocked, the face was rarely visible, or the session was very "
                    + "short. Treat this report as inconclusive rather than as evidence of any particular mood.";
        }
        if (confidence == Confidence.LOW) {
            return "The emotional signal collected during this session was weak and inconsistent, so its "
                    + "conclusions should be read with caution. The dominant reading leaned toward "
                    + describe(dominant) + ", but the low reliability means it may not reflect the student's "
                    + "actual experience. Consider it a rough indication at best, and rely on direct "
                    + "observation before acting on it.";
        }

        String pct = Math.round(dominantFrequency * 100) + "%";
        StringBuilder sb = new StringBuilder();
        if (confidence == Confidence.HIGH && dominantFrequency > 0.45) {
            sb.append("Throughout the session the student consistently showed ").append(describe(dominant))
                    .append(", which was present in roughly ").append(pct).append(" of the analyzed moments. ");
        } else if (confidence == Confidence.HIGH) {
            sb.append("The student moved through a mix of affective states, with a slight lean toward ")
                    .append(describe(dominant)).append(" (around ").append(pct).append(" of the time). ");
        } else {
            sb.append("The session was predominantly marked by ").append(describe(dominant))
                    .append(" (close to ").append(pct).append(" of the analyzed moments), with notable variability. ");
        }
        sb.append(engagementSentence(engagement)).append(" ");
        sb.append(stabilitySentence(stability));
        return sb.toString();
    }

    private String engagementSentence(double engagement) {
        int p = (int) Math.round(engagement * 100);
        if (engagement >= 0.66) {
            return "Overall engagement stayed high (about " + p + "%), suggesting the student remained "
                    + "involved in the work.";
        }
        if (engagement >= 0.40) {
            return "Engagement was moderate (about " + p + "%), with attention fluctuating over the session.";
        }
        return "Engagement was low (about " + p + "%), which may indicate the student disengaged or "
                + "struggled to stay on task.";
    }

    private String stabilitySentence(double stability) {
        if (stability >= 0.66) {
            return "Their emotional state was stable, shifting little from one moment to the next.";
        }
        if (stability >= 0.40) {
            return "Their emotional state shifted occasionally, showing a fairly normal rhythm of focus and pause.";
        }
        return "Their emotional state was volatile, changing frequently, worth a closer look if this "
                + "pattern repeats across sessions.";
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
