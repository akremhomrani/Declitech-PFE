package com.declitech.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SsoCallbackRequest {

    @NotBlank(message = "Code is required")
    private String code;

    @NotBlank(message = "State is required")
    private String state;
}
