package com.declitech.module.repository;

import com.declitech.module.model.ModuleSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ModuleSessionRepository extends JpaRepository<ModuleSession, Long> {
    
    List<ModuleSession> findByModuleId(Long moduleId);
    
    Optional<ModuleSession> findByModuleIdAndSessionId(Long moduleId, Long sessionId);
    
    boolean existsByModuleIdAndSessionId(Long moduleId, Long sessionId);
    
    void deleteByModuleIdAndSessionId(Long moduleId, Long sessionId);
}
