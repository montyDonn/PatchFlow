package com.patchflow.controller;

import com.patchflow.config.Auth;
import com.patchflow.entity.User;
import com.patchflow.service.TaskService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @PostMapping
    public ResponseEntity<?> createTask(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        User user = Auth.requireRole(req, "SUPER_ADMIN","ADMIN","CLIENT","MANAGER","DEVELOPER");
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = taskService.createTask(
                    user.getUserId(),
                    (String) body.get("title"),
                    (String) body.get("description"),
                    (String) body.get("moduleId"),
                    (String) body.get("teamId"),
                    (String) body.get("clientId"),
                    body.get("clientRequestId") != null ? ((Number) body.get("clientRequestId")).intValue() : null,
                    body.get("managerIds") != null ? (List<String>) body.get("managerIds") :
                            (body.get("managerId") != null ? List.of((String) body.get("managerId")) : null),
                    (List<String>) body.get("developerIds"),
                    (List<String>) body.get("verifierIds"),
                    (String) body.get("dateGiven"),
                    body.get("lifecycleStatus") != null ? ((Number) body.get("lifecycleStatus")).intValue() : 0,
                    (String) body.get("plannedStartDate"),
                    (String) body.get("plannedEndDate")
            );
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getTasks(@RequestParam(defaultValue = "false") boolean includeDeleted, HttpServletRequest req) {
        User user = Auth.require(req);
        return ResponseEntity.ok(taskService.getTasks(user.getRole(), user.getUserId(), includeDeleted));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getTaskById(@PathVariable String id, HttpServletRequest req) {
        User user = Auth.require(req);
        Map<String, Object> task = taskService.getTaskById(id);
        if (task == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Task not found"));
        try {
            taskService.checkReadPermission(task, user.getUserId(), user.getRole());
        } catch (ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
        return ResponseEntity.ok(task);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable String id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        User user = Auth.require(req);
        String status = (String) body.get("status");
        String reason = (String) body.get("reason");
        if (status == null) return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
        try {
            return ResponseEntity.ok(taskService.updateStatus(id, user.getUserId(), status, reason));
        } catch (ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<?> addComment(@PathVariable String id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        User user = Auth.require(req);
        String content = (String) body.get("content");
        if (content == null) return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(taskService.addComment(id, user.getUserId(), content, body.get("files")));
        } catch (ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> softDelete(@PathVariable String id, HttpServletRequest req) {
        User user = Auth.require(req);
        try {
            return ResponseEntity.ok(taskService.softDeleteTask(id, user.getUserId()));
        } catch (ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<?> restore(@PathVariable String id, HttpServletRequest req) {
        User user = Auth.require(req);
        try {
            return ResponseEntity.ok(taskService.restoreTask(id, user.getUserId()));
        } catch (ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
    }

    @PostMapping("/{id}/assign")
    public ResponseEntity<?> assign(@PathVariable String id, @RequestBody Map<String, String> body, HttpServletRequest req) {
        User user = Auth.require(req);
        String assigneeId = body.get("assigneeId");
        if (assigneeId == null) return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
        try {
            return ResponseEntity.ok(taskService.assignTask(id, assigneeId, user.getUserId()));
        } catch (ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
    }

    @PatchMapping("/{id}/details")
    public ResponseEntity<?> updateDetails(@PathVariable String id, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        User user = Auth.require(req);
        try {
            return ResponseEntity.ok(taskService.updateTaskDetails(id, body, user.getUserId()));
        } catch (ResponseStatusException ex) {
            return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
        }
    }
}
