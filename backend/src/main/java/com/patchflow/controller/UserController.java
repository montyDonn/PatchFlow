package com.patchflow.controller;

import com.patchflow.config.Auth;
import com.patchflow.entity.AppModule;
import com.patchflow.entity.AuditLog;
import com.patchflow.entity.User;
import com.patchflow.entity.UserManager;
import com.patchflow.repository.AppModuleRepository;
import com.patchflow.repository.AuditLogRepository;
import com.patchflow.repository.SessionRepository;
import com.patchflow.repository.UserManagerRepository;
import com.patchflow.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final UserManagerRepository userManagerRepository;
    private final AppModuleRepository moduleRepository;
    private final AuditLogRepository auditLogRepository;
    private final SessionRepository sessionRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    private Map<String, Object> serializeUser(User u, boolean includeModules) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getUserId()); m.put("userId", u.getUserId());
        m.put("username", u.getUsername()); m.put("name", u.getName());
        m.put("role", u.getRole()); m.put("designation", u.getDesignation());
        m.put("email", u.getEmail()); m.put("phone", u.getPhone());
        m.put("isActive", u.isActive());
        if (includeModules) {
            m.put("modules", u.getModules().stream().map(mod -> Map.of("id", mod.getModuleId(), "name", mod.getModuleName())).collect(Collectors.toList()));
        }
        return m;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> getUsers(
            @RequestParam(required = false) String role,
            @RequestParam(defaultValue = "false") boolean includeModules,
            @RequestParam(defaultValue = "false") boolean includeInactive,
            HttpServletRequest req) {
        Auth.require(req);
        List<User> users;
        if (includeInactive) {
            users = role != null ? userRepository.findAll().stream().filter(u -> role.equals(u.getRole())).collect(Collectors.toList())
                    : userRepository.findAllByOrderByNameAsc();
        } else {
            users = role != null ? userRepository.findByRoleAndIsActiveTrueOrderByNameAsc(role)
                    : userRepository.findByIsActiveTrueOrderByNameAsc();
        }
        return ResponseEntity.ok(users.stream().map(u -> serializeUser(u, includeModules)).collect(Collectors.toList()));
    }

    @GetMapping("/{userId}/modules")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getUserModules(@PathVariable String userId, HttpServletRequest req) {
        Auth.require(req);
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(user.getModules().stream().map(m ->
                Map.of("id", userId + "-" + m.getModuleId(), "module", Map.of("id", m.getModuleId(), "name", m.getModuleName()))
        ).collect(Collectors.toList()));
    }

    @PutMapping("/{userId}/modules")
    @Transactional
    public ResponseEntity<?> updateUserModules(@PathVariable String userId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        User caller = Auth.require(req);
        String callerRole = caller.getRole();
        if (!"SUPER_ADMIN".equals(callerRole) && !"MANAGER".equals(callerRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Forbidden"));
        }
        @SuppressWarnings("unchecked") List<String> moduleIds = (List<String>) body.get("moduleIds");
        if (moduleIds == null || moduleIds.size() > 5) {
            return ResponseEntity.badRequest().body(Map.of("error", "A user can be assigned to a maximum of 5 modules."));
        }
        User user = userRepository.findById(userId).orElseThrow();
        List<AppModule> modules = moduleRepository.findAllById(moduleIds);
        user.setModules(new ArrayList<>(modules));
        userRepository.save(user);
        auditLogRepository.save(AuditLog.builder()
                .changedBy(caller.getUserId()).targetUserId(userId)
                .fieldChanged("modules").newValue(String.join(",", moduleIds))
                .reason(body.getOrDefault("reason", "Admin updated user modules").toString()).build());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PutMapping("/{userId}/managers")
    @Transactional
    public ResponseEntity<?> updateUserManagers(@PathVariable String userId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        User caller = Auth.requireRole(req, "SUPER_ADMIN");
        @SuppressWarnings("unchecked") List<String> managerIds = (List<String>) body.get("managerIds");
        if (managerIds == null || managerIds.size() > 3) {
            return ResponseEntity.badRequest().body(Map.of("error", "A user can be assigned to a maximum of 3 managers."));
        }
        userManagerRepository.deleteByUserId(userId);
        for (String mid : managerIds) {
            UserManager um = userManagerRepository.findByUserIdAndManagerId(userId, mid).orElse(null);
            if (um != null) {
                um.setActive(true);
                userManagerRepository.save(um);
            } else {
                userManagerRepository.save(UserManager.builder().userId(userId).managerId(mid).isActive(true).build());
            }
        }
        auditLogRepository.save(AuditLog.builder()
                .changedBy(caller.getUserId()).targetUserId(userId)
                .fieldChanged("managers").newValue(String.join(",", managerIds))
                .reason(body.getOrDefault("reason", "Admin updated user managers").toString()).build());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/{userId}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable String userId, HttpServletRequest req) {
        User caller = Auth.requireRole(req, "SUPER_ADMIN");
        // Generate 16-byte hex temp password
        byte[] bytes = new byte[8];
        new SecureRandom().nextBytes(bytes);
        String tempPassword = HexFormat.of().formatHex(bytes);
        String hash = passwordEncoder.encode(tempPassword);
        User user = userRepository.findById(userId).orElseThrow();
        user.setPasswordHash(hash);
        userRepository.save(user);
        sessionRepository.deleteAllByUserId(userId);
        auditLogRepository.save(AuditLog.builder()
                .changedBy(caller.getUserId()).targetUserId(userId)
                .fieldChanged("password").reason("Admin reset user password").build());
        return ResponseEntity.ok(Map.of("success", true, "tempPassword", tempPassword));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<?> deactivateUser(@PathVariable String userId, HttpServletRequest req) {
        User caller = Auth.requireRole(req, "SUPER_ADMIN");
        User user = userRepository.findById(userId).orElseThrow();
        user.setActive(false);
        userRepository.save(user);
        sessionRepository.deleteAllByUserId(userId);
        auditLogRepository.save(AuditLog.builder()
                .changedBy(caller.getUserId()).targetUserId(userId)
                .fieldChanged("isActive").newValue("false").reason("Admin deactivated user").build());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PatchMapping("/{userId}/reactivate")
    public ResponseEntity<?> reactivateUser(@PathVariable String userId, HttpServletRequest req) {
        User caller = Auth.requireRole(req, "SUPER_ADMIN");
        User user = userRepository.findById(userId).orElseThrow();
        user.setActive(true);
        userRepository.save(user);
        auditLogRepository.save(AuditLog.builder()
                .changedBy(caller.getUserId()).targetUserId(userId)
                .fieldChanged("isActive").newValue("true").reason("Admin reactivated user").build());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyProfile(HttpServletRequest req) {
        User user = Auth.require(req);
        return ResponseEntity.ok(serializeUser(user, false));
    }

    @PutMapping("/me")
    @Transactional
    public ResponseEntity<?> updateMyProfile(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        User user = Auth.require(req);
        if (body.containsKey("name")) {
            user.setName((String) body.get("name"));
        }
        if (body.containsKey("email")) {
            user.setEmail(body.get("email") != null ? (String) body.get("email") : null);
        }
        if (body.containsKey("phone")) {
            user.setPhone(body.get("phone") != null ? (String) body.get("phone") : null);
        }
        if (body.containsKey("designation")) {
            user.setDesignation(body.get("designation") != null ? (String) body.get("designation") : null);
        }
        userRepository.save(user);
        return ResponseEntity.ok(serializeUser(user, false));
    }

    @PatchMapping("/{userId}")
    public ResponseEntity<?> updateUser(@PathVariable String userId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        User caller = Auth.requireRole(req, "SUPER_ADMIN");
        User existing = userRepository.findById(userId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        List<AuditLog> entries = new ArrayList<>();
        if (body.containsKey("username") && !body.get("username").equals(existing.getUsername())) {
            String newUsername = (String) body.get("username");
            if (userRepository.existsByUsername(newUsername)) return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Username already taken"));
            entries.add(AuditLog.builder().changedBy(caller.getUserId()).targetUserId(userId).fieldChanged("username").oldValue(existing.getUsername()).newValue(newUsername).reason("Admin updated user username").build());
            existing.setUsername(newUsername);
        }
        if (body.containsKey("name") && !body.get("name").equals(existing.getName())) {
            entries.add(AuditLog.builder().changedBy(caller.getUserId()).targetUserId(userId).fieldChanged("name").oldValue(existing.getName()).newValue((String) body.get("name")).reason("Admin updated user name").build());
            existing.setName((String) body.get("name"));
        }
        if (body.containsKey("password") && body.get("password") != null) {
            String rawPassword = (String) body.get("password");
            if (rawPassword.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Password cannot be empty or whitespace"));
            }
            if (rawPassword.length() < 8) {
                return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 8 characters long"));
            }
            existing.setPasswordHash(passwordEncoder.encode(rawPassword));
            entries.add(AuditLog.builder().changedBy(caller.getUserId()).targetUserId(userId).fieldChanged("password").reason("Admin updated user password").build());
            sessionRepository.deleteAllByUserId(userId);
        }
        if (body.containsKey("designation")) {
            existing.setDesignation(body.get("designation") != null ? (String) body.get("designation") : null);
        }
        if (body.containsKey("email")) {
            existing.setEmail(body.get("email") != null ? (String) body.get("email") : null);
        }
        if (body.containsKey("phone")) {
            existing.setPhone(body.get("phone") != null ? (String) body.get("phone") : null);
        }
        if (body.containsKey("role") && body.get("role") != null && !body.get("role").equals(existing.getRole())) {
            entries.add(AuditLog.builder().changedBy(caller.getUserId()).targetUserId(userId).fieldChanged("role").oldValue(existing.getRole()).newValue((String) body.get("role")).reason("Admin updated user role").build());
            existing.setRole((String) body.get("role"));
        }
        userRepository.save(existing);
        auditLogRepository.saveAll(entries);
        return ResponseEntity.ok(Map.of("userId", existing.getUserId(), "username", existing.getUsername(), "name", existing.getName(), "role", existing.getRole()));
    }

    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        User caller = Auth.requireRole(req, "SUPER_ADMIN");
        String username = (String) body.get("username");
        String password = (String) body.get("password");
        String name     = (String) body.get("name");
        String role     = (String) body.getOrDefault("role", "DEVELOPER");
        String designation = (String) body.get("designation");
        if (username == null || password == null || name == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "username, password, and name are required"));
        }
        if (password.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password cannot be empty or whitespace"));
        }
        if (password.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 8 characters long"));
        }
        if (userRepository.existsByUsername(username)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Username already exists"));
        }
        String email = (String) body.get("email");
        String phone = (String) body.get("phone");
        String hash = passwordEncoder.encode(password);
        User newUser = User.builder().username(username).passwordHash(hash)
                .name(name).role(role).designation(designation).email(email).phone(phone).isActive(true)
                .createdBy(caller.getUserId()).build();
        newUser = userRepository.save(newUser);
        auditLogRepository.save(AuditLog.builder()
                .changedBy(caller.getUserId()).targetUserId(newUser.getUserId())
                .fieldChanged("account_created").newValue(username)
                .reason("Admin created new user account: " + username).build());
        return ResponseEntity.status(HttpStatus.CREATED).body(
                Map.of("userId", newUser.getUserId(), "username", newUser.getUsername(), "name", newUser.getName(), "role", newUser.getRole()));
    }

    @PostMapping("/me/change-password")
    @Transactional
    public ResponseEntity<?> changeMyPassword(@RequestBody Map<String, String> body, HttpServletRequest req) {
        User user = Auth.require(req);
        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");
        String confirmPassword = body.get("confirmPassword");

        if (currentPassword == null || newPassword == null || confirmPassword == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "All fields are required"));
        }
        if (!newPassword.equals(confirmPassword)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Passwords do not match"));
        }
        if (newPassword.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password cannot be empty or whitespace"));
        }
        if (newPassword.length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 8 characters long"));
        }
        if (newPassword.equals(currentPassword)) {
            return ResponseEntity.badRequest().body(Map.of("error", "New password cannot be the same as current password"));
        }
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid current password"));
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        sessionRepository.deleteAllByUserId(user.getUserId());

        auditLogRepository.save(AuditLog.builder()
                .changedBy(user.getUserId()).targetUserId(user.getUserId())
                .fieldChanged("password").reason("User changed their own password").build());

        return ResponseEntity.ok(Map.of("success", true, "message", "Password changed successfully"));
    }
}
