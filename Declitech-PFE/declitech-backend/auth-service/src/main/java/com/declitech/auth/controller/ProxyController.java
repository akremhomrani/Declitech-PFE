package com.declitech.auth.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.Collections;
import java.util.Enumeration;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ProxyController {

    private final RestTemplate restTemplate;

    @Value("${services.user-service.url}")
    private String userServiceUrl;

    @Value("${services.session-service.url}")
    private String sessionServiceUrl;

    @Value("${services.report-service.url}")
    private String reportServiceUrl;

    @Value("${services.module-service.url}")
    private String moduleServiceUrl;

    @Value("${gateway.secret}")
    private String gatewaySecret;

    @RequestMapping(value = "/users/**", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH, RequestMethod.OPTIONS})
    public ResponseEntity<String> proxyUsers(HttpServletRequest request, @RequestBody(required = false) String body) {
        String path = request.getRequestURI().substring("/api/users".length());
        return proxyRequest(userServiceUrl + "/api/users" + path, request, body);
    }

    @RequestMapping(value = "/sessions/**", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH, RequestMethod.OPTIONS})
    public ResponseEntity<String> proxySessions(HttpServletRequest request, @RequestBody(required = false) String body) {
        String path = request.getRequestURI().substring("/api/sessions".length());
        return proxyRequest(sessionServiceUrl + "/api/sessions" + path, request, body);
    }

    @RequestMapping(value = "/emotions/**", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH, RequestMethod.OPTIONS})
    public ResponseEntity<String> proxyEmotions(HttpServletRequest request, @RequestBody(required = false) String body) {
        String path = request.getRequestURI().substring("/api/emotions".length());
        return proxyRequest(reportServiceUrl + "/api/reports" + path, request, body);
    }

    @RequestMapping(value = "/alerts/**", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH, RequestMethod.OPTIONS})
    public ResponseEntity<String> proxyAlerts(HttpServletRequest request, @RequestBody(required = false) String body) {
        String path = request.getRequestURI().substring("/api/alerts".length());
        return proxyRequest(reportServiceUrl + "/api/alerts" + path, request, body);
    }

    @RequestMapping(value = "/reports/**", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH, RequestMethod.OPTIONS})
    public ResponseEntity<String> proxyReports(HttpServletRequest request, @RequestBody(required = false) String body) {
        String path = request.getRequestURI().substring("/api/reports".length());
        return proxyRequest(reportServiceUrl + "/api/reports" + path, request, body);
    }

    @RequestMapping(value = "/modules/**", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH, RequestMethod.OPTIONS})
    public ResponseEntity<String> proxyModules(HttpServletRequest request, @RequestBody(required = false) String body) {
        String path = request.getRequestURI().substring("/api/modules".length());
        return proxyRequest(moduleServiceUrl + "/api/modules" + path, request, body);
    }

    private ResponseEntity<String> proxyRequest(String targetUrl, HttpServletRequest request, String body) {
        String queryString = request.getQueryString();
        final String finalTargetUrl;
        if (queryString != null && !queryString.isEmpty()) {
            finalTargetUrl = targetUrl + "?" + queryString;
        } else {
            finalTargetUrl = targetUrl;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add("X-Gateway-Secret", gatewaySecret);
            
            Enumeration<String> headerNames = request.getHeaderNames();
            while (headerNames.hasMoreElements()) {
                String headerName = headerNames.nextElement();
                if (!headerName.equalsIgnoreCase("host") && 
                    !headerName.equalsIgnoreCase("content-length")) {
                    headers.put(headerName, Collections.list(request.getHeaders(headerName)));
                }
            }

            Cookie[] cookies = request.getCookies();
            if (cookies != null) {
                String cookieHeader = Arrays.stream(cookies)
                        .map(cookie -> cookie.getName() + "=" + cookie.getValue())
                        .reduce((a, b) -> a + "; " + b)
                        .orElse("");
                if (!cookieHeader.isEmpty()) {
                    headers.add("Cookie", cookieHeader);
                }
            }

            HttpEntity<String> entity;
            if (body != null && !body.isEmpty()) {
                headers.setContentType(MediaType.APPLICATION_JSON);
                entity = new HttpEntity<>(body, headers);
            } else {
                entity = new HttpEntity<>(headers);
            }

            HttpMethod method = HttpMethod.valueOf(request.getMethod());
            return restTemplate.exchange(finalTargetUrl, method, entity, String.class);

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Proxy error: " + e.getMessage());
        }
    }
}
