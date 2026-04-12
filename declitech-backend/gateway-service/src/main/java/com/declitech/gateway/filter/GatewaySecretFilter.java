package com.declitech.gateway.filter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Injects the X-Gateway-Secret header into every downstream request.
 * Downstream services (session-service, module-service, etc.) check for this
 * header to ensure they are only called through the gateway, not directly.
 */
@Component
public class GatewaySecretFilter implements GlobalFilter, Ordered {

    @Value("${gateway.secret}")
    private String gatewaySecret;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest mutated = exchange.getRequest().mutate()
                .header("X-Gateway-Secret", gatewaySecret)
                .build();
        return chain.filter(exchange.mutate().request(mutated).build());
    }

    @Override
    public int getOrder() {
        return -99; // Run after JwtAuthFilter
    }
}
