package com.declitech.auth.config;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FeignClientConfiguration {

    @Value("${gateway.secret}")
    private String gatewaySecret;

    @Bean
    public RequestInterceptor requestInterceptor() {
        return new RequestInterceptor() {
            @Override
            public void apply(RequestTemplate requestTemplate) {
                requestTemplate.header("X-Gateway-Secret", gatewaySecret);
                requestTemplate.header("X-Internal-Service-Call", "true");
            }
        };
    }
}
