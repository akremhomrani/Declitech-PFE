package com.declitech.report.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

@FeignClient(name = "session-service")
public interface SessionServiceClient {
    // No methods needed currently
    // Participants and reports are now counted dynamically from emotion_reports table
}
