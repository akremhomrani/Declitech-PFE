package com.declitech.report.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "instructor_module_score", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"instructor_username", "module_id", "site_name"})
})
public class InstructorModuleScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "instructor_username", nullable = false, length = 100)
    private String instructorUsername;

    @Column(name = "module_id", nullable = false)
    private Long moduleId;

    @Column(name = "module_name", length = 255)
    private String moduleName;

    @Column(name = "site_name", length = 255)
    private String siteName;

    @Column(nullable = false)
    private float score;

    @Column(nullable = false)
    private float confidence;

    @Column(name = "sample_size", nullable = false)
    private int sampleSize;

    @Column(name = "sessions_count", nullable = false)
    private int sessionsCount;

    @Column(name = "worked_well_rate")
    private Float workedWellRate;

    @Column(name = "avg_engagement")
    private Float avgEngagement;

    @Column(name = "avg_errors")
    private Float avgErrors;

    @Column(name = "difficulty_factor")
    private Float difficultyFactor;

    @Column(name = "computed_at", nullable = false)
    private LocalDateTime computedAt;
}
