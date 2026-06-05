package com.declitech.report.service.recommendation;

import com.declitech.report.config.RecommendationProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class InstructorModuleScorer {

    private final RecommendationProperties props;

    public double rawQuality(GroupStats g) {
        double wWw = props.getWeightWorkedWell();
        double wErr = props.getWeightError();
        double wEng = props.getWeightEngagement();
        double wOff = props.getWeightOffTask();

        double errorQuality = 1.0 - clamp01(g.avgErrorsPerExecution() / props.getErrorNorm());

        double num = wWw * g.workedWellRate() + wErr * errorQuality;
        double den = wWw + wErr;

        Double engagement = g.avgEngagement();
        if (engagement != null) {
            num += wEng * clamp01(engagement);
            den += wEng;
        }
        Double offTask = g.avgOffTaskPct();
        if (offTask != null) {
            num += wOff * (1.0 - clamp01(offTask / 100.0));
            den += wOff;
        }

        double base = den == 0 ? 0 : num / den;
        double bonus = props.getDifficultyBonus() * g.difficultyFactor() * g.workedWellRate();
        return clamp01(base + bonus);
    }

    public double shrunkScore(double raw, int n, double globalMean) {
        double k = props.getShrinkageK();
        return (n * raw + k * globalMean) / (n + k);
    }

    public double confidence(int n) {
        double k = props.getShrinkageK();
        return n / (n + k);
    }

    private static double clamp01(double v) {
        return Math.max(0, Math.min(1, v));
    }
}
