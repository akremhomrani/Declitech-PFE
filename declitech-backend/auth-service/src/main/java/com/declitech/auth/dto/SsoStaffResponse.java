package com.declitech.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class SsoStaffResponse {

    @JsonProperty("token")
    private String token;

    @JsonProperty("displayName")
    private String displayName;

    @JsonProperty("login")
    private String login;

    @JsonProperty("userType")
    private String userType;
}
