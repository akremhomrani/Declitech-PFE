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

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "baseline_means", columnDefinition = "jsonb")
    private Map<String, Double> baselineMeans;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "delta_from_baseline", columnDefinition = "jsonb")
    private Map<String, Double> deltaFromBaseline;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "dominant_frequency", columnDefinition = "jsonb")
    private Map<String, Double> dominantFrequency;

    @Column(name = "dominant_emotion")
    private String dominantEmotion;

    @Column(name = "number_of_samples")
    private Integer numberOfSamples;

    @Column(name = "n_samples_total")
    private Integer nSamplesTotal;

    @Column(name = "n_samples_usable")
    private Integer nSamplesUsable;

    @Column(name = "model_version", length = 64)
    private String modelVersion;

    @Column(name = "class_labels", columnDefinition = "text[]")
    private String[] classLabels;

    @Column(name = "engagement_score")
    private Float engagementScore;

    @Column(name = "stability_score")
    private Float stabilityScore;

    @Column(name = "reliability_score")
    private Float reliabilityScore;

    @Column(name = "face_coverage_pct")
    private Float faceCoveragePct;

    @Column(name = "low_confidence_pct")
    private Float lowConfidencePct;

    @Column(name = "multi_face_pct")
    private Float multiFacePct;

    @Column(name = "off_task_pct")
    private Float offTaskPct;

    @Column(name = "camera_blocked_pct")
    private Float cameraBlockedPct;

    @Column(name = "narrative_confidence", length = 16)
    private String narrativeConfidence;

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

    private Double mean(String key) {
        return emotionMeans != null ? emotionMeans.get(key) : null;
    }

    @JsonGetter("angryMean")    public Double getAngryMean()    { return mean("angry"); }
    @JsonGetter("disgustMean")  public Double getDisgustMean()  { return mean("disgust"); }
    @JsonGetter("fearMean")     public Double getFearMean()     { return mean("fear"); }
    @JsonGetter("happyMean")    public Double getHappyMean()    { return mean("happy"); }
    @JsonGetter("sadMean")      public Double getSadMean()      { return mean("sad"); }
    @JsonGetter("surpriseMean") public Double getSurpriseMean() { return mean("surprise"); }
    @JsonGetter("neutralMean")  public Double getNeutralMean()  { return mean("neutral"); }
}
