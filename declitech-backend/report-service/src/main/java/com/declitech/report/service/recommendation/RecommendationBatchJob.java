package com.declitech.report.service.recommendation;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RecommendationBatchJob {

    private static final Logger log = LoggerFactory.getLogger(RecommendationBatchJob.class);

    private final RecommendationComputeService computeService;

    @Scheduled(cron = "${recommendation.cron:0 0 3 * * *}")
    public void nightlyRecompute() {
        try {
            int rows = computeService.recompute();
            log.info("Nightly recommendation recompute completed: {} scores", rows);
        } catch (Exception e) {
            log.error("Nightly recommendation recompute failed: {}", e.getMessage(), e);
        }
    }
}
