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
        createDefaultInstructor();
        createAdminUser();
        createSecondAdminUser();
    }

    // =========================
    // DEFAULT INSTRUCTOR
    // =========================
    private void createDefaultInstructor() {
        String email = "eya@gmail.com";

        if (userRepository.findByEmail(email).isPresent()) {
            return;
        }

        User user = User.builder()
                .firstName("Eya")
                .lastName("Ben Attig")
                .username("eya")
                .email(email)
                .password(passwordEncoder.encode("eya123"))
                .sexe(Sexe.FEMALE)
                .phoneNumber("+21600000000")
                .role(Role.INSTRUCTOR)
                .active(true)
                .build();

        userRepository.save(user);
    }

    // =========================
    // ADMIN 1
    // =========================
    private void createAdminUser() {
        String email = "admin@declitech.com";

        if (userRepository.findByEmail(email).isPresent()) {
            return;
        }

        User admin = User.builder()
                .firstName("Akrem")
                .lastName("Admin")
                .username("admin")
                .email(email)
                .password(passwordEncoder.encode("akrem123"))
                .sexe(Sexe.MALE)
                .phoneNumber("+21600000001")
                .role(Role.ADMIN)
                .active(true)
                .build();

        userRepository.save(admin);
    }

    // =========================
    // ADMIN 2
    // =========================
    private void createSecondAdminUser() {
        String email = "admin2@declitech.com";

        if (userRepository.findByEmail(email).isPresent()) {
            return;
        }

        User admin = User.builder()
                .firstName("Sami")
                .lastName("SuperAdmin")
                .username("admin2")
                .email(email)
                .password(passwordEncoder.encode("sami123"))
                .sexe(Sexe.MALE)
                .phoneNumber("+21600000002")
                .role(Role.ADMIN)
                .active(true)
                .build();

        userRepository.save(admin);
    }
}