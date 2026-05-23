package com.declitech.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDTO {
    private Long id;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String phoneNumber;
    private String role;
    private String status;
    private List<Long> moduleIds;
    private List<ModuleAssignmentDTO> moduleAssignments;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
