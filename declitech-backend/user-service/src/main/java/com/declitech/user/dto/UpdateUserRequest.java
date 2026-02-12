package com.declitech.user.dto;

import com.declitech.user.enums.Role;
import com.declitech.user.enums.Sexe;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateUserRequest {

    @Size(min = 2, max = 50, message = "First name must be between 2 and 50 characters")
    private String firstName;

    @Size(min = 2, max = 50, message = "Last name must be between 2 and 50 characters")
    private String lastName;

    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    private String username;

    @Email(message = "Email must be valid")
    @Size(max = 100, message = "Email must not exceed 100 characters")
    private String email;

    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;

    private Sexe sexe;

    @Size(min = 8, max = 20, message = "Phone number must be between 8 and 20 characters")
    private String phoneNumber;

    private Role role;

    private Boolean active;
}
