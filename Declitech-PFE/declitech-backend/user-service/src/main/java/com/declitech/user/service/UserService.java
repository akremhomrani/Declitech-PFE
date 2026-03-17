package com.declitech.user.service;

import com.declitech.user.dto.CreateUserRequest;
import com.declitech.user.dto.PagedUserResponse;
import com.declitech.user.dto.UpdateUserRequest;
import com.declitech.user.dto.UserFilterRequest;
import com.declitech.user.dto.UserResponse;
import com.declitech.user.enums.Role;
import com.declitech.user.exception.*;
import com.declitech.user.model.User;
import com.declitech.user.repository.UserRepository;
import com.declitech.user.repository.UserSpecification;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private static final Pattern EMAIL_PATTERN = 
        Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    
    private static final Pattern PHONE_PATTERN = 
        Pattern.compile("^[+]?[(]?[0-9]{1,4}[)]?[-\\s.]?[(]?[0-9]{1,4}[)]?[-\\s.]?[0-9]{1,9}$");

    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        validateCreateUserRequest(request);
        validateEmail(request.getEmail());
        validatePhoneNumber(request.getPhoneNumber());

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new UserAlreadyExistsException("email", request.getEmail());
        }

        String username = generateUsernameFromEmail(request.getEmail());

        if (userRepository.existsByUsername(username)) {
            username = makeUsernameUnique(username);
        }

        String generatedPassword = generateRandomPassword();

        User user = User.builder()
                .firstName(request.getFirstName().trim())
                .lastName(request.getLastName().trim())
                .username(username)
                .email(request.getEmail().trim().toLowerCase())
                .password(passwordEncoder.encode(generatedPassword))
                .sexe(request.getSexe())
                .phoneNumber(request.getPhoneNumber().trim())
                .role(Role.INSTRUCTOR)
                .active(true)
                .build();

        User savedUser = userRepository.save(user);
        return mapToResponse(savedUser);
    }

    @Transactional(readOnly = true)
    public UserResponse getUserById(Long userId) {
        if (userId == null || userId <= 0) {
            throw new InvalidUserDataException("User ID", "must be a positive number");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        return mapToResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse getUserByUsername(String username) {

        if (username == null || username.trim().isEmpty()) {
            throw new InvalidUserDataException("Username", "cannot be empty");
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UserNotFoundException("User not found with username: " + username));

        return mapToResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse getUserByEmail(String email) {

        if (email == null || email.trim().isEmpty()) {
            throw new InvalidUserDataException("Email", "cannot be empty");
        }

        User user = userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new UserNotFoundException("User not found with email: " + email));

        return mapToResponse(user);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {
        List<User> users = userRepository.findByActiveTrue();
        return users.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsersIncludingInactive() {
        List<User> users = userRepository.findAll();
        return users.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PagedUserResponse getUsersWithPagination(
            UserFilterRequest filter,
            int page,
            int size,
            String sortBy,
            String sortDirection) {
        
        if (page < 0) {
            page = 0;
        }
        if (size <= 0 || size > 100) {
            size = 10;
        }

        Sort sort = Sort.by(Sort.Direction.fromString(sortDirection.toUpperCase()), sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);
        Specification<User> spec = UserSpecification.filterBy(filter != null ? filter : new UserFilterRequest());
        Page<User> userPage = userRepository.findAll(spec, pageable);

        List<UserResponse> userResponses = userPage.getContent().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());

        return PagedUserResponse.builder()
                .users(userResponses)
                .currentPage(userPage.getNumber())
                .totalPages(userPage.getTotalPages())
                .totalElements(userPage.getTotalElements())
                .pageSize(userPage.getSize())
                .hasNext(userPage.hasNext())
                .hasPrevious(userPage.hasPrevious())
                .build();
    }

    @Transactional
    public UserResponse updateUser(Long userId, UpdateUserRequest request) {

        if (userId == null || userId <= 0) {
            throw new InvalidUserDataException("User ID", "must be a positive number");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        if (request.getFirstName() != null && !request.getFirstName().trim().isEmpty()) {
            validateFieldNotEmpty(request.getFirstName(), "First name");
            user.setFirstName(request.getFirstName().trim());
        }

        if (request.getLastName() != null && !request.getLastName().trim().isEmpty()) {
            validateFieldNotEmpty(request.getLastName(), "Last name");
            user.setLastName(request.getLastName().trim());
        }

        if (request.getUsername() != null && !request.getUsername().trim().isEmpty()) {
            validateFieldNotEmpty(request.getUsername(), "Username");
            String newUsername = request.getUsername().trim();
            if (!user.getUsername().equals(newUsername)) {
                if (userRepository.existsByUsername(newUsername)) {
                    throw new UserAlreadyExistsException("username", newUsername);
                }
                user.setUsername(newUsername);
            }
        }

        if (request.getEmail() != null && !request.getEmail().trim().isEmpty()) {
            validateFieldNotEmpty(request.getEmail(), "Email");
            validateEmail(request.getEmail());
            String newEmail = request.getEmail().trim().toLowerCase();
            if (!user.getEmail().equals(newEmail)) {
                if (userRepository.existsByEmail(newEmail)) {
                    throw new UserAlreadyExistsException("email", newEmail);
                }
                user.setEmail(newEmail);
            }
        }

        if (request.getPassword() != null && !request.getPassword().trim().isEmpty()) {
            if (request.getPassword().length() < 6) {
                throw new InvalidUserDataException("Password", "must be at least 6 characters");
            }
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        if (request.getSexe() != null) {
            user.setSexe(request.getSexe());
        }

        if (request.getPhoneNumber() != null && !request.getPhoneNumber().trim().isEmpty()) {
            validateFieldNotEmpty(request.getPhoneNumber(), "Phone number");
            validatePhoneNumber(request.getPhoneNumber());
            user.setPhoneNumber(request.getPhoneNumber().trim());
        }

        if (request.getRole() != null) {
            user.setRole(request.getRole());
        }

        if (request.getActive() != null) {
            user.setActive(request.getActive());
        }

        User updatedUser = userRepository.save(user);
        return mapToResponse(updatedUser);
    }

    @Transactional
    public void deleteUser(Long userId) {

        if (userId == null || userId <= 0) {
            throw new InvalidUserDataException("User ID", "must be a positive number");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        if (!user.getActive()) {
            throw new UserInactiveException("User is already inactive with ID: " + userId);
        }

        user.setActive(false);
        userRepository.save(user);
    }

    @Transactional
    public UserResponse reactivateUser(Long userId) {

        if (userId == null || userId <= 0) {
            throw new InvalidUserDataException("User ID", "must be a positive number");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        if (user.getActive()) {
            throw new InvalidUserDataException("User", "is already active");
        }

        user.setActive(true);
        User reactivatedUser = userRepository.save(user);
        return mapToResponse(reactivatedUser);
    }

    private void validateCreateUserRequest(CreateUserRequest request) {
        validateFieldNotEmpty(request.getFirstName(), "First name");
        validateFieldNotEmpty(request.getLastName(), "Last name");
        validateFieldNotEmpty(request.getEmail(), "Email");
        validateFieldNotEmpty(request.getPhoneNumber(), "Phone number");

        if (request.getSexe() == null) {
            throw new EmptyFieldException("Sexe");
        }
    }

    private void validateFieldNotEmpty(String value, String fieldName) {
        if (value == null || value.trim().isEmpty()) {
            throw new EmptyFieldException(fieldName);
        }
    }

    private void validateEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            throw new EmptyFieldException("Email");
        }
        if (!EMAIL_PATTERN.matcher(email.trim()).matches()) {
            throw new InvalidEmailFormatException(email);
        }
    }

    private void validatePhoneNumber(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
            throw new EmptyFieldException("Phone number");
        }
        if (!PHONE_PATTERN.matcher(phoneNumber.trim()).matches()) {
            throw new InvalidPhoneNumberException(phoneNumber);
        }
    }

    private String generateUsernameFromEmail(String email) {
        String username = email.split("@")[0].toLowerCase();
        username = username.replaceAll("[^a-z0-9._]", "");
        return username;
    }

    private String makeUsernameUnique(String username) {
        return username + "_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String generateRandomPassword() {
        return "akrem123";
    }

    private UserResponse mapToResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .username(user.getUsername())
                .email(user.getEmail())
                .password(user.getPassword())
                .sexe(user.getSexe())
                .phoneNumber(user.getPhoneNumber())
                .role(user.getRole())
                .active(user.getActive())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
