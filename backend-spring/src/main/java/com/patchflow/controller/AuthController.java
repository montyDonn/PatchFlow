package com.patchflow.controller;

import com.patchflow.config.Auth;
import com.patchflow.entity.User;
import com.patchflow.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");
        if (username == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username and password are required"));
        }
        try {
            return ResponseEntity.ok(authService.login(username, password));
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body, HttpServletRequest req) {
        Auth.requireRole(req, "SUPER_ADMIN", "ADMIN");
        String username = body.get("username");
        String password = body.get("password");
        String name     = body.get("name");
        String role     = body.get("role");
        if (username == null || password == null || name == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Username, password, and name are required"));
        }
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(username, password, name, role));
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpServletRequest req) {
        User user = Auth.require(req);
        return ResponseEntity.ok(Map.of("user", Map.of(
                "userId", user.getUserId(), "username", user.getUsername(), "role", user.getRole())));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest req) {
        Auth.require(req);
        String authHeader = req.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            authService.logout(authHeader.substring(7));
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Logged out successfully"));
    }
}
