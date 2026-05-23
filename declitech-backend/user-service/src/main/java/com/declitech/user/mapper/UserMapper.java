package com.declitech.user.mapper;

import com.declitech.user.dto.InternalUserDTO;
import com.declitech.user.dto.ModuleAssignmentDTO;
import com.declitech.user.dto.UserDTO;
import com.declitech.user.model.User;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    public UserDTO toDTO(User user) {
        return UserDTO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .phoneNumber(user.getPhoneNumber())
                .role(user.getRole())
                .status(user.getStatus())
                .moduleIds(user.getModuleIds())
                .moduleAssignments(user.getModuleAssignments().stream()
                        .map(a -> new ModuleAssignmentDTO(a.getModuleId(), a.getSiteName()))
                        .toList())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }

    public InternalUserDTO toInternalDTO(User user) {
        return InternalUserDTO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .passwordHash(user.getPasswordHash())
                .role(user.getRole())
                .active("ACTIVE".equals(user.getStatus()))
                .moduleAssignments(user.getModuleAssignments().stream()
                        .map(a -> new ModuleAssignmentDTO(a.getModuleId(), a.getSiteName()))
                        .toList())
                .build();
    }
}
