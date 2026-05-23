package com.declitech.session.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class JoinSessionRequest {

    @NotBlank(message = "studentLoginIdentity is required")
    private String studentLoginIdentity;
}
