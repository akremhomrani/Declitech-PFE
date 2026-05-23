package com.declitech.module.repository;

import com.declitech.module.model.Module;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ModuleRepository extends JpaRepository<Module, Long> {

    @Query("SELECT m FROM Module m WHERE m.id IN :ids AND m.status <> 'ARCHIVED'")
    List<Module> findAllByIds(@Param("ids") List<Long> ids);

    List<Module> findAllByStatusNot(String status);

    Page<Module> findAllByStatusNot(String status, Pageable pageable);
}
