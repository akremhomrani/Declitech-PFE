package com.declitech.report.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrackReportDTO {
    private Long id;
    private String sessionId;
    private String sessionCode;
    private String studentIdentity;
    private String exerciseName;
    private String conclusion;
    private LocalDateTime createdAt;
}
