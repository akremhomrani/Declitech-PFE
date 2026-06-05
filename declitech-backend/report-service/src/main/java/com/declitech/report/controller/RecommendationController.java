package com.declitech.report.controller;

import com.declitech.report.dto.recommendation.ModuleRecommendationsDto;
import com.declitech.report.dto.recommendation.RecommendationOverviewDto;
import com.declitech.report.service.recommendation.RecommendationComputeService;
import com.declitech.report.service.recommendation.RecommendationQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationQueryService queryService;
    private final RecommendationComputeService computeService;

    @GetMapping("/overview")
    public ResponseEntity<RecommendationOverviewDto> overview() {
        return ResponseEntity.ok(queryService.getOverview());
    }

    @GetMapping("/modules/{moduleId}")
    public ResponseEntity<ModuleRecommendationsDto> forModule(@PathVariable Long moduleId) {
        return ResponseEntity.ok(queryService.getModuleRecommendations(moduleId));
    }

    @PostMapping("/recompute")
    public ResponseEntity<Map<String, Object>> recompute() {
        int rows = computeService.recompute();
        return ResponseEntity.ok(Map.of("status", "ok", "scores", rows));
    }
}
