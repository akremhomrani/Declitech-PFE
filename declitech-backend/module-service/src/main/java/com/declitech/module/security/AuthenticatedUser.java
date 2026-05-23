package com.declitech.module.security;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class AuthenticatedUser {
    private Long userId;
    private String username;
    private String role;
}
