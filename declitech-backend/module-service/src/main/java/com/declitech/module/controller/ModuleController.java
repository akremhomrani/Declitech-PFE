package com.declitech.module.controller;

import com.declitech.module.dto.*;
import com.declitech.module.exception.UnauthorizedException;
import com.declitech.module.service.ModuleService;
import com.declitech.module.util.JwtTokenProvider;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/modules")
@RequiredArgsConstructor
public class ModuleController {

    private final ModuleService moduleService;
    private final JwtTokenProvider jwtTokenProvider;

    @PostMapping
    public ResponseEntity<ModuleDTO> createModule(
            @Valid @RequestBody CreateModuleRequest request,
            @CookieValue(value = "accessToken", required = false) String accessToken,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String token = getToken(accessToken, authHeader);
        Long userId = token != null ? jwtTokenProvider.extractUserIdWithoutValidation(token) : null;
        if (userId == null) {
            throw new UnauthorizedException("Authentication required to create a module");
        }
        String username = jwtTokenProvider.extractUsername(token);
        String email = jwtTokenProvider.extractEmail(token);

        ModuleDTO module = moduleService.createModule(userId, username, email, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(module);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ModuleDTO> getModuleById(@PathVariable Long id) {
        ModuleDTO module = moduleService.getModuleById(id);
        return ResponseEntity.ok(module);
    }

    @GetMapping
    public ResponseEntity<List<ModuleDTO>> getAllModules() {
        List<ModuleDTO> modules = moduleService.getAllModules();
        return ResponseEntity.ok(modules);
    }

    @GetMapping("/paginated")
    public ResponseEntity<PagedModuleResponse> getModulesPaginated(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "sortBy", defaultValue = "createdAt") String sortBy,
            @RequestParam(name = "sortDirection", defaultValue = "DESC") String sortDirection) {

        PagedModuleResponse response = moduleService.getModulesPaginated(page, size, sortBy, sortDirection);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/my-modules")
    public ResponseEntity<List<ModuleDTO>> getMyModules(
            @CookieValue(value = "accessToken", required = false) String accessToken,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        
        Long userId = extractUserIdFromToken(accessToken, authHeader);
        if (userId == null) {
            throw new UnauthorizedException("Authentication required to view your modules");
        }

        List<ModuleDTO> modules = moduleService.getModulesByUser(userId);
        return ResponseEntity.ok(modules);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ModuleDTO> updateModule(
            @PathVariable Long id,
            @Valid @RequestBody UpdateModuleRequest request,
            @CookieValue(value = "accessToken", required = false) String accessToken,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        
        Long userId = extractUserIdFromToken(accessToken, authHeader);
        if (userId == null) {
            throw new UnauthorizedException("Authentication required to update a module");
        }

        ModuleDTO module = moduleService.updateModule(id, userId, request);
        return ResponseEntity.ok(module);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteModule(
            @PathVariable Long id,
            @CookieValue(value = "accessToken", required = false) String accessToken,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        
        Long userId = extractUserIdFromToken(accessToken, authHeader);
        if (userId == null) {
            throw new UnauthorizedException("Authentication required to delete a module");
        }

        moduleService.deleteModule(id, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{moduleId}/sessions")
    public ResponseEntity<List<SessionInfoDTO>> getModuleSessions(@PathVariable Long moduleId) {
        List<SessionInfoDTO> sessions = moduleService.getModuleSessions(moduleId);
        return ResponseEntity.ok(sessions);
    }

    private Long extractUserIdFromToken(String accessToken, String authHeader) {
        String token = getToken(accessToken, authHeader);
        if (token != null) {
            return jwtTokenProvider.extractUserIdWithoutValidation(token);
        }
        return null;
    }

    private String getToken(String accessToken, String authHeader) {
        if (accessToken != null && !accessToken.isEmpty()) {
            return accessToken;
        } else if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}
