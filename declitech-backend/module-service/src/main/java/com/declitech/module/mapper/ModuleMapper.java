package com.declitech.module.mapper;

import com.declitech.module.dto.ModuleDTO;
import com.declitech.module.model.Module;
import org.springframework.stereotype.Component;

@Component
public class ModuleMapper {

    public ModuleDTO toDTO(Module module) {
        return ModuleDTO.builder()
                .id(module.getId())
                .title(module.getTitle())
                .description(module.getDescription())
                .status(module.getStatus())
                .sites(module.getSites())
                .createdBy(module.getCreatedBy())
                .createdByUsername(module.getCreatedByUsername())
                .createdAt(module.getCreatedAt())
                .updatedAt(module.getUpdatedAt())
                .build();
    }
}
