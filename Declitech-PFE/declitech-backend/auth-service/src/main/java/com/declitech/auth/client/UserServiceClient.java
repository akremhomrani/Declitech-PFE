package com.declitech.auth.client;

import com.declitech.auth.config.FeignClientConfiguration;
import com.declitech.auth.dto.UserDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "user-service", configuration = FeignClientConfiguration.class)
public interface UserServiceClient {

    @GetMapping("/api/users/{id}")
    UserDto getUserById(@PathVariable("id") Long id);

    @GetMapping("/api/users/username/{username}")
    UserDto getUserByUsername(@PathVariable("username") String username);

    @GetMapping("/api/users/email/{email}")
    UserDto getUserByEmail(@PathVariable("email") String email);
}
