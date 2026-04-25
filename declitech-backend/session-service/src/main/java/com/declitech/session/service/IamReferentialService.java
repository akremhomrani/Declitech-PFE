package com.declitech.session.service;

import com.declitech.session.dto.IamSiteDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Service
public class IamReferentialService {

    private final RestTemplate restTemplate;

    @Value("${declitech.iam.api-key}")
    private String apiKey;

    @Value("${declitech.iam.sites-url}")
    private String sitesUrl;

    public IamReferentialService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public List<IamSiteDto> getSites() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Api-Key", apiKey);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        ResponseEntity<IamSiteDto[]> response = restTemplate.exchange(
                sitesUrl, HttpMethod.GET, entity, IamSiteDto[].class
        );

        return response.getBody() != null
                ? Arrays.asList(response.getBody())
                : Collections.emptyList();
    }
}
