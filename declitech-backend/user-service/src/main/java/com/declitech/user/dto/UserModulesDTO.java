package com.declitech.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserModulesDTO {
    private Long id;
    private String username;
    private List<Long> moduleIds;
}
