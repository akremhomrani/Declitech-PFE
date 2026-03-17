package com.declitech.session.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionDTO {
    private Long id;
    private String sessionCode;
    private String title;
    private Long instructorId;
    private String instructorUsername;
    private String instructorEmail;
    private Long moduleId;
    private Double durationHours;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;
    
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime expiresAt;
    
    private String status; // ACTIVE, ENDED, EXPIRED, CANCELLED
    private Integer participantCount;
    private Integer reportCount;
}
