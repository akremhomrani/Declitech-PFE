package com.declitech.report.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "track_reports")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrackReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id")
    private String sessionId;

    @Column(name = "session_code")
    private String sessionCode;

    @Column(name = "student_identity")
    private String studentIdentity;

    @Column(name = "exercise_name")
    private String exerciseName;

    @Column(columnDefinition = "TEXT")
    private String conclusion;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
