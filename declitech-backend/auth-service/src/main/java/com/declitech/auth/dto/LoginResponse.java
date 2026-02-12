package com.declitech.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginResponse {

    private String accessToken;  // Used internally, not sent in response body
    private String refreshToken; // Used internally, not sent in response body
    private String firstName;
    private String lastName;
    private String username;
    private String role;
}
