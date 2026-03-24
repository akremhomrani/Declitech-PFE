package com.declitech.module.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.time.LocalDateTime;
import java.util.List;

@FeignClient(name = "session-service")
public interface SessionServiceClient {
    
    @GetMapping("/api/sessions/{id}")
    SessionDTO getSessionById(@PathVariable("id") Long id);
    
    @GetMapping("/api/sessions/module/{moduleId}")
    List<SessionDTO> getSessionsByModuleId(@PathVariable("moduleId") Long moduleId);
    
    class SessionDTO {
        public Long id;
        public String sessionCode;
        public String title;
        public Long instructorId;
        public String instructorUsername;
        public String instructorEmail;
        public Long moduleId;
        public LocalDateTime createdAt;
        public LocalDateTime expiresAt;
        public String status;
    }
}
