package com.declitech.module.service;

import com.declitech.module.client.UserServiceClient;
import com.declitech.module.dto.*;
import com.declitech.module.exception.ResourceNotFoundException;
import com.declitech.module.mapper.ModuleMapper;
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

@Service
@RequiredArgsConstructor
@Transactional
public class ModuleService {

    private final ModuleRepository moduleRepository;
    private final ModuleMapper moduleMapper;
    private final UserServiceClient userServiceClient;

    public ModuleDTO create(CreateModuleRequest request, Long createdBy, String createdByUsername) {
        Module module = Module.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .sites(request.getSites() == null ? List.of() : request.getSites())
                .status("ACTIVE")
                .createdBy(createdBy)
                .createdByUsername(createdByUsername)
                .build();
        return moduleMapper.toDTO(moduleRepository.save(module));
    }

    @Transactional(readOnly = true)
    public List<ModuleDTO> findAll() {
        return moduleRepository.findAllByStatusNot("ARCHIVED").stream().map(moduleMapper::toDTO).toList();
    }

    @Transactional(readOnly = true)
    public Page<ModuleDTO> findPaged(Pageable pageable) {
        Pageable effective = pageable.getSort().isUnsorted()
                ? PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(Sort.Direction.DESC, "createdAt"))
                : pageable;
        return moduleRepository.findAllByStatusNot("ARCHIVED", effective).map(moduleMapper::toDTO);
    }

    @Transactional(readOnly = true)
    public ModuleDTO findById(Long id) {
        return moduleMapper.toDTO(getModuleOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<ModuleDTO> findAssignedTo(Long userId) {
        UserSummary user = userServiceClient.getUserWithModules(userId);
        if (user.getModuleIds() == null || user.getModuleIds().isEmpty()) return List.of();
        return moduleRepository.findAllByIds(user.getModuleIds()).stream().map(moduleMapper::toDTO).toList();
    }

    public ModuleDTO update(Long id, UpdateModuleRequest request) {
        Module module = getModuleOrThrow(id);
        if (request.getTitle() != null) module.setTitle(request.getTitle());
        if (request.getDescription() != null) module.setDescription(request.getDescription());
        if (request.getStatus() != null) module.setStatus(request.getStatus());
        if (request.getSites() != null) module.setSites(request.getSites());
        return moduleMapper.toDTO(moduleRepository.save(module));
    }

    public void archive(Long id) {
        Module module = getModuleOrThrow(id);
        module.setStatus("ARCHIVED");
        moduleRepository.save(module);
    }

    private Module getModuleOrThrow(Long id) {
        return moduleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Module not found: " + id));
    }
}
