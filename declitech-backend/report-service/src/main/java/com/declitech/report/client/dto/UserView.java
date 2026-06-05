package com.declitech.report.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class UserView {
    private String username;
    private String firstName;
    private String lastName;
    private String role;
    private Boolean active;
    private List<Assignment> moduleAssignments = new ArrayList<>();

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Assignment {
        private Long moduleId;
        private String siteName;
    }
}
