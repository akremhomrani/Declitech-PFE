package com.declitech.user.config;

import com.declitech.user.model.User;
import com.declitech.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

@Configuration
@RequiredArgsConstructor
public class AdminSeeder {

    @Value("${admin.username}") private String adminUsername;
    @Value("${admin.email}") private String adminEmail;
    @Value("${admin.password}") private String adminPassword;
    @Value("${admin.firstName}") private String adminFirstName;
    @Value("${admin.lastName}") private String adminLastName;

    @Bean
    public ApplicationRunner seedAdmin(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.existsByRole("ADMIN")) return;
            User admin = User.builder()
                    .username(adminUsername)
                    .email(adminEmail)
                    .passwordHash(passwordEncoder.encode(adminPassword))
                    .firstName(adminFirstName)
                    .lastName(adminLastName)
                    .role("ADMIN")
                    .status("ACTIVE")
                    .moduleAssignments(new java.util.ArrayList<>())
                    .build();
            userRepository.save(admin);
        };
    }
}
