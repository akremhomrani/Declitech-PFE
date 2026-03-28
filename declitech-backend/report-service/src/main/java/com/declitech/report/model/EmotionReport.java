package com.declitech.report.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "emotion_reports")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmotionReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_code", nullable = false)
    private String sessionCode;

    @Column(name = "session_id")
    private Long sessionId;

    @Column(nullable = false, unique = true)
    private String sessionId_legacy; // Keep for backward compatibility

    @Column(nullable = false)
    private LocalDateTime generatedAt;

    @Column(name = "student_login_identity")
    private String studentLoginIdentity;

    @Column(name = "final_state")
    private String finalState;

    @Column(name = "final_sentence", length = 500)
    private String finalSentence;

    // Summary Mean Emotions (stored as individual columns)
    private Double angryMean;
    private Double disgustMean;
    private Double fearMean;
    private Double happyMean;
    private Double sadMean;
    private Double surpriseMean;
    private Double neutralMean;
    
    // Dominant emotion
    private String dominantEmotion;
    
    // Number of samples
    private Integer numberOfSamples;

    @OneToMany(mappedBy = "report", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<EmotionTimeline> timeline;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private SessionStatus status = SessionStatus.IN_PROGRESS;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum SessionStatus {
        IN_PROGRESS,
        COMPLETED,
        CANCELLED
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
