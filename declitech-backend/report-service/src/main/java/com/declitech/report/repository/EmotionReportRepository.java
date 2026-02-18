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
    
    @Query("SELECT r FROM EmotionReport r WHERE r.sessionId_legacy = :sessionId")
    Optional<EmotionReport> findBySessionId(@Param("sessionId") String sessionId);
    
    // Session code queries (new)
    List<EmotionReport> findBySessionCode(String sessionCode);
    
    // Numeric session ID query
    List<EmotionReport> findBySessionId(Long sessionId);
    
    Integer countBySessionCode(String sessionCode);
    
    @Query("SELECT COUNT(DISTINCT r.studentLoginIdentity) FROM EmotionReport r WHERE r.sessionCode = :sessionCode")
    Long countDistinctParticipantsBySessionCode(@Param("sessionCode") String sessionCode);
    
    List<EmotionReport> findByStudentLoginIdentity(String studentLoginIdentity);
    
    List<EmotionReport> findByGeneratedAtBetween(LocalDateTime start, LocalDateTime end);
    
    List<EmotionReport> findByStudentLoginIdentityAndGeneratedAtBetween(
        String studentLoginIdentity, 
        LocalDateTime start, 
        LocalDateTime end
    );
    
    List<EmotionReport> findBySessionCodeAndGeneratedAtBetween(
        String sessionCode, 
        LocalDateTime start, 
        LocalDateTime end
    );
    
    @Query("SELECT CASE WHEN COUNT(r) > 0 THEN true ELSE false END FROM EmotionReport r WHERE r.sessionId_legacy = :sessionId")
    boolean existsBySessionId(@Param("sessionId") String sessionId);
    
    boolean existsBySessionCode(String sessionCode);
    
    List<EmotionReport> findByStatusOrderByCreatedAtDesc(EmotionReport.SessionStatus status);
}
