package com.declitech.module.service;

import com.declitech.module.client.SessionServiceClient;
import com.declitech.module.dto.CreateModuleRequest;
import com.declitech.module.dto.ModuleDTO;
import com.declitech.module.dto.UpdateModuleRequest;
import com.declitech.module.exception.ModuleNotFoundException;
import com.declitech.module.exception.UnauthorizedException;
import com.declitech.module.model.Module;
import com.declitech.module.repository.ModuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Unit tests — ModuleService")
class ModuleServiceTest {

    @Mock private ModuleRepository moduleRepository;
    @Mock private SessionServiceClient sessionServiceClient;

    @InjectMocks
    private ModuleService moduleService;

    private Module sampleModule;

    @BeforeEach
    void setUp() {
        sampleModule = Module.builder()
                .id(1L)
                .title("Java Fundamentals")
                .description("Introduction to Java programming")
                .sites(List.of("codecombat.com", "code.org"))
                .createdBy(42L)
                .createdByUsername("instructor.ali")
                .createdByEmail("ali@iam.declitech.local")
                .createdAt(LocalDateTime.now().minusDays(1))
                .build();
    }

    // =========================================================
    //  createModule()
    // =========================================================

    @Test
    @DisplayName("createModule - valid request → module persisted and DTO returned")
    void createModule_ValidRequest_ShouldPersistAndReturnDTO() {
        CreateModuleRequest request = new CreateModuleRequest(
                "Java Fundamentals", "Intro to Java", List.of("codecombat.com"));

        when(moduleRepository.save(any(Module.class))).thenReturn(sampleModule);
        when(moduleRepository.existsById(1L)).thenReturn(true);
        when(sessionServiceClient.getSessionsByModuleId(1L)).thenReturn(List.of());

        ModuleDTO result = moduleService.createModule(42L, "instructor.ali", "ali@iam.declitech.local", request);

        assertThat(result).isNotNull();
        assertThat(result.getTitle()).isEqualTo("Java Fundamentals");
        assertThat(result.getCreatedBy()).isEqualTo(42L);
        verify(moduleRepository).save(any(Module.class));
    }

    // =========================================================
    //  getModuleById()
    // =========================================================

    @Test
    @DisplayName("getModuleById - existing id → returns DTO")
    void getModuleById_Exists_ShouldReturnDTO() {
        when(moduleRepository.findById(1L)).thenReturn(Optional.of(sampleModule));
        when(moduleRepository.existsById(1L)).thenReturn(true);
        when(sessionServiceClient.getSessionsByModuleId(1L)).thenReturn(List.of());

        ModuleDTO result = moduleService.getModuleById(1L);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getTitle()).isEqualTo("Java Fundamentals");
    }

    @Test
    @DisplayName("getModuleById - unknown id → throws ModuleNotFoundException")
    void getModuleById_NotFound_ShouldThrowModuleNotFoundException() {
        when(moduleRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> moduleService.getModuleById(999L))
                .isInstanceOf(ModuleNotFoundException.class)
                .hasMessageContaining("999");
    }

    // =========================================================
    //  getAllModules()
    // =========================================================

    @Test
    @DisplayName("getAllModules - returns all modules sorted by createdAt DESC")
    void getAllModules_ShouldReturnSortedList() {
        when(moduleRepository.findAll(any(Sort.class))).thenReturn(List.of(sampleModule));
        when(moduleRepository.existsById(1L)).thenReturn(true);
        when(sessionServiceClient.getSessionsByModuleId(1L)).thenReturn(List.of());

        var result = moduleService.getAllModules();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getTitle()).isEqualTo("Java Fundamentals");
    }

    @Test
    @DisplayName("getAllModules - empty database → returns empty list")
    void getAllModules_EmptyRepo_ShouldReturnEmptyList() {
        when(moduleRepository.findAll(any(Sort.class))).thenReturn(List.of());

        var result = moduleService.getAllModules();

        assertThat(result).isEmpty();
    }

    // =========================================================
    //  getModulesByUser()
    // =========================================================

    @Test
    @DisplayName("getModulesByUser - returns modules owned by userId")
    void getModulesByUser_ShouldReturnUserModules() {
        when(moduleRepository.findByCreatedBy(42L)).thenReturn(List.of(sampleModule));
        when(moduleRepository.existsById(1L)).thenReturn(true);
        when(sessionServiceClient.getSessionsByModuleId(1L)).thenReturn(List.of());

        var result = moduleService.getModulesByUser(42L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCreatedByUsername()).isEqualTo("instructor.ali");
    }

    @Test
    @DisplayName("getModulesByUser - other userId → returns empty list")
    void getModulesByUser_OtherUser_ShouldReturnEmpty() {
        when(moduleRepository.findByCreatedBy(99L)).thenReturn(List.of());

        var result = moduleService.getModulesByUser(99L);

        assertThat(result).isEmpty();
    }

    // =========================================================
    //  updateModule()
    // =========================================================

    @Test
    @DisplayName("updateModule - owner updates → module saved with new data")
    void updateModule_ByOwner_ShouldUpdateAndReturn() {
        UpdateModuleRequest request = new UpdateModuleRequest(
                "Advanced Java", "Deep dive into Java", List.of("vittascience.com"));

        when(moduleRepository.findById(1L)).thenReturn(Optional.of(sampleModule));
        when(moduleRepository.save(any(Module.class))).thenAnswer(inv -> inv.getArgument(0));
        when(moduleRepository.existsById(1L)).thenReturn(true);
        when(sessionServiceClient.getSessionsByModuleId(1L)).thenReturn(List.of());

        ModuleDTO result = moduleService.updateModule(1L, 42L, request);

        assertThat(result.getTitle()).isEqualTo("Advanced Java");
        assertThat(result.getDescription()).isEqualTo("Deep dive into Java");
        verify(moduleRepository).save(any(Module.class));
    }

    @Test
    @DisplayName("updateModule - non-owner → throws UnauthorizedException")
    void updateModule_ByNonOwner_ShouldThrowUnauthorizedException() {
        UpdateModuleRequest request = new UpdateModuleRequest(
                "Hacked Title", null, List.of("site.com"));

        when(moduleRepository.findById(1L)).thenReturn(Optional.of(sampleModule));

        assertThatThrownBy(() -> moduleService.updateModule(1L, 999L, request))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("not authorized");
    }

    @Test
    @DisplayName("updateModule - module not found → throws ModuleNotFoundException")
    void updateModule_NotFound_ShouldThrowModuleNotFoundException() {
        UpdateModuleRequest request = new UpdateModuleRequest("T", null, List.of("s"));
        when(moduleRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> moduleService.updateModule(999L, 42L, request))
                .isInstanceOf(ModuleNotFoundException.class);
    }

    // =========================================================
    //  deleteModule()
    // =========================================================

    @Test
    @DisplayName("deleteModule - owner deletes → repository.delete called")
    void deleteModule_ByOwner_ShouldCallDelete() {
        when(moduleRepository.findById(1L)).thenReturn(Optional.of(sampleModule));

        moduleService.deleteModule(1L, 42L);

        verify(moduleRepository).delete(sampleModule);
    }

    @Test
    @DisplayName("deleteModule - non-owner → throws UnauthorizedException")
    void deleteModule_ByNonOwner_ShouldThrowUnauthorizedException() {
        when(moduleRepository.findById(1L)).thenReturn(Optional.of(sampleModule));

        assertThatThrownBy(() -> moduleService.deleteModule(1L, 777L))
                .isInstanceOf(UnauthorizedException.class);

        verify(moduleRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteModule - not found → throws ModuleNotFoundException")
    void deleteModule_NotFound_ShouldThrowModuleNotFoundException() {
        when(moduleRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> moduleService.deleteModule(999L, 42L))
                .isInstanceOf(ModuleNotFoundException.class);
    }

    // =========================================================
    //  getModuleSessions()
    // =========================================================

    @Test
    @DisplayName("getModuleSessions - module exists, sessions returned → list of SessionInfoDTO")
    void getModuleSessions_ModuleExists_ShouldReturnSessions() {
        SessionServiceClient.SessionDTO session = new SessionServiceClient.SessionDTO();
        session.id = 10L;
        session.sessionCode = "SESS01";
        session.title = "Java Session 1";
        session.createdAt = LocalDateTime.now();

        when(moduleRepository.existsById(1L)).thenReturn(true);
        when(sessionServiceClient.getSessionsByModuleId(1L)).thenReturn(List.of(session));

        var result = moduleService.getModuleSessions(1L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getSessionCode()).isEqualTo("SESS01");
    }

    @Test
    @DisplayName("getModuleSessions - module not found → throws ModuleNotFoundException")
    void getModuleSessions_ModuleNotFound_ShouldThrowException() {
        when(moduleRepository.existsById(999L)).thenReturn(false);

        assertThatThrownBy(() -> moduleService.getModuleSessions(999L))
                .isInstanceOf(ModuleNotFoundException.class);
    }

    @Test
    @DisplayName("getModuleSessions - Feign client fails → returns empty list gracefully")
    void getModuleSessions_FeignFails_ShouldReturnEmptyList() {
        when(moduleRepository.existsById(1L)).thenReturn(true);
        when(sessionServiceClient.getSessionsByModuleId(1L))
                .thenThrow(new RuntimeException("session-service unavailable"));

        var result = moduleService.getModuleSessions(1L);

        assertThat(result).isEmpty();
    }

    // =========================================================
    //  getModulesPaginated()
    // =========================================================

    @Test
    @DisplayName("getModulesPaginated - returns paged response with correct metadata")
    void getModulesPaginated_ShouldReturnCorrectPage() {
        Page<Module> page = new PageImpl<>(List.of(sampleModule));
        when(moduleRepository.findAll(any(Pageable.class))).thenReturn(page);
        when(moduleRepository.existsById(1L)).thenReturn(true);
        when(sessionServiceClient.getSessionsByModuleId(1L)).thenReturn(List.of());

        var result = moduleService.getModulesPaginated(0, 10, "createdAt", "DESC");

        assertThat(result.getModules()).hasSize(1);
        assertThat(result.getCurrentPage()).isEqualTo(0);
        assertThat(result.getTotalItems()).isEqualTo(1L);
        assertThat(result.isHasNext()).isFalse();
        assertThat(result.isHasPrevious()).isFalse();
    }
}
