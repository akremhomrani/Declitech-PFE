package com.declitech.report.service;

import com.declitech.report.dto.AlertEvent;
import com.declitech.report.dto.AlertSeverity;
import com.declitech.report.dto.AlertType;
import com.declitech.report.model.SessionAlert;
import com.declitech.report.repository.SessionAlertRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Unit tests — AlertService")
class AlertServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private SessionAlertRepository alertRepository;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private ListOperations<String, String> listOps;

    // Real ObjectMapper as a Spy so @InjectMocks can inject it via constructor
    @Spy
    private ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    // Constructed manually so all 3 dependencies (including the Spy) are wired correctly
    private AlertService alertService;

    private AlertEvent tabSwitchAlert;
    private AlertEvent resolvedAlert;

    @BeforeEach
    void setUp() {
        alertService = new AlertService(redisTemplate, alertRepository, objectMapper);

        tabSwitchAlert = AlertEvent.builder()
                .sessionId("SESS-001")
                .studentLoginIdentity("eya@declitech.com")
                .alertType(AlertType.TAB_SWITCH)
                .severity(AlertSeverity.LOW)
                .message("Student navigated to youtube.com")
                .timestamp(LocalDateTime.now())
                .metadata(Map.of("currentUrl", "https://youtube.com", "tabTitle", "YouTube", "switchCount", 1))
                .build();

        resolvedAlert = AlertEvent.builder()
                .sessionId("SESS-001")
                .studentLoginIdentity("eya@declitech.com")
                .alertType(AlertType.ALERT_RESOLVED)
                .severity(AlertSeverity.LOW)
                .message("Student returned to allowed site")
                .timestamp(LocalDateTime.now())
                .build();
    }

    // =========================================================
    //  saveAndBroadcast()
    // =========================================================

    @Test
    @DisplayName("saveAndBroadcast - new TAB_SWITCH alert → deduplicated and pushed to Redis")
    void saveAndBroadcast_NewAlert_ShouldPushToRedis() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(redisTemplate.opsForList()).thenReturn(listOps);
        when(valueOps.setIfAbsent(anyString(), anyString(), anyLong(), any(TimeUnit.class)))
                .thenReturn(Boolean.TRUE);

        alertService.saveAndBroadcast(tabSwitchAlert);

        verify(listOps).rightPush(anyString(), anyString());
        verify(redisTemplate).expire(anyString(), eq(24L), eq(TimeUnit.HOURS));
    }

    @Test
    @DisplayName("saveAndBroadcast - duplicate alert within dedup window → NOT pushed to Redis")
    void saveAndBroadcast_DuplicateAlert_ShouldNotPushToRedis() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.setIfAbsent(anyString(), anyString(), anyLong(), any(TimeUnit.class)))
                .thenReturn(Boolean.FALSE);

        alertService.saveAndBroadcast(tabSwitchAlert);

        verify(listOps, never()).rightPush(anyString(), anyString());
    }

    @Test
    @DisplayName("saveAndBroadcast - ALERT_RESOLVED skips dedup → always pushed to Redis")
    void saveAndBroadcast_AlertResolved_ShouldSkipDedupAndPushToRedis() {
        when(redisTemplate.opsForList()).thenReturn(listOps);

        alertService.saveAndBroadcast(resolvedAlert);

        // No dedup check for RESOLVED alerts
        verify(redisTemplate, never()).opsForValue();
        verify(listOps).rightPush(anyString(), anyString());
    }

    // =========================================================
    //  flushAlertsToDb()
    // =========================================================

    @Test
    @DisplayName("flushAlertsToDb - Redis has alerts → persisted to DB and Redis key deleted")
    void flushAlertsToDb_WithRedisAlerts_ShouldPersistAndClearRedis() throws Exception {
        String json = objectMapper.writeValueAsString(tabSwitchAlert);
        SessionAlert savedAlert = SessionAlert.builder()
                .id(1L)
                .sessionId("SESS-001")
                .studentLoginIdentity("eya@declitech.com")
                .alertType(AlertType.TAB_SWITCH)
                .build();

        when(redisTemplate.opsForList()).thenReturn(listOps);
        when(listOps.range(anyString(), eq(0L), eq(-1L))).thenReturn(List.of(json));
        when(alertRepository.saveAll(anyList())).thenReturn(List.of(savedAlert));

        List<SessionAlert> result = alertService.flushAlertsToDb("SESS-001", "eya@declitech.com");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getSessionId()).isEqualTo("SESS-001");
        verify(alertRepository).saveAll(anyList());
        verify(redisTemplate).delete(anyString());
    }

    @Test
    @DisplayName("flushAlertsToDb - no Redis data → returns existing DB alerts without re-saving")
    void flushAlertsToDb_NoRedisData_ShouldReturnDbAlerts() {
        SessionAlert existingAlert = SessionAlert.builder()
                .id(5L).sessionId("SESS-001").alertType(AlertType.MOUSE_INACTIVITY).build();

        when(redisTemplate.opsForList()).thenReturn(listOps);
        when(listOps.range(anyString(), eq(0L), eq(-1L))).thenReturn(List.of());
        when(alertRepository.findBySessionIdAndStudentLoginIdentityOrderByTimestampAsc(
                "SESS-001", "eya@declitech.com")).thenReturn(List.of(existingAlert));

        List<SessionAlert> result = alertService.flushAlertsToDb("SESS-001", "eya@declitech.com");

        assertThat(result).hasSize(1);
        verify(alertRepository, never()).saveAll(anyList());
        verify(redisTemplate, never()).delete(anyString());
    }

    // =========================================================
    //  getActiveConnectionsForSession() / getTotalActiveConnections()
    // =========================================================

    @Test
    @DisplayName("getActiveConnectionsForSession - no emitters registered → returns 0")
    void getActiveConnectionsForSession_NoEmitters_ShouldReturnZero() {
        assertThat(alertService.getActiveConnectionsForSession("SESS-001")).isEqualTo(0);
    }

    @Test
    @DisplayName("getTotalActiveConnections - no sessions → returns 0")
    void getTotalActiveConnections_NoSessions_ShouldReturnZero() {
        assertThat(alertService.getTotalActiveConnections()).isEqualTo(0);
    }

    // =========================================================
    //  getAlertsBySessionAndStudent()
    // =========================================================

    @Test
    @DisplayName("getAlertsBySessionAndStudent - returns alerts ordered by timestamp")
    void getAlertsBySessionAndStudent_ShouldDelegateToRepository() {
        List<SessionAlert> expected = List.of(
                SessionAlert.builder().id(1L).alertType(AlertType.TAB_SWITCH).build(),
                SessionAlert.builder().id(2L).alertType(AlertType.MOUSE_INACTIVITY).build()
        );
        when(alertRepository.findBySessionIdAndStudentLoginIdentityOrderByTimestampAsc(
                "SESS-001", "eya@declitech.com")).thenReturn(expected);

        List<SessionAlert> result = alertService.getAlertsBySessionAndStudent(
                "SESS-001", "eya@declitech.com");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getAlertType()).isEqualTo(AlertType.TAB_SWITCH);
        assertThat(result.get(1).getAlertType()).isEqualTo(AlertType.MOUSE_INACTIVITY);
    }
}
