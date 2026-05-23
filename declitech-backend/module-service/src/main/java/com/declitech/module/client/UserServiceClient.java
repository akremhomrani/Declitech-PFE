package com.declitech.module.client;

import com.declitech.module.dto.UserSummary;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "user-service")
public interface UserServiceClient {

    @GetMapping("/api/users/internal/{id}/modules")
    UserSummary getUserWithModules(@PathVariable("id") Long id);
}
