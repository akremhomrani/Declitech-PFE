package com.declitech.report.repository;

import com.declitech.report.model.TrackReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TrackReportRepository extends JpaRepository<TrackReport, Long> {
    List<TrackReport> findBySessionCode(String sessionCode);
    List<TrackReport> findByStudentIdentity(String studentIdentity);
    List<TrackReport> findBySessionCodeAndStudentIdentity(String sessionCode, String studentIdentity);
}
