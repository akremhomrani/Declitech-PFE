package com.declitech.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class SsoStudentResponse {

    @JsonProperty("accessToken")
    private String accessToken;

    @JsonProperty("studentId")
    private Long studentId;

    @JsonProperty("login")
    private String login;

    @JsonProperty("firstName")
    private String firstName;

    @JsonProperty("lastName")
    private String lastName;

    @JsonProperty("site")
    private String site;
}
