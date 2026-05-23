package com.declitech.user.controller;

import com.declitech.user.dto.InternalUserDTO;
import com.declitech.user.dto.UserModulesDTO;
import com.declitech.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class InternalUserController {

    private final UserService userService;

    @GetMapping("/username/{username}")
    public ResponseEntity<InternalUserDTO> findByUsername(@PathVariable String username) {
        return ResponseEntity.ok(userService.findInternalByUsername(username));
    }

    @GetMapping("/email/{email}")
    public ResponseEntity<InternalUserDTO> findByEmail(@PathVariable String email) {
        return ResponseEntity.ok(userService.findInternalByEmail(email));
    }

    @GetMapping("/internal/{id}")
    public ResponseEntity<InternalUserDTO> findInternalById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.findInternalById(id));
    }

    @GetMapping("/internal/{id}/modules")
    public ResponseEntity<UserModulesDTO> findUserModules(@PathVariable Long id) {
        return ResponseEntity.ok(userService.findUserModules(id));
    }
}
