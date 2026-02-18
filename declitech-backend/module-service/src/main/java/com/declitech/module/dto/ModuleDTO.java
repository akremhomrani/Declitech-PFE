package com.declitech.module.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ModuleDTO {
    
    private Long id;
    private String title;
    private String description;
    private String status;
    private List<String> sites;
    private Long createdBy;
    private String createdByUsername;
    private String createdByEmail;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime updatedAt;
    
    private Integer sessionCount;
    private List<SessionInfoDTO> sessions;
}
