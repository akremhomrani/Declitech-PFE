package com.declitech.report.repository;

import com.declitech.report.model.InstructorModuleScore;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InstructorModuleScoreRepository extends JpaRepository<InstructorModuleScore, Long> {

    List<InstructorModuleScore> findByModuleIdOrderByScoreDesc(Long moduleId);
}
