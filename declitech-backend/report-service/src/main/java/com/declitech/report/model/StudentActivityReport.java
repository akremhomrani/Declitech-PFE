package com.declitech.report.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "student_activity_report")
public class StudentActivityReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sessionCode;
    private String studentLoginIdentity;

    private int activitiesCount;
    private int totalExecutions;
    private int totalErrors;

    private String difficulty;
    private boolean workedWell;

    @Column(columnDefinition = "TEXT")
    private String summary;

    @Column(columnDefinition = "TEXT")
    private String details;

    private LocalDateTime generatedAt;
}
