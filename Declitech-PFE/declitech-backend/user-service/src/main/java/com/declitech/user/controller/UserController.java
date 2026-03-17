package com.declitech.user.controller;

import com.declitech.user.dto.CreateUserRequest;
import com.declitech.user.dto.PagedUserResponse;
import com.declitech.user.dto.UpdateUserRequest;
import com.declitech.user.dto.UserFilterRequest;
import com.declitech.user.dto.UserResponse;
import com.declitech.user.enums.Role;
import com.declitech.user.enums.Sexe;
import com.declitech.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse response = userService.createUser(request);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable Long id) {
        UserResponse response = userService.getUserById(id);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/username/{username}")
    public ResponseEntity<UserResponse> getUserByUsername(@PathVariable String username) {
        UserResponse response = userService.getUserByUsername(username);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/email/{email}")
    public ResponseEntity<UserResponse> getUserByEmail(@PathVariable String email) {
        UserResponse response = userService.getUserByEmail(email);
        return ResponseEntity.ok(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<List<UserResponse>> getAllUsers(
            @RequestParam(name = "includeInactive", defaultValue = "false") boolean includeInactive) {
        List<UserResponse> response;
        if (includeInactive) {
            response = userService.getAllUsersIncludingInactive();
        } else {
            response = userService.getAllUsers();
        }
        return ResponseEntity.ok(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/paginated")
    public ResponseEntity<PagedUserResponse> getUsersPaginated(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "sortBy", defaultValue = "id") String sortBy,
            @RequestParam(name = "sortDirection", defaultValue = "ASC") String sortDirection,
            @RequestParam(name = "firstName", required = false) String firstName,
            @RequestParam(name = "lastName", required = false) String lastName,
            @RequestParam(name = "username", required = false) String username,
            @RequestParam(name = "email", required = false) String email,
            @RequestParam(name = "phoneNumber", required = false) String phoneNumber,
            @RequestParam(name = "sexe", required = false) Sexe sexe,
            @RequestParam(name = "role", required = false) Role role,
            @RequestParam(name = "active", required = false) Boolean active,
            @RequestParam(name = "search", required = false) String search) {
        
        UserFilterRequest filter = UserFilterRequest.builder()
                .firstName(firstName)
                .lastName(lastName)
                .username(username)
                .email(email)
                .phoneNumber(phoneNumber)
                .sexe(sexe)
                .role(role)
                .active(active)
                .search(search)
                .build();

        PagedUserResponse response = userService.getUsersWithPagination(
                filter, page, size, sortBy, sortDirection);
        
        return ResponseEntity.ok(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        UserResponse response = userService.updateUser(id, request);
        return ResponseEntity.ok(response);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/reactivate")
    public ResponseEntity<UserResponse> reactivateUser(@PathVariable Long id) {
        UserResponse response = userService.reactivateUser(id);
        return ResponseEntity.ok(response);
    }
}
