package com.declitech.module.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AddSessionRequest {

    @NotNull(message = "Session ID is required")
    private Long sessionId;
}
