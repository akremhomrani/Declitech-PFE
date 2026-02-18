package com.declitech.report.service;

import com.declitech.report.dto.AlertEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
public class AlertKafkaProducer {

    private final KafkaTemplate<String, AlertEvent> kafkaTemplate;

    @Value("${spring.kafka.topic.participant-alerts}")
    private String alertTopic;

    public void publishAlert(AlertEvent alertEvent) {
        try {
            CompletableFuture<SendResult<String, AlertEvent>> future = 
                    kafkaTemplate.send(alertTopic, alertEvent.getSessionId(), alertEvent);

            future.whenComplete((result, ex) -> {
            });

        } catch (Exception e) {
        }
    }
}
