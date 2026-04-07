package com.declitech.report.service;

/**
 * @deprecated Replaced by {@link AlertService}.
 * Kafka has been removed — alerts are now buffered in Redis and persisted to PostgreSQL.
 */
@Deprecated
public class AlertKafkaConsumer {
    // No longer used. All SSE + storage logic is in AlertService.
}
