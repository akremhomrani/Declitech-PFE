package com.declitech.report.service.agent;

import com.declitech.report.dto.agent.SessionValidationResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@DisplayName("Unit tests — SessionValidationService")
class SessionValidationServiceTest {

    private static final String SESSION_CODE = "ABC123";
    private static final String EXPECTED_PATH = "/api/sessions/code/ABC123";

    private MockRestServiceServer server;
    private SessionValidationService service;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        RestClient restClient = builder.build();
        service = new SessionValidationService(restClient, "secret");
    }

    @Test
    @DisplayName("ACTIVE status → valid + reason ok + session payload")
    void activeStatusReturnsOk() {
        server.expect(requestTo(EXPECTED_PATH))
                .andExpect(method(org.springframework.http.HttpMethod.GET))
                .andExpect(header("X-Gateway-Secret", "secret"))
                .andRespond(withSuccess("{\"status\":\"ACTIVE\",\"id\":42}", MediaType.APPLICATION_JSON));

        SessionValidationResponse result = service.validate(SESSION_CODE);

        assertThat(result.isValid()).isTrue();
        assertThat(result.getReason()).isEqualTo("ok");
        assertThat(result.getSession()).containsEntry("id", 42);
        server.verify();
    }

    @Test
    @DisplayName("EXPIRED status → invalid + reason expired")
    void expiredStatusReturnsExpired() {
        server.expect(requestTo(EXPECTED_PATH))
                .andRespond(withSuccess("{\"status\":\"EXPIRED\",\"id\":7}", MediaType.APPLICATION_JSON));

        SessionValidationResponse result = service.validate(SESSION_CODE);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getReason()).isEqualTo("expired");
    }

    @Test
    @DisplayName("Other status → invalid + reason inactive")
    void otherStatusReturnsInactive() {
        server.expect(requestTo(EXPECTED_PATH))
                .andRespond(withSuccess("{\"status\":\"ENDED\"}", MediaType.APPLICATION_JSON));

        SessionValidationResponse result = service.validate(SESSION_CODE);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getReason()).isEqualTo("inactive");
    }

    @Test
    @DisplayName("Empty body → invalid + reason not_found")
    void emptyBodyReturnsNotFound() {
        server.expect(requestTo(EXPECTED_PATH))
                .andRespond(withSuccess("", MediaType.APPLICATION_JSON));

        SessionValidationResponse result = service.validate(SESSION_CODE);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getReason()).isEqualTo("not_found");
    }

    @Test
    @DisplayName("Server error → safe fallback (valid + server_unreachable)")
    void serverErrorReturnsSafeFallback() {
        server.expect(requestTo(EXPECTED_PATH))
                .andRespond(withServerError());

        SessionValidationResponse result = service.validate(SESSION_CODE);

        assertThat(result.isValid()).isTrue();
        assertThat(result.getReason()).isEqualTo("server_unreachable");
        assertThat(result.getSession()).isNull();
    }
}
