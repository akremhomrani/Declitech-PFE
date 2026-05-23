package com.declitech.user.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ModuleAssignment {
    @Column(name = "module_id", nullable = false)
    private Long moduleId;

    @Column(name = "site_name", nullable = false)
    private String siteName;
}
