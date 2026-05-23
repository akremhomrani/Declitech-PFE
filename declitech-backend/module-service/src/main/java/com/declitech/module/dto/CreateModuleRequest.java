package com.declitech.module.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class CreateModuleRequest {

    @NotBlank
    @Size(max = 200)
    private String title;

    private String description;

    private List<String> sites;
}
