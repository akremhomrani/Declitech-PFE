package com.declitech.module.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserSummary {
    private Long id;
    private String username;
    private List<Long> moduleIds;
}
