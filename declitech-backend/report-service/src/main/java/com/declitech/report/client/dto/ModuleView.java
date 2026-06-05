package com.declitech.report.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ModuleView {
    private Long id;
    private String title;
    private String description;
    private String status;
    private List<String> sites = new ArrayList<>();
}
