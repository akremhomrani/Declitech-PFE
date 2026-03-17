package com.declitech.module.repository;

import com.declitech.module.model.Module;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ModuleRepository extends JpaRepository<Module, Long> {
    
    List<Module> findByCreatedBy(Long createdBy);
    
    List<Module> findByTitleContainingIgnoreCase(String title);
    
    Optional<Module> findByIdAndCreatedBy(Long id, Long createdBy);
    
    boolean existsByIdAndCreatedBy(Long id, Long createdBy);
}
