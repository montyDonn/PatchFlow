package com.patchflow.config;

import com.patchflow.entity.User;
import com.patchflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        if (!userRepository.existsByUsername("admin")) {
            User admin = User.builder()
                    .username("admin")
                    .passwordHash(passwordEncoder.encode("admin123"))
                    .salt("BCrypt")
                    .role("SUPER_ADMIN")
                    .name("System Admin")
                    .isActive(true)
                    .build();
            userRepository.save(admin);
            System.out.println("Created default admin user (admin / admin123)");
        }
    }
}
