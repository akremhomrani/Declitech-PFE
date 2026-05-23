package com.declitech.report.repository;

import com.declitech.report.model.SessionAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SessionAlertRepository extends JpaRepository<SessionAlert, Long> {

    List<SessionAlert> findBySessionIdAndStudentLoginIdentityOrderByTimestampAsc(
            String sessionId, String studentLoginIdentity);

    List<SessionAlert> findBySessionIdOrderByTimestampAsc(String sessionId);

    void deleteBySessionId(String sessionId);
}
