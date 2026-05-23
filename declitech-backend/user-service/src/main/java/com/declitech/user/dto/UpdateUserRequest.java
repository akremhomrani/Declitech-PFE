package com.declitech.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.List;

@Data
public class UpdateUserRequest {

    @Email
    private String email;

    private String firstName;
    private String lastName;

    @Pattern(regexp = "^[0-9]{8}$", message = "Phone number must be 8 digits")
    private String phoneNumber;

    @Pattern(regexp = "ADMIN|INSTRUCTEUR|FREELANCER")
    private String role;

    @Pattern(regexp = "ACTIVE|INACTIVE")
    private String status;

    private List<ModuleAssignmentDTO> moduleAssignments;
}
