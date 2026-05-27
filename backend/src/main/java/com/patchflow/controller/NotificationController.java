package com.patchflow.controller;

import com.patchflow.config.Auth;
import com.patchflow.entity.Notification;
import com.patchflow.entity.User;
import com.patchflow.service.NotificationService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<?> getMyNotifications(HttpServletRequest req) {
        User user = Auth.require(req);
        return ResponseEntity.ok(notificationService.getUserNotifications(user.getUserId()));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable String id, HttpServletRequest req) {
        User user = Auth.require(req);
        try {
            Notification n = notificationService.markAsRead(id, user.getUserId());
            return ResponseEntity.ok(n);
        } catch (ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
    }
}
