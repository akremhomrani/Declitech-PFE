package com.declitech.user.config;

import com.declitech.user.enums.Role;
import com.declitech.user.enums.Sexe;
import com.declitech.user.model.User;
import com.declitech.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        createDefaultUser();
        createAdminUser();
    }

    private void createDefaultUser() {
        String defaultEmail = "eya@gmail.com";
        
        if (userRepository.findByEmail(defaultEmail).isPresent()) {
            return;
        }

        User defaultUser = User.builder()
                .firstName("Eya")
                .lastName("Ben Attig")
                .username("eya")
                .email(defaultEmail)
                .password(passwordEncoder.encode("eya123"))
                .sexe(Sexe.FEMALE)
                .phoneNumber("+216 00 000 000")
                .role(Role.INSTRUCTOR)
                .active(true)
                .build();

        userRepository.save(defaultUser);
    }

    private void createAdminUser() {
        String adminEmail = "admin@declitech.com";

        if (userRepository.findByEmail(adminEmail).isPresent()) {
            return;
        }

        User adminUser = User.builder()
                .firstName("Akrem")
                .lastName("Admin")
                .username("admin")
                .email(adminEmail)
                .password(passwordEncoder.encode("akrem123"))
                .sexe(Sexe.MALE)
                .phoneNumber("+216 00 000 001")
                .role(Role.ADMIN)
                .active(true)
                .build();

        userRepository.save(adminUser);
    }
}
