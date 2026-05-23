package com.patchflow.controller;

import com.patchflow.config.Auth;
import com.patchflow.entity.*;
import com.patchflow.repository.*;
import com.patchflow.service.TaskService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final StatusHistoryRepository statusHistoryRepository;
    private final AuditLogRepository auditLogRepository;
    private final TaskRepository taskRepository;
    private final UserManagerRepository userManagerRepository;
    private final TaskService taskService;

    @GetMapping("/history")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getHistory(HttpServletRequest req) {
        User user = Auth.require(req);
        String role = user.getRole();
        String userId = user.getUserId();

        List<StatusHistory> statusHistory;
        List<AuditLog> auditLogs;

        if ("SUPER_ADMIN".equals(role) || "ADMIN".equals(role)) {
            statusHistory = statusHistoryRepository.findAll(
                    (root, query, cb) -> { query.orderBy(cb.desc(root.get("createdAt"))); return cb.conjunction(); }
            );
            auditLogs = auditLogRepository.findAll(
                    (root, query, cb) -> { query.orderBy(cb.desc(root.get("changedAt"))); return cb.conjunction(); }
            );
        } else if ("MANAGER".equals(role)) {
            List<String> subordinateIds = userManagerRepository.findByManagerId(userId)
                    .stream().map(UserManager::getUserId).collect(Collectors.toList());
            List<String> allowedIds = new ArrayList<>(subordinateIds);
            allowedIds.add(userId);

            statusHistory = statusHistoryRepository.findAll(
                    (root, query, cb) -> {
                        query.orderBy(cb.desc(root.get("createdAt")));
                        return cb.in(root.get("changedById")).value(allowedIds);
                    }
            );
            auditLogs = auditLogRepository.findAll(
                    (root, query, cb) -> {
                        query.orderBy(cb.desc(root.get("changedAt")));
                        return cb.in(root.get("changedBy")).value(allowedIds);
                    }
            );
        } else {
            statusHistory = statusHistoryRepository.findAll(
                    (root, query, cb) -> {
                        query.orderBy(cb.desc(root.get("createdAt")));
                        return cb.equal(root.get("changedById"), userId);
                    }
            );
            auditLogs = auditLogRepository.findAll(
                    (root, query, cb) -> {
                        query.orderBy(cb.desc(root.get("changedAt")));
                        return cb.equal(root.get("changedBy"), userId);
                    }
            );
        }

        return ResponseEntity.ok(Map.of("success", true, "data",
                Map.of("statusHistory", statusHistory, "auditLogs", auditLogs)));
    }

    @GetMapping("/data")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getReportData(
            @RequestParam(required = false) String view,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String moduleId,
            @RequestParam(required = false) String clientId,
            @RequestParam(required = false) String managerId,
            @RequestParam(required = false) String developerId,
            @RequestParam(required = false) String verifierId,
            @RequestParam(required = false) String status,
            HttpServletRequest req) {

        User user = Auth.require(req);
        String role = user.getRole();
        String userId = user.getUserId();

        if ("DEVELOPER".equals(role) || "VERIFIER".equals(role)) {
            return ResponseEntity.status(403).body(Map.of("error", "Forbidden: You do not have access to reports."));
        }

        // Fetch all tasks and apply in-memory filtering (mirrors Prisma where clauses)
        List<Task> allTasks = taskRepository.findAll();
        List<Task> tasks = allTasks.stream()
                .filter(t -> t.getLifecycleStatus() < 100)
                .filter(t -> {
                    if ("CLIENT".equals(role)) return userId.equals(t.getAuthorId()) || userId.equals(t.getClientId());
                    if ("MANAGER".equals(role)) {
                        List<String> teamIds = userManagerRepository.findByManagerId(userId).stream().map(UserManager::getUserId).toList();
                        return t.getManagers().stream().anyMatch(m -> m.getUserId().equals(userId)) ||
                               userId.equals(t.getAuthorId()) ||
                               t.getDevelopers().stream().anyMatch(d -> teamIds.contains(d.getUserId())) ||
                               t.getVerifiers().stream().anyMatch(v -> teamIds.contains(v.getUserId()));
                    }
                    return true;
                })
                .filter(t -> {
                    if ("weekly".equals(view))  return t.getCreatedAt().isAfter(Instant.now().minusSeconds(7 * 86400));
                    if ("monthly".equals(view)) return t.getCreatedAt().isAfter(Instant.now().minusSeconds(30 * 86400));
                    if ("custom".equals(view) && startDate != null && endDate != null) {
                        Instant s = taskService.parseInstant(startDate, null);
                        Instant e = taskService.parseInstant(endDate, null);
                        if (s != null && e != null) {
                            return !t.getCreatedAt().isBefore(s) && !t.getCreatedAt().isAfter(e);
                        }
                    }
                    return true;
                })
                .filter(t -> moduleId == null   || moduleId.equals(t.getModuleId()))
                .filter(t -> clientId == null   || clientId.equals(t.getClientId()))
                .filter(t -> managerId == null  || t.getManagers().stream().anyMatch(m -> m.getUserId().equals(managerId)))
                .filter(t -> developerId == null || t.getDevelopers().stream().anyMatch(d -> d.getUserId().equals(developerId)))
                .filter(t -> verifierId == null  || t.getVerifiers().stream().anyMatch(v -> v.getUserId().equals(verifierId)))
                .filter(t -> status == null || status.equals(t.getStatus()))
                .sorted(Comparator.comparing(Task::getCreatedAt).reversed())
                .collect(Collectors.toList());

        List<Map<String, Object>> normalized = tasks.stream().map(taskService::normalizeTask).collect(Collectors.toList());
        return ResponseEntity.ok(Map.of("success", true, "data", normalized));
    }
}
