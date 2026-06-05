package com.declitech.report.client;

import com.declitech.report.client.dto.SessionView;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;

@FeignClient(name = "session-service")
public interface SessionServiceClient {

    @GetMapping("/api/sessions/history")
    List<SessionView> getSessionHistory();
}
