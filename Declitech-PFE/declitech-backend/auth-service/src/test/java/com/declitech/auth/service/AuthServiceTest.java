package com.declitech.auth.service;

import com.declitech.auth.client.UserServiceClient;
import com.declitech.auth.dto.LoginRequest;
import com.declitech.auth.dto.LoginResponse;
import com.declitech.auth.dto.TokenResponse;
import com.declitech.auth.dto.UserDto;
import com.declitech.auth.exception.InvalidCredentialsException;
import com.declitech.auth.exception.InvalidTokenException;
import com.declitech.auth.exception.UserInactiveException;
import feign.FeignException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Tests unitaires — AuthService")
class AuthServiceTest {

    @Mock private AuthenticationManager authenticationManager;
    @Mock private UserDetailsService userDetailsService;
    @Mock private JwtService jwtService;
    @Mock private UserServiceClient userServiceClient;

    @InjectMocks
    private AuthService authService;

    private UserDto activeUser;
    private UserDto inactiveUser;
    private UserDetails mockUserDetails;
    private Authentication mockAuthentication;

    @BeforeEach
    void setUp() {
        activeUser = new UserDto();
        activeUser.setId(1L);
        activeUser.setUsername("admin");
        activeUser.setEmail("admin@declitech.com");
        activeUser.setFirstName("Admin");
        activeUser.setLastName("User");
        activeUser.setRole("ADMIN");
        activeUser.setActive(true);

        inactiveUser = new UserDto();
        inactiveUser.setId(2L);
        inactiveUser.setUsername("inactif");
        inactiveUser.setEmail("inactif@declitech.com");
        inactiveUser.setActive(false);
        inactiveUser.setRole("INSTRUCTOR");

        mockUserDetails = mock(UserDetails.class);
        mockAuthentication = mock(Authentication.class);
    }

    // =========================================================
    //  login()
    // =========================================================

    @Test
    @DisplayName("login - credentials valides → LoginResponse avec username et role")
    void login_ValidCredentials_ShouldReturnLoginResponse() {
        // Arrange
        LoginRequest request = new LoginRequest();
        request.setUsernameOrEmail("admin");
        request.setPassword("password123");

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(mockAuthentication);
        when(mockAuthentication.getPrincipal()).thenReturn(mockUserDetails);
        when(userServiceClient.getUserByUsername("admin")).thenReturn(activeUser);
        when(jwtService.generateToken(anyMap(), any(UserDetails.class))).thenReturn("access-token-xyz");
        when(jwtService.generateRefreshToken(any(UserDetails.class))).thenReturn("refresh-token-xyz");

        // Act
        LoginResponse response = authService.login(request);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getUsername()).isEqualTo("admin");
        assertThat(response.getRole()).isEqualTo("ADMIN");
        assertThat(response.getFirstName()).isEqualTo("Admin");
        assertThat(response.getAccessToken()).isEqualTo("access-token-xyz");
        assertThat(response.getRefreshToken()).isEqualTo("refresh-token-xyz");
    }

    @Test
    @DisplayName("login - request null → InvalidCredentialsException")
    void login_NullRequest_ShouldThrowInvalidCredentialsException() {
        assertThatThrownBy(() -> authService.login(null))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessageContaining("cannot be null");
    }

    @Test
    @DisplayName("login - username vide → InvalidCredentialsException")
    void login_EmptyUsername_ShouldThrowInvalidCredentialsException() {
        LoginRequest request = new LoginRequest();
        request.setUsernameOrEmail("");
        request.setPassword("password123");

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessageContaining("Username or email is required");
    }

    @Test
    @DisplayName("login - password vide → InvalidCredentialsException")
    void login_EmptyPassword_ShouldThrowInvalidCredentialsException() {
        LoginRequest request = new LoginRequest();
        request.setUsernameOrEmail("admin");
        request.setPassword("  ");

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessageContaining("Password is required");
    }

    @Test
    @DisplayName("login - mauvais credentials → InvalidCredentialsException")
    void login_BadCredentials_ShouldThrowInvalidCredentialsException() {
        LoginRequest request = new LoginRequest();
        request.setUsernameOrEmail("wrong");
        request.setPassword("badpassword");

        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessageContaining("Invalid username or password");
    }

    @Test
    @DisplayName("login - utilisateur inactif → UserInactiveException")
    void login_InactiveUser_ShouldThrowUserInactiveException() {
        LoginRequest request = new LoginRequest();
        request.setUsernameOrEmail("inactif");
        request.setPassword("password123");

        when(authenticationManager.authenticate(any())).thenReturn(mockAuthentication);
        when(mockAuthentication.getPrincipal()).thenReturn(mockUserDetails);
        when(userServiceClient.getUserByUsername("inactif")).thenReturn(inactiveUser);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(UserInactiveException.class);
    }

    @Test
    @DisplayName("login - login avec email → getUserByEmail appelé")
    void login_WithEmail_ShouldCallGetUserByEmail() {
        LoginRequest request = new LoginRequest();
        request.setUsernameOrEmail("admin@declitech.com");
        request.setPassword("password123");

        when(authenticationManager.authenticate(any())).thenReturn(mockAuthentication);
        when(mockAuthentication.getPrincipal()).thenReturn(mockUserDetails);
        when(userServiceClient.getUserByEmail("admin@declitech.com")).thenReturn(activeUser);
        when(jwtService.generateToken(anyMap(), any())).thenReturn("token");
        when(jwtService.generateRefreshToken(any())).thenReturn("refresh");

        authService.login(request);

        verify(userServiceClient).getUserByEmail("admin@declitech.com");
        verify(userServiceClient, never()).getUserByUsername(anyString());
    }

    @Test
    @DisplayName("login - user-service indisponible → InvalidCredentialsException")
    void login_UserServiceUnavailable_ShouldThrowInvalidCredentialsException() {
        LoginRequest request = new LoginRequest();
        request.setUsernameOrEmail("admin");
        request.setPassword("password");

        when(authenticationManager.authenticate(any())).thenReturn(mockAuthentication);
        when(mockAuthentication.getPrincipal()).thenReturn(mockUserDetails);
        when(userServiceClient.getUserByUsername("admin"))
                .thenThrow(FeignException.ServiceUnavailable.class);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    // =========================================================
    //  refreshToken()
    // =========================================================

    @Test
    @DisplayName("refreshToken - token valide → nouveau TokenResponse")
    void refreshToken_ValidToken_ShouldReturnNewTokenResponse() {
        String refreshToken = "valid-refresh-token";

        when(jwtService.extractUsername(refreshToken)).thenReturn("admin");
        when(userDetailsService.loadUserByUsername("admin")).thenReturn(mockUserDetails);
        when(jwtService.isTokenValid(refreshToken, mockUserDetails)).thenReturn(true);
        when(userServiceClient.getUserByUsername("admin")).thenReturn(activeUser);
        when(jwtService.generateToken(anyMap(), any())).thenReturn("new-access-token");
        when(jwtService.generateRefreshToken(any())).thenReturn("new-refresh-token");
        when(jwtService.getExpirationTime()).thenReturn(86400000L);

        TokenResponse response = authService.refreshToken(refreshToken);

        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("new-access-token");
        assertThat(response.getRefreshToken()).isEqualTo("new-refresh-token");
        assertThat(response.getTokenType()).isEqualTo("Bearer");
    }

    @Test
    @DisplayName("refreshToken - token null → InvalidTokenException")
    void refreshToken_NullToken_ShouldThrowInvalidTokenException() {
        assertThatThrownBy(() -> authService.refreshToken(null))
                .isInstanceOf(InvalidTokenException.class)
                .hasMessageContaining("cannot be null or empty");
    }

    @Test
    @DisplayName("refreshToken - token expiré/invalide → InvalidTokenException")
    void refreshToken_InvalidToken_ShouldThrowInvalidTokenException() {
        String badToken = "expired-token";

        when(jwtService.extractUsername(badToken)).thenReturn("admin");
        when(userDetailsService.loadUserByUsername("admin")).thenReturn(mockUserDetails);
        when(jwtService.isTokenValid(badToken, mockUserDetails)).thenReturn(false);

        assertThatThrownBy(() -> authService.refreshToken(badToken))
                .isInstanceOf(InvalidTokenException.class)
                .hasMessageContaining("Invalid or expired refresh token");
    }

    // =========================================================
    //  validateToken()
    // =========================================================

    @Test
    @DisplayName("validateToken - token valide → true")
    void validateToken_ValidToken_ShouldReturnTrue() {
        when(jwtService.extractUsername("valid-token")).thenReturn("admin");
        when(userDetailsService.loadUserByUsername("admin")).thenReturn(mockUserDetails);
        when(jwtService.isTokenValid("valid-token", mockUserDetails)).thenReturn(true);

        assertThat(authService.validateToken("valid-token")).isTrue();
    }

    @Test
    @DisplayName("validateToken - token null → false")
    void validateToken_NullToken_ShouldReturnFalse() {
        assertThat(authService.validateToken(null)).isFalse();
    }

    @Test
    @DisplayName("validateToken - token vide → false")
    void validateToken_EmptyToken_ShouldReturnFalse() {
        assertThat(authService.validateToken("  ")).isFalse();
    }

    @Test
    @DisplayName("validateToken - token invalide (exception) → false")
    void validateToken_ExceptionThrown_ShouldReturnFalse() {
        when(jwtService.extractUsername(anyString())).thenThrow(new RuntimeException("Parse error"));

        assertThat(authService.validateToken("malformed-token")).isFalse();
    }

    // =========================================================
    //  extractRoleFromToken()
    // =========================================================

    @Test
    @DisplayName("extractRoleFromToken - token valide → rôle correct")
    void extractRoleFromToken_ValidToken_ShouldReturnRole() {
        when(jwtService.extractClaim(eq("token"), any())).thenReturn("ADMIN");

        String role = authService.extractRoleFromToken("token");

        assertThat(role).isEqualTo("ADMIN");
    }

    @Test
    @DisplayName("extractRoleFromToken - exception → null")
    void extractRoleFromToken_Exception_ShouldReturnNull() {
        when(jwtService.extractClaim(anyString(), any())).thenThrow(new RuntimeException());

        assertThat(authService.extractRoleFromToken("bad-token")).isNull();
    }
}
