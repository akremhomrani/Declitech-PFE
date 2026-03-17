package com.declitech.report.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "emotion_timeline")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmotionTimeline {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "report_id", nullable = false)
    @JsonIgnore
    private EmotionReport report;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(nullable = false)
    private String status;

    private String dominantEmotion;

    // Probabilities for each emotion
    private Double angry;
    private Double disgust;
    private Double fear;
    private Double happy;
    private Double sad;
    private Double surprise;
    private Double neutral;

    private String errorMessage;
}
