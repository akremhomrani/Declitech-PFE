package com.declitech.user.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InternalUserDTO {
    private Long id;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    @JsonProperty("password")
    private String passwordHash;
    private String role;
    @JsonProperty("active")
    private Boolean active;
    private List<ModuleAssignmentDTO> moduleAssignments;
}
