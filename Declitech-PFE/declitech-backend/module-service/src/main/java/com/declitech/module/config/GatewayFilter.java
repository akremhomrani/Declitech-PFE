package com.declitech.module.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@Order(1)
public class GatewayFilter implements Filter {

    @Value("${gateway.secret}")
    private String gatewaySecret;

    @Value("${gateway.require-header:true}")
    private boolean requireGatewayHeader;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;
        String requestURI = httpRequest.getRequestURI();
        
        if (requestURI.startsWith("/actuator/")) {
            chain.doFilter(request, response);
            return;
        }

        if (!requireGatewayHeader) {
            chain.doFilter(request, response);
            return;
        }

        String gatewayHeader = httpRequest.getHeader("X-Gateway-Secret");

        if (gatewayHeader == null || !gatewayHeader.equals(gatewaySecret)) {
            httpResponse.setStatus(HttpServletResponse.SC_FORBIDDEN);
            httpResponse.setContentType("application/json");
            httpResponse.getWriter().write("{\"error\":\"Direct access forbidden. Please use API Gateway.\"}");
            return;
        }

        chain.doFilter(request, response);
    }
}
