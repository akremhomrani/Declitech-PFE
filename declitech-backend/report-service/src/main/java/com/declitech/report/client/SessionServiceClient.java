package com.declitech.report.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

@FeignClient(name = "session-service")
public interface SessionServiceClient {

    @PostMapping("/api/sessions/code/{sessionCode}/report")
    void notifyReportCreated(@PathVariable("sessionCode") String sessionCode);
}
