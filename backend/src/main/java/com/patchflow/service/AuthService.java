package com.patchflow.service;

import com.patchflow.entity.Session;
import com.patchflow.entity.User;
import com.patchflow.filter.AuthTokenFilter;
import com.patchflow.repository.SessionRepository;
import com.patchflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    @Transactional
    public Map<String, Object> login(String username, String password) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        // Clean expired sessions
        sessionRepository.deleteExpiredByUserId(user.getUserId(), Instant.now());

        return createSession(user);
    }

    @Transactional
    public Map<String, Object> register(String username, String password, String name, String role) {
        if (userRepository.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User already exists");
        }

        String hash = passwordEncoder.encode(password);

        User user = User.builder()
                .username(username)
                .passwordHash(hash)
                .name(name)
                .role(role != null ? role : "DEVELOPER")
                .isActive(true)
                .build();
        user = userRepository.save(user);
        return createSession(user);
    }

    private Map<String, Object> createSession(User user) {
        // Generate 32-byte random token
        byte[] tokenBytes = new byte[32];
        new SecureRandom().nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        String tokenHash = AuthTokenFilter.sha256(token);

        Instant expiresAt = Instant.now().plus(7, ChronoUnit.DAYS);

        Session session = Session.builder()
                .userId(user.getUserId())
                .tokenHash(tokenHash)
                .expiresAt(expiresAt)
                .build();
        sessionRepository.save(session);

        Map<String, Object> userMap = new HashMap<>();
        userMap.put("userId", user.getUserId());
        userMap.put("username", user.getUsername());
        userMap.put("name", user.getName());
        userMap.put("role", user.getRole());
        userMap.put("designation", user.getDesignation());
        userMap.put("email", user.getEmail());
        userMap.put("phone", user.getPhone());

        Map<String, Object> result = new HashMap<>();
        result.put("user", userMap);
        result.put("token", token);
        return result;
    }

    @Transactional
    public void logout(String token) {
        String tokenHash = AuthTokenFilter.sha256(token);
        sessionRepository.deleteByTokenHash(tokenHash);
    }
}
