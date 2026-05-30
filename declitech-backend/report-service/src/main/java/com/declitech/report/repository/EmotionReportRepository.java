package com.declitech.report.repository;

import com.declitech.report.model.EmotionReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface EmotionReportRepository extends JpaRepository<EmotionReport, Long> {

    Optional<EmotionReport> findBySessionIdAndStudentLoginIdentity(Long sessionId, String studentLoginIdentity);

    Optional<EmotionReport> findBySessionCodeAndStudentLoginIdentity(String sessionCode, String studentLoginIdentity);

    List<EmotionReport> findBySessionCode(String sessionCode);

    List<EmotionReport> findBySessionId(Long sessionId);

    @Query("SELECT COUNT(r) FROM EmotionReport r WHERE r.sessionId = :sessionId")
    Integer countBySessionId(@Param("sessionId") Long sessionId);

    @Query("SELECT COUNT(r) FROM EmotionReport r WHERE r.sessionCode = :sessionCode")
    Integer countBySessionCode(@Param("sessionCode") String sessionCode);

    @Query("SELECT COUNT(DISTINCT r.studentLoginIdentity) FROM EmotionReport r WHERE r.sessionId = :sessionId")
    Long countDistinctParticipantsBySessionId(@Param("sessionId") Long sessionId);

    List<EmotionReport> findByStudentLoginIdentity(String studentLoginIdentity);

    List<EmotionReport> findByGeneratedAtBetween(LocalDateTime start, LocalDateTime end);

    List<EmotionReport> findByStudentLoginIdentityAndGeneratedAtBetween(
        String studentLoginIdentity,
        LocalDateTime start,
        LocalDateTime end
    );
}
