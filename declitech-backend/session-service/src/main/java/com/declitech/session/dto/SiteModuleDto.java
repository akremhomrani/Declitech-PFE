package com.declitech.session.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Affectation site/module embarquée dans le claim {@code siteModules}
 * du JWT staff IAM (INSTRUCTEUR / FREELANCE) — cf. INTEGRATION_SSO §v6, claims 2026-05-04.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SiteModuleDto {
    private Long siteId;
    private String siteName;
    private Long moduleId;
    private String moduleName;
    private String moduleCode;
}
