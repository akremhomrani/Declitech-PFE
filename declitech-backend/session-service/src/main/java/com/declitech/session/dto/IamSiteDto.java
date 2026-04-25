package com.declitech.session.dto;

import lombok.Data;
import java.util.List;

@Data
public class IamSiteDto {
    private Long id;
    private String name;
    private String code;
    private String address;
    private String location;
    private List<IamSalleDto> salles;
}
