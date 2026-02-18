package com.declitech.report.config;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
public class FeignClientInterceptor implements RequestInterceptor {

    @Value("${gateway.secret}")
    private String gatewaySecret;

    @Override
    public void apply(RequestTemplate template) {
        // Always add gateway secret header for inter-service communication
        template.header("X-Gateway-Secret", gatewaySecret);
        
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                
                String authHeader = request.getHeader("Authorization");
                
                if (authHeader != null && !authHeader.isEmpty()) {
                    template.header("Authorization", authHeader);
                } else {
                    String accessToken = extractAccessTokenFromCookies(request);
                    if (accessToken != null && !accessToken.isEmpty()) {
                        template.header("Authorization", "Bearer " + accessToken);
                    }
                }
            }
        } catch (Exception e) {
            // Silently handle exception
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
