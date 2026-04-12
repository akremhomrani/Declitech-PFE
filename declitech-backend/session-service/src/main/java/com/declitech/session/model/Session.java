package com.declitech.session.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "sessions", uniqueConstraints = {
    @UniqueConstraint(columnNames = "session_code")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Session {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_code", nullable = false, unique = true, length = 50)
    private String sessionCode;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "instructor_id")
    private Long instructorId;

    @Column(name = "instructor_username")
    private String instructorUsername;

    @Column(name = "instructor_email")
    private String instructorEmail;

    @Column(name = "module_id")
    private Long moduleId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private SessionStatus status = SessionStatus.ACTIVE;

    @PrePersist
    protected void onCreate() {
        if (expiresAt == null && createdAt != null) {
            // Default: 1.5 hours duration
            expiresAt = createdAt.plusMinutes(90);
        }
    }

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }
}
