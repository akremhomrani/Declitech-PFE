package com.declitech.auth.security;

import com.declitech.auth.client.UserServiceClient;
import com.declitech.auth.dto.UserDto;
import com.declitech.auth.exception.UserInactiveException;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserServiceClient userServiceClient;

    @Override
    public UserDetails loadUserByUsername(String usernameOrEmail) throws UsernameNotFoundException {
        if (usernameOrEmail == null || usernameOrEmail.trim().isEmpty()) {
            throw new UsernameNotFoundException("Username or email cannot be null or empty");
        }

        UserDto user = null;
        
        try {
            if (!usernameOrEmail.contains("@")) {
                user = userServiceClient.getUserByUsername(usernameOrEmail);
            } else {
                user = userServiceClient.getUserByEmail(usernameOrEmail);
            }
        } catch (FeignException.NotFound e) {
            throw new UsernameNotFoundException("User not found with username or email: " + usernameOrEmail);
        } catch (FeignException.ServiceUnavailable e) {
            throw new UsernameNotFoundException("User service is unavailable for user: " + usernameOrEmail);
        } catch (FeignException e) {
            throw new UsernameNotFoundException("Error communicating with user service for user: " + usernameOrEmail + ". Status: " + e.status());
        } catch (Exception e) {
            throw new UsernameNotFoundException("Error loading user: " + usernameOrEmail + ". Error: " + e.getMessage());
        }

        if (user == null) {
            throw new UsernameNotFoundException("User not found with username or email: " + usernameOrEmail);
        }

        if (user.getActive() == null || !user.getActive()) {
            throw new UserInactiveException("User account is inactive: " + usernameOrEmail);
        }

        if (user.getPassword() == null || user.getPassword().trim().isEmpty()) {
            throw new UsernameNotFoundException("User password is not available for: " + usernameOrEmail);
        }

        if (user.getRole() == null || user.getRole().trim().isEmpty()) {
            throw new UsernameNotFoundException("User role is not available for: " + usernameOrEmail);
        }

        return User.builder()
                .username(user.getUsername())
                .password(user.getPassword())
                .authorities(Collections.singletonList(
                        new SimpleGrantedAuthority("ROLE_" + user.getRole())
                ))
                .accountExpired(false)
                .accountLocked(false)
                .credentialsExpired(false)
                .disabled(!user.getActive())
                .build();
    }
}
