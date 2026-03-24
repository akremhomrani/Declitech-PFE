package com.declitech.module.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "module_sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ModuleSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "module_id", nullable = false)
    private Module module;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "session_code", nullable = false)
    private String sessionCode;

    @Column(name = "session_title")
    private String sessionTitle;

    @CreationTimestamp
    @Column(name = "added_at", nullable = false, updatable = false)
    private LocalDateTime addedAt;
}
