package com.declitech.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class CreateUserRequest {

    @NotBlank
    @Size(min = 3, max = 100)
    private String username;

    @NotBlank
    @Email
    private String email;

    @NotBlank
    @Size(min = 6, max = 100)
    private String password;

    private String firstName;
    private String lastName;

    @Pattern(regexp = "^[0-9]{8}$", message = "Phone number must be 8 digits")
    private String phoneNumber;

    @NotBlank
    @Pattern(regexp = "ADMIN|INSTRUCTEUR|FREELANCER")
    private String role;

    private List<ModuleAssignmentDTO> moduleAssignments;
}
