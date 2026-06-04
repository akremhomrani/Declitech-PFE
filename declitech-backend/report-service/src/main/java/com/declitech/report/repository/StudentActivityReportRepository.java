package com.declitech.report.repository;

import com.declitech.report.model.StudentActivityReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StudentActivityReportRepository extends JpaRepository<StudentActivityReport, Long> {

    Optional<StudentActivityReport> findTopBySessionCodeAndStudentLoginIdentityOrderByGeneratedAtDesc(
            String sessionCode, String studentLoginIdentity);
}
