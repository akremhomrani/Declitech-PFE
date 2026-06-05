package com.declitech.report.service.recommendation;

import com.declitech.report.client.ModuleDirectoryClient;
import com.declitech.report.client.UserDirectoryClient;
import com.declitech.report.client.dto.ModuleView;
import com.declitech.report.client.dto.UserView;
import com.declitech.report.config.RecommendationProperties;
import com.declitech.report.dto.recommendation.InstructorRecommendationDto;
import com.declitech.report.dto.recommendation.ModuleRecommendationsDto;
import com.declitech.report.dto.recommendation.RecommendationOverviewDto;
import com.declitech.report.model.InstructorModuleScore;
import com.declitech.report.repository.InstructorModuleScoreRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RecommendationQueryService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationQueryService.class);
    private static final String EVIDENCE = "EVIDENCE";
    private static final String SIMILARITY = "SIMILARITY";

    private final InstructorModuleScoreRepository scoreRepository;
    private final ModuleDirectoryClient moduleClient;
    private final UserDirectoryClient userClient;
    private final ModuleSimilarity similarity;
    private final RecommendationPresenter presenter;
    private final RecommendationProperties props;

    public ModuleRecommendationsDto getModuleRecommendations(Long moduleId) {
        List<InstructorModuleScore> rows = scoreRepository.findByModuleIdOrderByScoreDesc(moduleId);
        Map<String, UserView> userCache = new HashMap<>();

        if (!rows.isEmpty()) {
            return evidenceRecommendations(moduleId, rows, userCache);
        }
        return similarityRecommendations(moduleId, userCache);
    }

    private ModuleRecommendationsDto evidenceRecommendations(Long moduleId, List<InstructorModuleScore> rows,
                                                             Map<String, UserView> userCache) {
        List<InstructorRecommendationDto> recs = new ArrayList<>();
        int students = 0;
        int sessions = 0;
        String moduleName = null;
        String siteName = null;
        for (InstructorModuleScore row : rows) {
            students += row.getSampleSize();
            sessions += row.getSessionsCount();
            if (moduleName == null) moduleName = row.getModuleName();
            if (siteName == null) siteName = row.getSiteName();
            UserView user = resolveUser(row.getInstructorUsername(), userCache);
            if (user != null && Boolean.FALSE.equals(user.getActive())) continue;
            if (recs.size() < props.getMaxPerModule()) {
                recs.add(presenter.toDto(row, user, EVIDENCE, row.getScore()));
            }
        }
        return ModuleRecommendationsDto.builder()
                .moduleId(moduleId)
                .moduleTitle(moduleName != null ? moduleName : moduleTitle(moduleId))
                .siteName(siteName)
                .sessionsCount(sessions)
                .studentsCount(students)
                .coldStart(false)
                .recommendations(recs)
                .build();
    }

    private ModuleRecommendationsDto similarityRecommendations(Long moduleId, Map<String, UserView> userCache) {
        List<ModuleView> modules = safeListModules();
        Map<Long, ModuleView> byId = modules.stream()
                .filter(m -> m.getId() != null)
                .collect(Collectors.toMap(ModuleView::getId, m -> m, (a, b) -> a));
        ModuleView target = byId.get(moduleId);

        List<InstructorModuleScore> all = scoreRepository.findAll();
        Long bestModuleId = null;
        double bestSim = props.getSimilarityFloor();
        if (target != null) {
            for (Long evidencedId : all.stream().map(InstructorModuleScore::getModuleId).distinct().toList()) {
                ModuleView other = byId.get(evidencedId);
                if (other == null) continue;
                double sim = similarity.similarity(target, other);
                if (sim > bestSim) {
                    bestSim = sim;
                    bestModuleId = evidencedId;
                }
            }
        }

        List<InstructorRecommendationDto> recs = new ArrayList<>();
        if (bestModuleId != null) {
            for (InstructorModuleScore row : scoreRepository.findByModuleIdOrderByScoreDesc(bestModuleId)) {
                UserView user = resolveUser(row.getInstructorUsername(), userCache);
                if (user != null && Boolean.FALSE.equals(user.getActive())) continue;
                if (recs.size() >= props.getMaxPerModule()) break;
                recs.add(presenter.toDto(row, user, SIMILARITY, row.getScore() * bestSim));
            }
        }
        return ModuleRecommendationsDto.builder()
                .moduleId(moduleId)
                .moduleTitle(target != null ? target.getTitle() : moduleTitle(moduleId))
                .sessionsCount(0)
                .studentsCount(0)
                .coldStart(recs.isEmpty())
                .recommendations(recs)
                .build();
    }

    public RecommendationOverviewDto getOverview() {
        List<InstructorModuleScore> all = scoreRepository.findAll();
        List<ModuleView> modules = safeListModules();

        Map<Long, InstructorModuleScore> topByModule = new HashMap<>();
        for (InstructorModuleScore row : all) {
            topByModule.merge(row.getModuleId(), row,
                    (a, b) -> a.getScore() >= b.getScore() ? a : b);
        }

        Map<String, UserView> userCache = new HashMap<>();
        List<RecommendationOverviewDto.ModuleSummary> summaries = new ArrayList<>();
        int needingAttention = 0;
        for (ModuleView m : modules) {
            InstructorModuleScore top = topByModule.get(m.getId());
            boolean unassigned = top == null;
            boolean coldStart = top == null;
            if (unassigned || top.getScore() < props.getMinScore()) needingAttention++;
            String topName = null;
            if (top != null) {
                UserView u = resolveUser(top.getInstructorUsername(), userCache);
                topName = presenter.toDto(top, u, EVIDENCE, top.getScore()).getFullName();
            }
            summaries.add(RecommendationOverviewDto.ModuleSummary.builder()
                    .moduleId(m.getId())
                    .moduleTitle(m.getTitle())
                    .siteName(top != null ? top.getSiteName() : null)
                    .sessionsCount(top != null ? top.getSessionsCount() : 0)
                    .studentsCount(top != null ? top.getSampleSize() : 0)
                    .unassigned(unassigned)
                    .coldStart(coldStart)
                    .topInstructorUsername(top != null ? top.getInstructorUsername() : null)
                    .topInstructorName(topName)
                    .topScore(top != null ? round(top.getScore()) : 0)
                    .topConfidence(top != null ? round(top.getConfidence()) : 0)
                    .source(EVIDENCE)
                    .build());
        }

        return RecommendationOverviewDto.builder()
                .computedAt(all.stream().map(InstructorModuleScore::getComputedAt)
                        .filter(c -> c != null).max(Comparator.naturalOrder()).orElse(LocalDateTime.now()))
                .totalModules(modules.size())
                .modulesCovered(topByModule.size())
                .activeInstructors((int) all.stream().map(InstructorModuleScore::getInstructorUsername).distinct().count())
                .strongFitInstructors((int) all.stream()
                        .filter(r -> r.getScore() >= props.getStrongFitScore())
                        .map(InstructorModuleScore::getInstructorUsername).distinct().count())
                .avgWorkedWellRate(round(weightedWorkedWell(all)))
                .modulesNeedingAttention(needingAttention)
                .modules(summaries)
                .build();
    }

    private double weightedWorkedWell(List<InstructorModuleScore> all) {
        double weighted = 0;
        long total = 0;
        for (InstructorModuleScore r : all) {
            if (r.getWorkedWellRate() == null) continue;
            weighted += r.getWorkedWellRate() * r.getSampleSize();
            total += r.getSampleSize();
        }
        return total == 0 ? 0 : weighted / total;
    }

    private UserView resolveUser(String username, Map<String, UserView> cache) {
        if (cache.containsKey(username)) return cache.get(username);
        UserView user = null;
        try {
            user = userClient.getByUsername(username);
        } catch (Exception e) {
            log.debug("User enrichment failed for {}: {}", username, e.getMessage());
        }
        cache.put(username, user);
        return user;
    }

    private List<ModuleView> safeListModules() {
        try {
            return moduleClient.listModules();
        } catch (Exception e) {
            log.warn("Module catalogue fetch failed: {}", e.getMessage());
            return List.of();
        }
    }

    private String moduleTitle(Long moduleId) {
        try {
            ModuleView m = moduleClient.getModule(moduleId);
            return m != null ? m.getTitle() : "Module " + moduleId;
        } catch (Exception e) {
            return "Module " + moduleId;
        }
    }

    private double round(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }
}
