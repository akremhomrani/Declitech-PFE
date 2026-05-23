package com.declitech.module.dto;

import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.List;

@Data
public class UpdateModuleRequest {

    private String title;
    private String description;

    @Pattern(regexp = "ACTIVE|INACTIVE")
    private String status;

    private List<String> sites;
}
