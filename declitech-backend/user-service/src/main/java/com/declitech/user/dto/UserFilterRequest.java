package com.declitech.user.dto;

import com.declitech.user.enums.Role;
import com.declitech.user.enums.Sexe;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserFilterRequest {
    
    private String firstName;
    private String lastName;
    private String username;
    private String email;
    private Sexe sexe;
    private String phoneNumber;
    private Role role;
    private Boolean active;
    private String search;
}
