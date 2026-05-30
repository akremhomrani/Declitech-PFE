package com.declitech.user.service;

import com.declitech.user.dto.*;
import com.declitech.user.exception.ResourceNotFoundException;
import com.declitech.user.exception.ConflictException;
import com.declitech.user.mapper.UserMapper;
import com.declitech.user.model.ModuleAssignment;
import com.declitech.user.model.User;
import com.declitech.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public UserDTO create(CreateUserRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new ConflictException("Username already taken");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ConflictException("Email already taken");
        }
        validateAssignmentsAvailable(request.getModuleAssignments(), null);
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .phoneNumber(request.getPhoneNumber())
                .role(request.getRole())
                .status("ACTIVE")
                .moduleAssignments(toAssignments(request.getModuleAssignments()))
                .build();
        return userMapper.toDTO(userRepository.save(user));
    }

    private void validateAssignmentsAvailable(List<ModuleAssignmentDTO> requested, Long excludeUserId) {
        if (requested == null) return;
        for (ModuleAssignmentDTO a : requested) {
            userRepository.findOwnerOfModuleSite(a.getModuleId(), a.getSiteName()).ifPresent(owner -> {
                if (excludeUserId == null || !owner.getId().equals(excludeUserId)) {
                    throw new ConflictException(
                            "Module " + a.getModuleId() + " site '" + a.getSiteName()
                                    + "' is already assigned to @" + owner.getUsername());
                }
            });
        }
    }

    private List<ModuleAssignment> toAssignments(List<ModuleAssignmentDTO> dtos) {
        if (dtos == null) return new java.util.ArrayList<>();
        return new java.util.ArrayList<>(dtos.stream()
                .map(d -> new ModuleAssignment(d.getModuleId(), d.getSiteName()))
                .toList());
    }

    @Transactional(readOnly = true)
    public Page<UserDTO> findAll(Pageable pageable) {
        Pageable effective = pageable.getSort().isUnsorted()
                ? PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(Sort.Direction.DESC, "createdAt"))
                : pageable;
        return userRepository.findAll(effective).map(userMapper::toDTO);
    }

    @Transactional(readOnly = true)
    public UserDTO findById(Long id) {
        return userMapper.toDTO(getUserOrThrow(id));
    }

    @Transactional(readOnly = true)
    public UserDTO findByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));
        return userMapper.toDTO(user);
    }

    @Transactional(readOnly = true)
    public InternalUserDTO findInternalByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));
        return userMapper.toInternalDTO(user);
    }

    @Transactional(readOnly = true)
    public InternalUserDTO findInternalByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + email));
        return userMapper.toInternalDTO(user);
    }

    @Transactional(readOnly = true)
    public InternalUserDTO findInternalById(Long id) {
        return userMapper.toInternalDTO(getUserOrThrow(id));
    }

    @Transactional(readOnly = true)
    public UserModulesDTO findUserModules(Long id) {
        User user = getUserOrThrow(id);
        return UserModulesDTO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .moduleIds(user.getModuleIds())
                .build();
    }

    @Transactional
    public UserDTO update(Long id, UpdateUserRequest request) {
        User user = getUserOrThrow(id);
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new ConflictException("Email already taken");
            }
            user.setEmail(request.getEmail());
        }
        if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
        if (request.getLastName() != null) user.setLastName(request.getLastName());
        if (request.getPhoneNumber() != null) user.setPhoneNumber(request.getPhoneNumber());
        if (request.getRole() != null) user.setRole(request.getRole());
        if (request.getStatus() != null) user.setStatus(request.getStatus());
        if (request.getModuleAssignments() != null) {
            validateAssignmentsAvailable(request.getModuleAssignments(), id);
            user.getModuleAssignments().clear();
            user.getModuleAssignments().addAll(toAssignments(request.getModuleAssignments()));
        }
        return userMapper.toDTO(userRepository.save(user));
    }

    @Transactional
    public void delete(Long id) {
        User user = getUserOrThrow(id);
        userRepository.delete(user);
    }

    @Transactional
    public void changePassword(Long id, ChangePasswordRequest request) {
        User user = getUserOrThrow(id);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        userRepository.save(user);
    }

    private User getUserOrThrow(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
    }
}
