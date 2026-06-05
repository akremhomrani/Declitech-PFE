package com.declitech.report.service.recommendation;

import com.declitech.report.client.dto.ModuleView;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class ModuleSimilarity {

    private static final Set<String> STOPWORDS = Set.of(
            "de", "des", "du", "la", "le", "les", "et", "a", "au", "aux", "en", "un", "une",
            "the", "and", "of", "to", "for", "with", "module", "cours");

    public double similarity(ModuleView a, ModuleView b) {
        double tokens = jaccard(tokens(a), tokens(b));
        double sites = jaccard(siteSet(a), siteSet(b));
        return 0.7 * tokens + 0.3 * sites;
    }

    private Set<String> tokens(ModuleView m) {
        String text = (safe(m.getTitle()) + " " + safe(m.getDescription())).toLowerCase();
        return Arrays.stream(text.split("[^\\p{L}0-9]+"))
                .filter(t -> t.length() > 2)
                .filter(t -> !STOPWORDS.contains(t))
                .collect(Collectors.toSet());
    }

    private Set<String> siteSet(ModuleView m) {
        List<String> sites = m.getSites();
        return sites == null ? Set.of()
                : sites.stream().filter(s -> s != null).map(String::toLowerCase).collect(Collectors.toSet());
    }

    private double jaccard(Set<String> a, Set<String> b) {
        if (a.isEmpty() && b.isEmpty()) return 0;
        Set<String> inter = new HashSet<>(a);
        inter.retainAll(b);
        Set<String> union = new HashSet<>(a);
        union.addAll(b);
        return union.isEmpty() ? 0 : (double) inter.size() / union.size();
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }
}
