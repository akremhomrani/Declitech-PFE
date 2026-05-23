package com.declitech.report.controller;

import com.declitech.report.dto.EmotionReportDTO;
import com.declitech.report.dto.agent.SessionValidationResponse;
import com.declitech.report.service.EmotionReportService;
import com.declitech.report.service.agent.EmotionTimelineService;
import com.declitech.report.service.agent.SessionValidationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AgentGatewayController.class)
@DisplayName("Unit tests — AgentGatewayController")
class AgentGatewayControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private SessionValidationService sessionValidationService;
    @MockBean private EmotionReportService emotionReportService;
    @MockBean private EmotionTimelineService emotionTimelineService;

    @Test
    @DisplayName("GET / returns identity payload")
    void rootReturnsIdentity() throws Exception {
        mockMvc.perform(get("/api/agent/"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true))
                .andExpect(jsonPath("$.version").value("3.0.0"));
    }

    @Test
    @DisplayName("GET /status returns extension-native mode")
    void statusReturnsExtensionNative() throws Exception {
        mockMvc.perform(get("/api/agent/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.running").value(true))
                .andExpect(jsonPath("$.mode").value("extension-native"));
    }

    @Test
    @DisplayName("GET /validate/{code} delegates to validation service")
    void validateDelegates() throws Exception {
        when(sessionValidationService.validate("ABC123"))
                .thenReturn(SessionValidationResponse.builder().valid(true).reason("ok").build());

        mockMvc.perform(get("/api/agent/validate/ABC123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.reason").value("ok"));
    }

    @Test
    @DisplayName("POST /start with valid code + login seeds participant report")
    void startSeedsParticipantWhenValid() throws Exception {
        when(sessionValidationService.validate("ABC123")).thenReturn(
                SessionValidationResponse.builder()
                        .valid(true)
                        .reason("ok")
                        .session(Map.of("id", 42))
                        .build()
        );

        Map<String, Object> body = Map.of("code", "ABC123", "login_identity", "user@dev.local");
        mockMvc.perform(post("/api/agent/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.session_id").value("SESSION-42"))
                .andExpect(jsonPath("$.valid").value(true));

        verify(emotionReportService, times(1)).saveReportFromDTO(any(EmotionReportDTO.class));
    }

    @Test
    @DisplayName("POST /start with empty login skips seeding")
    void startSkipsSeedingWhenLoginMissing() throws Exception {
        when(sessionValidationService.validate("ABC123")).thenReturn(
                SessionValidationResponse.builder()
                        .valid(true)
                        .reason("ok")
                        .session(Map.of("id", 42))
                        .build()
        );

        Map<String, Object> body = Map.of("code", "ABC123");
        mockMvc.perform(post("/api/agent/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());

        verify(emotionReportService, never()).saveReportFromDTO(any());
    }

    @Test
    @DisplayName("POST /start with invalid code uses LOCAL- prefix and skips seeding")
    void startInvalidCodeUsesLocalPrefix() throws Exception {
        when(sessionValidationService.validate("XXXXXX")).thenReturn(
                SessionValidationResponse.builder()
                        .valid(false)
                        .reason("not_found")
                        .build()
        );

        Map<String, Object> body = Map.of("code", "XXXXXX", "login_identity", "u");
        mockMvc.perform(post("/api/agent/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.session_id").value("LOCAL-XXXXXX"))
                .andExpect(jsonPath("$.valid").value(false));

        verify(emotionReportService, never()).saveReportFromDTO(any());
    }

    @Test
    @DisplayName("POST /stop returns STOPPED")
    void stopReturnsStopped() throws Exception {
        mockMvc.perform(post("/api/agent/stop"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("STOPPED"));
    }

    @Test
    @DisplayName("POST /pedagogy/progress accepts the payload")
    void pedagogyProgressAccepted() throws Exception {
        Map<String, Object> body = Map.of(
                "sessionId", "S1",
                "studentLoginIdentity", "u",
                "timestamp", "2026-05-03T14:00:00Z",
                "platform", "code.org"
        );
        mockMvc.perform(post("/api/agent/pedagogy/progress")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECEIVED"));
    }
}
