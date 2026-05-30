package com.declitech.user.config;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class InternalEndpointGatewayFilter implements Filter {

    @Value("${gateway.secret}")
    private String gatewaySecret;

    @Value("${gateway.require-header:true}")
    private boolean requireGatewayHeader;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        if (requireGatewayHeader && isInternalEndpoint(httpRequest.getRequestURI())) {
            String gatewayHeader = httpRequest.getHeader("X-Gateway-Secret");
            if (gatewayHeader == null || !gatewayHeader.equals(gatewaySecret)) {
                httpResponse.setStatus(HttpServletResponse.SC_FORBIDDEN);
                httpResponse.setContentType("application/json");
                httpResponse.getWriter().write("{\"error\":\"Direct access forbidden. Please use API Gateway.\"}");
                return;
            }
        }

        chain.doFilter(request, response);
    }

    private boolean isInternalEndpoint(String uri) {
        return uri.startsWith("/api/users/username/")
                || uri.startsWith("/api/users/email/")
                || uri.startsWith("/api/users/internal/");
    }
}
