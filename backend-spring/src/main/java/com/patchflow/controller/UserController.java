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
        m.put("isActive", u.isActive());
        if (includeModules) {
            m.put("modules", u.getModules().stream().map(mod -> Map.of("id", mod.getModuleId(), "name", mod.getModuleName())).collect(Collectors.toList()));
        }
        return m;
    }

    @GetMapping
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
    public ResponseEntity<?> getUserModules(@PathVariable String userId, HttpServletRequest req) {
        Auth.require(req);
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return ResponseEntity.ok(List.of());
        return ResponseEntity.ok(user.getModules().stream().map(m ->
                Map.of("id", userId + "-" + m.getModuleId(), "module", Map.of("id", m.getModuleId(), "name", m.getModuleName()))
        ).collect(Collectors.toList()));
    }

    @PutMapping("/{userId}/modules")
    public ResponseEntity<?> updateUserModules(@PathVariable String userId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        User caller = Auth.require(req);
        String callerRole = caller.getRole();
        if (!"ADMIN".equals(callerRole) && !"SUPER_ADMIN".equals(callerRole)) {
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
    public ResponseEntity<?> updateUserManagers(@PathVariable String userId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        User caller = Auth.requireRole(req, "SUPER_ADMIN", "ADMIN");
        @SuppressWarnings("unchecked") List<String> managerIds = (List<String>) body.get("managerIds");
        if (managerIds == null || managerIds.size() > 3) {
            return ResponseEntity.badRequest().body(Map.of("error", "A user can be assigned to a maximum of 3 managers."));
        }
        userManagerRepository.deleteByUserId(userId);
        managerIds.forEach(mid -> userManagerRepository.save(UserManager.builder().userId(userId).managerId(mid).build()));
        auditLogRepository.save(AuditLog.builder()
                .changedBy(caller.getUserId()).targetUserId(userId)
                .fieldChanged("managers").newValue(String.join(",", managerIds))
                .reason(body.getOrDefault("reason", "Admin updated user managers").toString()).build());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/{userId}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable String userId, HttpServletRequest req) {
        User caller = Auth.requireRole(req, "SUPER_ADMIN", "ADMIN");
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
        User caller = Auth.requireRole(req, "SUPER_ADMIN", "ADMIN");
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
        User caller = Auth.requireRole(req, "SUPER_ADMIN", "ADMIN");
        User user = userRepository.findById(userId).orElseThrow();
        user.setActive(true);
        userRepository.save(user);
        auditLogRepository.save(AuditLog.builder()
                .changedBy(caller.getUserId()).targetUserId(userId)
                .fieldChanged("isActive").newValue("true").reason("Admin reactivated user").build());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PatchMapping("/{userId}")
    public ResponseEntity<?> updateUser(@PathVariable String userId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        User caller = Auth.requireRole(req, "SUPER_ADMIN", "ADMIN");
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
            existing.setPasswordHash(passwordEncoder.encode((String) body.get("password")));
            entries.add(AuditLog.builder().changedBy(caller.getUserId()).targetUserId(userId).fieldChanged("password").reason("Admin updated user password").build());
            sessionRepository.deleteAllByUserId(userId);
        }
        if (body.containsKey("designation")) {
            existing.setDesignation(body.get("designation") != null ? (String) body.get("designation") : null);
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
        User caller = Auth.requireRole(req, "SUPER_ADMIN", "ADMIN");
        String username = (String) body.get("username");
        String password = (String) body.get("password");
        String name     = (String) body.get("name");
        String role     = (String) body.getOrDefault("role", "DEVELOPER");
        String designation = (String) body.get("designation");
        if (username == null || password == null || name == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "username, password, and name are required"));
        }
        if (userRepository.existsByUsername(username)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Username already exists"));
        }
        String hash = passwordEncoder.encode(password);
        User newUser = User.builder().username(username).passwordHash(hash).salt("BCrypt")
                .name(name).role(role).designation(designation).isActive(true)
                .createdBy(caller.getUserId()).build();
        newUser = userRepository.save(newUser);
        auditLogRepository.save(AuditLog.builder()
                .changedBy(caller.getUserId()).targetUserId(newUser.getUserId())
                .fieldChanged("account_created").newValue(username)
                .reason("Admin created new user account: " + username).build());
        return ResponseEntity.status(HttpStatus.CREATED).body(
                Map.of("userId", newUser.getUserId(), "username", newUser.getUsername(), "name", newUser.getName(), "role", newUser.getRole()));
    }
}
