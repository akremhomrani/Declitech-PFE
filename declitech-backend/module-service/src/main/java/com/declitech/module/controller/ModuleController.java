package com.declitech.module.controller;

import com.declitech.module.dto.CreateModuleRequest;
import com.declitech.module.dto.ModuleDTO;
import com.declitech.module.dto.UpdateModuleRequest;
import com.declitech.module.security.AuthenticatedUser;
import com.declitech.module.service.ModuleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/modules")
@RequiredArgsConstructor
public class ModuleController {

    private final ModuleService moduleService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ModuleDTO> create(@Valid @RequestBody CreateModuleRequest request,
                                            @AuthenticationPrincipal AuthenticatedUser principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(moduleService.create(request, principal.getUserId(), principal.getUsername()));
    }

    @GetMapping
    public ResponseEntity<List<ModuleDTO>> list() {
        return ResponseEntity.ok(moduleService.findAll());
    }

    @GetMapping("/paged")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<ModuleDTO>> listPaged(Pageable pageable) {
        return ResponseEntity.ok(moduleService.findPaged(pageable));
    }

    @GetMapping("/me")
    public ResponseEntity<List<ModuleDTO>> myModules(@AuthenticationPrincipal AuthenticatedUser principal) {
        if ("ADMIN".equals(principal.getRole())) {
            return ResponseEntity.ok(moduleService.findAll());
        }
        return ResponseEntity.ok(moduleService.findAssignedTo(principal.getUserId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ModuleDTO> findById(@PathVariable Long id) {
        return ResponseEntity.ok(moduleService.findById(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ModuleDTO> update(@PathVariable Long id, @Valid @RequestBody UpdateModuleRequest request) {
        return ResponseEntity.ok(moduleService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> archive(@PathVariable Long id) {
        moduleService.archive(id);
        return ResponseEntity.noContent().build();
    }
}
