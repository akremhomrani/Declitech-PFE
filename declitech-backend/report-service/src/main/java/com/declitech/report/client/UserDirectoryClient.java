package com.declitech.report.client;

import com.declitech.report.client.dto.UserView;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "user-service")
public interface UserDirectoryClient {

    @GetMapping("/api/users/username/{username}")
    UserView getByUsername(@PathVariable("username") String username);
}
