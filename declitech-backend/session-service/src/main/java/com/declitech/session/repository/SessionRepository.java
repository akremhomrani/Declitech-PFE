package com.declitech.session.repository;

import com.declitech.session.model.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SessionRepository extends JpaRepository<Session, Long> {

    Optional<Session> findBySessionCode(String sessionCode);

    List<Session> findByInstructorId(Long instructorId);

    List<Session> findByInstructorIdAndIsActive(Long instructorId, Boolean isActive);

    @Query("SELECT s FROM Session s WHERE s.instructorId = :instructorId AND s.expiresAt > :now")
    List<Session> findActiveSessionsByInstructorId(Long instructorId, LocalDateTime now);

    @Query("SELECT s FROM Session s WHERE s.expiresAt > :now AND s.isActive = true")
    List<Session> findAllActiveSessions(LocalDateTime now);

    boolean existsBySessionCode(String sessionCode);

    @Query("SELECT s FROM Session s WHERE s.expiresAt < :now AND s.isActive = true")
    List<Session> findExpiredSessions(LocalDateTime now);
}
