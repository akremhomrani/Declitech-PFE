package com.declitech.session.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(name = "report-service")
public interface ReportServiceClient {

    @GetMapping("/api/reports/count")
    Integer getReportCountBySessionId(@RequestParam("sessionId") Long sessionId);

    @GetMapping("/api/reports/participants/count")
    Long getParticipantCountBySessionId(@RequestParam("sessionId") Long sessionId);
}
