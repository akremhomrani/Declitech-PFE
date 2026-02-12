package com.declitech.gateway.filter;

import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpCookie;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;

/**
 * Gateway filter that extracts JWT token from httpOnly cookie
 * and adds it as Authorization header for downstream services
 */
@Component
public class CookieToHeaderFilter extends AbstractGatewayFilterFactory<CookieToHeaderFilter.Config> {

    public CookieToHeaderFilter() {
        super(Config.class);
    }

    @Override
    public GatewayFilter apply(Config config) {
        return (exchange, chain) -> {
            ServerHttpRequest request = exchange.getRequest();
            
            // Get cookies from request
            MultiValueMap<String, HttpCookie> cookies = request.getCookies();
            
            // Look for accessToken cookie
            if (cookies.containsKey("accessToken")) {
                HttpCookie accessTokenCookie = cookies.getFirst("accessToken");
                if (accessTokenCookie != null && accessTokenCookie.getValue() != null) {
                    String token = accessTokenCookie.getValue();
                    
                    // Add Authorization header with Bearer token for downstream services
                    ServerHttpRequest modifiedRequest = request.mutate()
                            .header("Authorization", "Bearer " + token)
                            .build();
                    
                    return chain.filter(exchange.mutate().request(modifiedRequest).build());
                }
            }
            
            return chain.filter(exchange);
        };
    }

    public static class Config {
        // Configuration properties can be added here if needed
    }
}
