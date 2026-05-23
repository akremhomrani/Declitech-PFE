package com.declitech.session.repository;

import com.declitech.session.model.Session;
import com.declitech.session.model.SessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SessionRepository extends JpaRepository<Session, Long>, JpaSpecificationExecutor<Session> {

    Optional<Session> findBySessionCode(String sessionCode);

    List<Session> findByInstructorUsername(String username);

    List<Session> findByInstructorUsernameAndStatus(String username, SessionStatus status);

    List<Session> findByStatus(SessionStatus status);

    List<Session> findByModuleId(Long moduleId);

    List<Session> findByStatusAndExpiresAtBefore(SessionStatus status, LocalDateTime now);

    @Query("SELECT s FROM Session s WHERE s.instructorUsername = :username AND s.expiresAt > :now AND s.status = 'ACTIVE'")
    List<Session> findActiveSessionsByInstructorUsername(@Param("username") String username, @Param("now") LocalDateTime now);

    boolean existsBySessionCode(String sessionCode);
}
