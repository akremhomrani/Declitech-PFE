package com.declitech.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionFilterRequest {

    private String title;
    private String sessionCode;
    private String status; // ACTIVE, ENDED, EXPIRED, CANCELLED
    private String search;
    private Long instructorId;
    private String instructorUsername;
}
