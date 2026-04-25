package com.declitech.session.dto;

import lombok.Data;
import java.util.List;

@Data
public class IamSalleDto {
    private Long id;
    private String name;
    private Integer capacity;
    private List<IamModuleDto> modules;
}
