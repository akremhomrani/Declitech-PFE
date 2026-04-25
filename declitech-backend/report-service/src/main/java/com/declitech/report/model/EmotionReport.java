package com.declitech.report.model;

import com.fasterxml.jackson.annotation.JsonGetter;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "emotion_reports")
@SQLDelete(sql = "UPDATE emotion_reports SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EmotionReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id")
    private Long sessionId;

    @Column(name = "session_code", length = 10)
    private String sessionCode;

    @Column(nullable = false)
    private LocalDateTime generatedAt;

    @Column(name = "student_login_identity")
    private String studentLoginIdentity;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "emotion_means", columnDefinition = "jsonb")
    private Map<String, Double> emotionMeans;

    @Column(name = "dominant_emotion")
    private String dominantEmotion;

    @Column(name = "number_of_samples")
    private Integer numberOfSamples;

    @Column(name = "final_state")
    private String finalState;

    @Column(name = "final_sentence", length = 500)
    private String finalSentence;

    @Column(name = "instructor_note", length = 1000)
    private String instructorNote;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private EmotionReportStatus status = EmotionReportStatus.IN_PROGRESS;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    @JsonGetter("angryMean")
    public Double getAngryMean() { return emotionMeans != null ? emotionMeans.get("angry") : null; }

    @JsonGetter("disgustMean")
    public Double getDisgustMean() { return emotionMeans != null ? emotionMeans.get("disgust") : null; }

    @JsonGetter("fearMean")
    public Double getFearMean() { return emotionMeans != null ? emotionMeans.get("fear") : null; }

    @JsonGetter("happyMean")
    public Double getHappyMean() { return emotionMeans != null ? emotionMeans.get("happy") : null; }

    @JsonGetter("sadMean")
    public Double getSadMean() { return emotionMeans != null ? emotionMeans.get("sad") : null; }

    @JsonGetter("surpriseMean")
    public Double getSurpriseMean() { return emotionMeans != null ? emotionMeans.get("surprise") : null; }

    @JsonGetter("neutralMean")
    public Double getNeutralMean() { return emotionMeans != null ? emotionMeans.get("neutral") : null; }
}
