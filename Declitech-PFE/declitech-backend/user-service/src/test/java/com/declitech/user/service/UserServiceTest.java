package com.declitech.user.service;

import com.declitech.user.dto.CreateUserRequest;
import com.declitech.user.dto.UpdateUserRequest;
import com.declitech.user.dto.UserResponse;
import com.declitech.user.enums.Role;
import com.declitech.user.enums.Sexe;
import com.declitech.user.exception.*;
import com.declitech.user.model.User;
import com.declitech.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("Tests unitaires — UserService")
class UserServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    private User activeUser;
    private User inactiveUser;

    @BeforeEach
    void setUp() {
        activeUser = User.builder()
                .id(1L).firstName("Eya").lastName("Ben Ali")
                .username("eya.benali").email("eya@declitech.com")
                .password("encoded-pass").sexe(Sexe.FEMALE)
                .phoneNumber("+21612345678").role(Role.INSTRUCTOR)
                .active(true).build();

        inactiveUser = User.builder()
                .id(2L).firstName("Test").lastName("Inactif")
                .username("test.inactif").email("inactif@declitech.com")
                .password("encoded-pass").sexe(Sexe.MALE)
                .phoneNumber("+21699999999").role(Role.INSTRUCTOR)
                .active(false).build();
    }

    // =========================================================
    //  getUserById()
    // =========================================================

    @Test
    @DisplayName("getUserById - ID valide et user existant → UserResponse")
    void getUserById_ValidIdAndExists_ShouldReturnUserResponse() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(activeUser));

        UserResponse response = userService.getUserById(1L);

        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo(1L);
        assertThat(response.getUsername()).isEqualTo("eya.benali");
        assertThat(response.getEmail()).isEqualTo("eya@declitech.com");
        assertThat(response.getActive()).isTrue();
    }

    @Test
    @DisplayName("getUserById - ID null → InvalidUserDataException")
    void getUserById_NullId_ShouldThrowInvalidUserDataException() {
        assertThatThrownBy(() -> userService.getUserById(null))
                .isInstanceOf(InvalidUserDataException.class);
    }

    @Test
    @DisplayName("getUserById - ID négatif → InvalidUserDataException")
    void getUserById_NegativeId_ShouldThrowInvalidUserDataException() {
        assertThatThrownBy(() -> userService.getUserById(-5L))
                .isInstanceOf(InvalidUserDataException.class);
    }

    @Test
    @DisplayName("getUserById - user inexistant → UserNotFoundException")
    void getUserById_UserNotFound_ShouldThrowUserNotFoundException() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUserById(99L))
                .isInstanceOf(UserNotFoundException.class);
    }

    // =========================================================
    //  getUserByUsername()
    // =========================================================

    @Test
    @DisplayName("getUserByUsername - username valide → UserResponse")
    void getUserByUsername_Exists_ShouldReturnUserResponse() {
        when(userRepository.findByUsername("eya.benali")).thenReturn(Optional.of(activeUser));

        UserResponse response = userService.getUserByUsername("eya.benali");

        assertThat(response.getUsername()).isEqualTo("eya.benali");
    }

    @Test
    @DisplayName("getUserByUsername - username null → InvalidUserDataException")
    void getUserByUsername_NullInput_ShouldThrowException() {
        assertThatThrownBy(() -> userService.getUserByUsername(null))
                .isInstanceOf(InvalidUserDataException.class);
    }

    @Test
    @DisplayName("getUserByUsername - username introuvable → UserNotFoundException")
    void getUserByUsername_NotFound_ShouldThrowUserNotFoundException() {
        when(userRepository.findByUsername("unknown")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUserByUsername("unknown"))
                .isInstanceOf(UserNotFoundException.class);
    }

    // =========================================================
    //  createUser()
    // =========================================================

    @Test
    @DisplayName("createUser - données valides → UserResponse créé")
    void createUser_ValidData_ShouldReturnCreatedUser() {
        CreateUserRequest request = new CreateUserRequest();
        request.setFirstName("Sami");
        request.setLastName("Trabelsi");
        request.setEmail("sami.trabelsi@test.com");
        request.setPhoneNumber("+21612345679");
        request.setSexe(Sexe.MALE);

        when(userRepository.existsByEmail("sami.trabelsi@test.com")).thenReturn(false);
        when(userRepository.existsByUsername("sami.trabelsi")).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenReturn(activeUser);

        UserResponse response = userService.createUser(request);

        assertThat(response).isNotNull();
        verify(userRepository).save(any(User.class));
    }

    @Test
    @DisplayName("createUser - email déjà existant → UserAlreadyExistsException")
    void createUser_DuplicateEmail_ShouldThrowUserAlreadyExistsException() {
        CreateUserRequest request = new CreateUserRequest();
        request.setFirstName("Test");
        request.setLastName("Dup");
        request.setEmail("eya@declitech.com");
        request.setPhoneNumber("+21612345679");
        request.setSexe(Sexe.FEMALE);

        when(userRepository.existsByEmail("eya@declitech.com")).thenReturn(true);

        assertThatThrownBy(() -> userService.createUser(request))
                .isInstanceOf(UserAlreadyExistsException.class);
    }

    @Test
    @DisplayName("createUser - email format invalide → InvalidEmailFormatException")
    void createUser_InvalidEmailFormat_ShouldThrowInvalidEmailFormatException() {
        CreateUserRequest request = new CreateUserRequest();
        request.setFirstName("Test");
        request.setLastName("User");
        request.setEmail("not-an-email");
        request.setPhoneNumber("+21612345679");
        request.setSexe(Sexe.MALE);

        assertThatThrownBy(() -> userService.createUser(request))
                .isInstanceOf(InvalidEmailFormatException.class);
    }

    @Test
    @DisplayName("createUser - prénom vide → EmptyFieldException")
    void createUser_EmptyFirstName_ShouldThrowEmptyFieldException() {
        CreateUserRequest request = new CreateUserRequest();
        request.setFirstName("");
        request.setLastName("Nom");
        request.setEmail("email@test.com");
        request.setPhoneNumber("+21612345679");
        request.setSexe(Sexe.MALE);

        assertThatThrownBy(() -> userService.createUser(request))
                .isInstanceOf(EmptyFieldException.class);
    }

    // =========================================================
    //  deleteUser()  (soft delete)
    // =========================================================

    @Test
    @DisplayName("deleteUser - user actif → désactivé (active = false)")
    void deleteUser_ActiveUser_ShouldDeactivateUser() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(activeUser));
        when(userRepository.save(any(User.class))).thenReturn(activeUser);

        userService.deleteUser(1L);

        assertThat(activeUser.getActive()).isFalse();
        verify(userRepository).save(activeUser);
    }

    @Test
    @DisplayName("deleteUser - user déjà inactif → UserInactiveException")
    void deleteUser_AlreadyInactiveUser_ShouldThrowException() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(inactiveUser));

        assertThatThrownBy(() -> userService.deleteUser(2L))
                .isInstanceOf(UserInactiveException.class);
    }

    @Test
    @DisplayName("deleteUser - ID invalide → InvalidUserDataException")
    void deleteUser_InvalidId_ShouldThrowInvalidUserDataException() {
        assertThatThrownBy(() -> userService.deleteUser(0L))
                .isInstanceOf(InvalidUserDataException.class);
    }

    // =========================================================
    //  reactivateUser()
    // =========================================================

    @Test
    @DisplayName("reactivateUser - user inactif → réactivé (active = true)")
    void reactivateUser_InactiveUser_ShouldReactivate() {
        when(userRepository.findById(2L)).thenReturn(Optional.of(inactiveUser));
        when(userRepository.save(any(User.class))).thenReturn(inactiveUser);

        UserResponse response = userService.reactivateUser(2L);

        assertThat(inactiveUser.getActive()).isTrue();
        verify(userRepository).save(inactiveUser);
    }

    @Test
    @DisplayName("reactivateUser - user déjà actif → InvalidUserDataException")
    void reactivateUser_AlreadyActiveUser_ShouldThrowException() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(activeUser));

        assertThatThrownBy(() -> userService.reactivateUser(1L))
                .isInstanceOf(InvalidUserDataException.class)
                .hasMessageContaining("already active");
    }

    // =========================================================
    //  getAllUsers()
    // =========================================================

    @Test
    @DisplayName("getAllUsers - retourne uniquement les users actifs")
    void getAllUsers_ShouldReturnOnlyActiveUsers() {
        when(userRepository.findByActiveTrue()).thenReturn(List.of(activeUser));

        List<UserResponse> result = userService.getAllUsers();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getActive()).isTrue();
    }
}
