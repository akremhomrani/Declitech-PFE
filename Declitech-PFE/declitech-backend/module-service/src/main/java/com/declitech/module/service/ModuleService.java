package com.declitech.module.service;

import com.declitech.module.client.SessionServiceClient;
import com.declitech.module.client.UserServiceClient;
import com.declitech.module.dto.*;
import com.declitech.module.exception.*;
import com.declitech.module.model.Module;
import com.declitech.module.repository.ModuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ModuleService {

    private final ModuleRepository moduleRepository;
    private final UserServiceClient userServiceClient;
    private final SessionServiceClient sessionServiceClient;

    @Transactional
    public ModuleDTO createModule(Long userId, CreateModuleRequest request) {
        UserDTO user = userServiceClient.getUserById(userId);
        
        if (user == null) {
            throw new UnauthorizedException("User not found with ID: " + userId);
        }

        Module module = Module.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .sites(request.getSites())
                .createdBy(user.getId())
                .createdByUsername(user.getUsername())
                .createdByEmail(user.getEmail())
                .build();

        module = moduleRepository.save(module);
        return convertToDTO(module);
    }

    @Transactional(readOnly = true)
    public ModuleDTO getModuleById(Long id) {
        Module module = moduleRepository.findById(id)
                .orElseThrow(() -> new ModuleNotFoundException(id));
        return convertToDTO(module);
    }

    @Transactional(readOnly = true)
    public List<ModuleDTO> getAllModules() {
        List<Module> modules = moduleRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
        return modules.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PagedModuleResponse getModulesPaginated(int page, int size, String sortBy, String sortDirection) {
        Sort.Direction direction = sortDirection.equalsIgnoreCase("ASC") 
                ? Sort.Direction.ASC 
                : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));
        Page<Module> modulePage = moduleRepository.findAll(pageable);

        List<ModuleDTO> moduleDTOs = modulePage.getContent().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());

        return PagedModuleResponse.builder()
                .modules(moduleDTOs)
                .currentPage(modulePage.getNumber())
                .totalPages(modulePage.getTotalPages())
                .totalItems(modulePage.getTotalElements())
                .pageSize(modulePage.getSize())
                .hasNext(modulePage.hasNext())
                .hasPrevious(modulePage.hasPrevious())
                .build();
    }

    @Transactional(readOnly = true)
    public List<ModuleDTO> getModulesByUser(Long userId) {
        List<Module> modules = moduleRepository.findByCreatedBy(userId);
        return modules.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public ModuleDTO updateModule(Long id, Long userId, UpdateModuleRequest request) {
        Module module = moduleRepository.findById(id)
                .orElseThrow(() -> new ModuleNotFoundException(id));

        if (!module.getCreatedBy().equals(userId)) {
            throw new UnauthorizedException("You are not authorized to update this module");
        }

        module.setTitle(request.getTitle());
        module.setDescription(request.getDescription());
        module.setSites(request.getSites());

        module = moduleRepository.save(module);
        return convertToDTO(module);
    }

    @Transactional
    public void deleteModule(Long id, Long userId) {
        Module module = moduleRepository.findById(id)
                .orElseThrow(() -> new ModuleNotFoundException(id));

        if (!module.getCreatedBy().equals(userId)) {
            throw new UnauthorizedException("You are not authorized to delete this module");
        }

        moduleRepository.delete(module);
    }

    @Transactional(readOnly = true)
    public List<SessionInfoDTO> getModuleSessions(Long moduleId) {
        if (!moduleRepository.existsById(moduleId)) {
            throw new ModuleNotFoundException(moduleId);
        }

        try {
            List<SessionServiceClient.SessionDTO> sessions = sessionServiceClient.getSessionsByModuleId(moduleId);
            return sessions.stream()
                    .map(this::convertSessionDTOToInfoDTO)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            return List.of();
        }
    }

    private ModuleDTO convertToDTO(Module module) {
        List<SessionInfoDTO> sessions = getModuleSessions(module.getId());

        return ModuleDTO.builder()
                .id(module.getId())
                .title(module.getTitle())
                .description(module.getDescription())
                .status(module.getStatus())
                .sites(module.getSites())
                .createdBy(module.getCreatedBy())
                .createdByUsername(module.getCreatedByUsername())
                .createdByEmail(module.getCreatedByEmail())
                .createdAt(module.getCreatedAt())
                .updatedAt(module.getUpdatedAt())
                .sessionCount(sessions.size())
                .sessions(sessions)
                .build();
    }

    private SessionInfoDTO convertSessionDTOToInfoDTO(SessionServiceClient.SessionDTO session) {
        return SessionInfoDTO.builder()
                .id(session.id)
                .sessionId(session.id)
                .sessionCode(session.sessionCode)
                .sessionTitle(session.title)
                .addedAt(session.createdAt)
                .build();
    }
}
