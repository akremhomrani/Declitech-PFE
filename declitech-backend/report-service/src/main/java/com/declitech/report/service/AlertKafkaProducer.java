package com.declitech.report.service;

import com.declitech.report.dto.AlertEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class AlertKafkaProducer {

    private final KafkaTemplate<String, AlertEvent> kafkaTemplate;

    @Value("${spring.kafka.topic.participant-alerts}")
    private String alertTopic;

    /**
     * Publie une alerte dans Kafka
     */
    public void publishAlert(AlertEvent alertEvent) {
        try {
            log.info("📤 Publishing alert to Kafka: {} - {} ({})", 
                    alertEvent.getAlertType(), 
                    alertEvent.getMessage(), 
                    alertEvent.getSeverity());

            CompletableFuture<SendResult<String, AlertEvent>> future = 
                    kafkaTemplate.send(alertTopic, alertEvent.getSessionId(), alertEvent);

            future.whenComplete((result, ex) -> {
                if (ex == null) {
                    log.info("✅ Alert published successfully: partition={}, offset={}", 
                            result.getRecordMetadata().partition(),
                            result.getRecordMetadata().offset());
                } else {
                    log.error("❌ Failed to publish alert: {}", ex.getMessage(), ex);
                }
            });

        } catch (Exception e) {
            log.error("❌ Error publishing alert to Kafka", e);
        }
    }
}
