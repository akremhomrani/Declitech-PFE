package com.declitech.report.model;

import com.declitech.report.dto.AlertSeverity;
import com.declitech.report.dto.AlertType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "session_alerts", indexes = {
    @Index(name = "idx_session_alerts_session_student", columnList = "session_id, student_login_identity"),
    @Index(name = "idx_session_alerts_session_id", columnList = "session_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", nullable = false)
    private String sessionId;

    @Column(name = "student_login_identity")
    private String studentLoginIdentity;

    @Enumerated(EnumType.STRING)
    @Column(name = "alert_type", nullable = false)
    private AlertType alertType;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity")
    private AlertSeverity severity;

    @Column(name = "message", length = 2000)
    private String message;

    @Column(name = "alert_timestamp")
    private LocalDateTime timestamp;

    @Column(name = "tab_url", length = 2000)
    private String tabUrl;

    @Column(name = "tab_title", length = 1000)
    private String tabTitle;

    @Column(name = "switch_count")
    private Integer switchCount;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
