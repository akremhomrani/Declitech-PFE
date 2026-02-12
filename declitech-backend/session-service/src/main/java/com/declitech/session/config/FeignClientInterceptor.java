package com.declitech.session.config;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
@Slf4j
public class FeignClientInterceptor implements RequestInterceptor {

    @Override
    public void apply(RequestTemplate template) {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                
                // Try Authorization header first (for backward compatibility)
                String authHeader = request.getHeader("Authorization");
                
                if (authHeader != null && !authHeader.isEmpty()) {
                    log.debug("Forwarding JWT token from Authorization header to downstream service");
                    template.header("Authorization", authHeader);
                } else {
                    // Try to get JWT from accessToken cookie
                    String accessToken = extractAccessTokenFromCookies(request);
                    if (accessToken != null && !accessToken.isEmpty()) {
                        log.debug("Forwarding JWT token from cookie as Authorization header to downstream service");
                        template.header("Authorization", "Bearer " + accessToken);
                    } else {
                        log.debug("No JWT token found in Authorization header or cookies");
                    }
                }
            } else {
                log.debug("RequestContextHolder attributes are null");
            }
        } catch (Exception e) {
            log.warn("Error forwarding Authorization header to Feign client: {}", e.getMessage());
        }
    }
    
    private String extractAccessTokenFromCookies(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("accessToken".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}
