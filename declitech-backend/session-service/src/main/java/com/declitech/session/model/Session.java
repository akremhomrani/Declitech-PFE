package com.declitech.session.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDateTime;

@Entity
@Table(name = "sessions", uniqueConstraints = {
    @UniqueConstraint(columnNames = "session_code")
})
@SQLDelete(sql = "UPDATE sessions SET deleted_at = NOW() WHERE id = ? AND version = ?")
@SQLRestriction("deleted_at IS NULL")
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

    @Column(name = "instructor_username")
    private String instructorUsername;

    @Column(name = "instructor_email")
    private String instructorEmail;

    @Column(name = "module_id")
    private Long moduleId;

    // Site / module context captured from staff JWT claims (IAM v6 §siteModules/site).
    @Column(name = "site_id")
    private Long siteId;

    @Column(name = "site_name", length = 255)
    private String siteName;

    @Column(name = "module_name", length = 255)
    private String moduleName;

    @Column(name = "module_code", length = 50)
    private String moduleCode;

    @Column(name = "instructor_site", length = 255)
    private String instructorSite;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private SessionStatus status = SessionStatus.ACTIVE;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @PrePersist
    protected void onCreate() {
        if (expiresAt == null && createdAt != null) {
            expiresAt = createdAt.plusMinutes(90);
        }
    }
}
