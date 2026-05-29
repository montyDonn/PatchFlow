package com.patchflow.service;

import com.patchflow.entity.AccountRequest;
import com.patchflow.entity.User;
import com.patchflow.repository.AccountRequestRepository;
import com.patchflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AccountRequestService {

    private static final Set<String> ALLOWED_ROLES = Set.of("CLIENT", "VIEWER");

    private final AccountRequestRepository accountRequestRepository;
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    // ── Public: Submit a new access request ──────────────────────────────────

    @Transactional
    public Map<String, Object> submitRequest(String username, String password,
                                             String name, String phone, String role) {
        // Validate role — only CLIENT and VIEWER allowed via public signup
        if (role == null || !ALLOWED_ROLES.contains(role.toUpperCase())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only CLIENT or VIEWER roles are allowed for self-registration.");
        }

        // Check username uniqueness across both User and AccountRequest tables
        if (userRepository.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Username is already taken. Please choose a different username.");
        }
        if (accountRequestRepository.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A registration request with this username is already pending.");
        }

        String hash = passwordEncoder.encode(password);

        AccountRequest request = AccountRequest.builder()
                .username(username)
                .passwordHash(hash)
                .salt("BCrypt")
                .name(name)
                .phone(phone)
                .role(role.toUpperCase())
                .status("PENDING")
                .build();

        accountRequestRepository.save(request);

        return Map.of(
                "success", true,
                "message", "Your access request has been submitted. An admin will review it shortly."
        );
    }

    // ── Admin: List requests ─────────────────────────────────────────────────

    public List<Map<String, Object>> getAllRequests(String status) {
        List<AccountRequest> requests = (status != null && !status.isBlank())
                ? accountRequestRepository.findByStatusOrderByCreatedAtDesc(status.toUpperCase())
                : accountRequestRepository.findAllByOrderByCreatedAtDesc();

        return requests.stream().map(this::toMap).toList();
    }

    // ── Admin: Approve a request → create real User ──────────────────────────

    @Transactional
    public Map<String, Object> approveRequest(String requestId, String adminUserId) {
        AccountRequest req = findRequestOrThrow(requestId);

        if (!"PENDING".equals(req.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Request is no longer pending (current status: " + req.getStatus() + ").");
        }

        // Final username uniqueness check before creating the user
        if (userRepository.existsByUsername(req.getUsername())) {
            req.setStatus("REJECTED");
            req.setReviewNote("Auto-rejected: username was taken by the time of approval.");
            req.setReviewedBy(adminUserId);
            req.setReviewedAt(Instant.now());
            accountRequestRepository.save(req);
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Username '" + req.getUsername() + "' was already taken. Request has been auto-rejected.");
        }

        // Create the User record
        User user = User.builder()
                .username(req.getUsername())
                .passwordHash(req.getPasswordHash())
                .salt(req.getSalt())
                .name(req.getName())
                .designation(req.getPhone() != null ? "Phone: " + req.getPhone() : null)
                .role(req.getRole())
                .isActive(true)
                .createdBy(adminUserId)
                .build();
        user = userRepository.save(user);

        // Mark request as approved
        req.setStatus("APPROVED");
        req.setReviewedBy(adminUserId);
        req.setReviewedAt(Instant.now());
        accountRequestRepository.save(req);

        Map<String, Object> userMap = new HashMap<>();
        userMap.put("userId", user.getUserId());
        userMap.put("username", user.getUsername());
        userMap.put("name", user.getName());
        userMap.put("role", user.getRole());

        return Map.of("success", true, "message", "Account approved and created.", "user", userMap);
    }

    // ── Admin: Reject a request ──────────────────────────────────────────────

    @Transactional
    public Map<String, Object> rejectRequest(String requestId, String adminUserId, String note) {
        AccountRequest req = findRequestOrThrow(requestId);

        if (!"PENDING".equals(req.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Request is no longer pending (current status: " + req.getStatus() + ").");
        }

        req.setStatus("REJECTED");
        req.setReviewedBy(adminUserId);
        req.setReviewNote(note);
        req.setReviewedAt(Instant.now());
        accountRequestRepository.save(req);

        return Map.of("success", true, "message", "Request rejected.");
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private AccountRequest findRequestOrThrow(String id) {
        return accountRequestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account request not found."));
    }

    private Map<String, Object> toMap(AccountRequest r) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", r.getId());
        m.put("username", r.getUsername());
        m.put("name", r.getName());
        m.put("phone", r.getPhone());
        m.put("role", r.getRole());
        m.put("status", r.getStatus());
        m.put("reviewedBy", r.getReviewedBy());
        m.put("reviewNote", r.getReviewNote());
        m.put("createdAt", r.getCreatedAt());
        m.put("reviewedAt", r.getReviewedAt());
        return m;
    }
}
