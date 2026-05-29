package com.patchflow.controller;

import com.patchflow.config.Auth;
import com.patchflow.entity.User;
import com.patchflow.service.AccountRequestService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class AccountRequestController {

    private final AccountRequestService accountRequestService;

    // ── Public endpoint: submit a self-registration request ──────────────────

    /**
     * POST /api/auth/request-access
     * Completely public — no auth token required.
     * Accepts: { username, password, name, phone, role }
     * Role must be CLIENT or VIEWER.
     */
    @PostMapping("/api/auth/request-access")
    public ResponseEntity<?> requestAccess(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");
        String name     = body.get("name");
        String phone    = body.get("phone");
        String role     = body.get("role");

        if (username == null || username.isBlank() ||
            password == null || password.isBlank() ||
            name     == null || name.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Username, password, and name are required."));
        }

        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(accountRequestService.submitRequest(username, password, name, phone, role));
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
    }

    // ── Admin endpoints: manage requests ─────────────────────────────────────

    /**
     * GET /api/admin/account-requests?status=PENDING
     * Returns all account requests, optionally filtered by status.
     * Requires ADMIN or SUPER_ADMIN role.
     */
    @GetMapping("/api/admin/account-requests")
    public ResponseEntity<?> listRequests(@RequestParam(required = false) String status,
                                          HttpServletRequest req) {
        Auth.requireRole(req, "ADMIN", "SUPER_ADMIN");
        try {
            return ResponseEntity.ok(accountRequestService.getAllRequests(status));
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
    }

    /**
     * POST /api/admin/account-requests/{id}/approve
     * Approves the request and creates a real User account.
     * Requires ADMIN or SUPER_ADMIN role.
     */
    @PostMapping("/api/admin/account-requests/{id}/approve")
    public ResponseEntity<?> approveRequest(@PathVariable String id, HttpServletRequest req) {
        User admin = Auth.requireRole(req, "ADMIN", "SUPER_ADMIN");
        try {
            return ResponseEntity.ok(accountRequestService.approveRequest(id, admin.getUserId()));
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
    }

    /**
     * POST /api/admin/account-requests/{id}/reject
     * Rejects the request with an optional note.
     * Body: { "note": "optional reason" }
     * Requires ADMIN or SUPER_ADMIN role.
     */
    @PostMapping("/api/admin/account-requests/{id}/reject")
    public ResponseEntity<?> rejectRequest(@PathVariable String id,
                                           @RequestBody(required = false) Map<String, String> body,
                                           HttpServletRequest req) {
        User admin = Auth.requireRole(req, "ADMIN", "SUPER_ADMIN");
        String note = (body != null) ? body.get("note") : null;
        try {
            return ResponseEntity.ok(accountRequestService.rejectRequest(id, admin.getUserId(), note));
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
    }
}
