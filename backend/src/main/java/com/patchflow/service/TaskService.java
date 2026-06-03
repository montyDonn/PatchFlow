package com.patchflow.service;

import com.patchflow.entity.*;
import com.patchflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final UserManagerRepository userManagerRepository;
    private final AppModuleRepository moduleRepository;
    private final StatusHistoryRepository statusHistoryRepository;
    private final AuditLogRepository auditLogRepository;
    private final NotificationService notificationService;

    // ── Constants ────────────────────────────────────────────────────────────

    private static final Set<String> ADMIN_ROLES = Set.of("ADMIN", "SUPER_ADMIN");

    private static final Map<String, List<String>> ALLOWED_TRANSITIONS = new HashMap<>();
    static {
        ALLOWED_TRANSITIONS.put("DRAFT",               List.of("PENDING_APPROVAL"));
        ALLOWED_TRANSITIONS.put("PENDING_APPROVAL",     List.of("ASSIGNED"));
        ALLOWED_TRANSITIONS.put("ASSIGNED",             List.of("IN_DEVELOPMENT"));
        ALLOWED_TRANSITIONS.put("IN_DEVELOPMENT",       List.of("VERIFYING"));
        ALLOWED_TRANSITIONS.put("VERIFYING",            List.of("COMPLETED","RETURNED_TO_DEVELOPER","REJECTED","ON_HOLD","CANCELLED"));
        ALLOWED_TRANSITIONS.put("RETURNED_TO_DEVELOPER", List.of("IN_DEVELOPMENT"));
        ALLOWED_TRANSITIONS.put("DELAYED",              List.of("IN_DEVELOPMENT"));
        ALLOWED_TRANSITIONS.put("ON_HOLD",              List.of("IN_DEVELOPMENT"));
        ALLOWED_TRANSITIONS.put("COMPLETED",            List.of());
        ALLOWED_TRANSITIONS.put("REJECTED",             List.of());
        ALLOWED_TRANSITIONS.put("CANCELLED",            List.of());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private User getActor(String actorId) {
        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Actor not found"));
        if (!actor.isActive()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Actor not found");
        return actor;
    }

    private boolean isAdmin(String role) { return ADMIN_ROLES.contains(role); }

    private void assertActiveUser(String userId, String field) {
        if (userId == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing required field: " + field);
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " not found or inactive"));
        if (!u.isActive()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " not found or inactive");
    }

    private AppModule assertModule(String moduleId) {
        if (moduleId == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing required field: moduleId");
        AppModule m = moduleRepository.findById(moduleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "moduleId not found"));
        if (!m.isActive()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "moduleId not found");
        return m;
    }

    private List<String> getTeamUserIds(String managerId) {
        return userManagerRepository.findByManagerId(managerId)
                .stream().map(UserManager::getUserId).collect(Collectors.toList());
    }

    private synchronized String generateTaskId() {
        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd");
        String prefix = java.time.LocalDate.now().format(formatter);
        String maxId = taskRepository.findMaxIdWithPrefix(prefix + "%");
        int nextSeq = 0;
        if (maxId != null && maxId.startsWith(prefix)) {
            try {
                String seqStr = maxId.substring(8);
                nextSeq = Integer.parseInt(seqStr) + 1;
            } catch (NumberFormatException ignored) {}
        }
        return prefix + String.format("%04d", nextSeq);
    }

    public Instant parseInstant(String dateStr, Instant defaultVal) {
        if (dateStr == null || dateStr.isBlank()) return defaultVal;
        try {
            return Instant.parse(dateStr);
        } catch (java.time.format.DateTimeParseException e) {
            try {
                if (dateStr.length() == 10) {
                    return java.time.LocalDate.parse(dateStr)
                            .atStartOfDay(java.time.ZoneOffset.UTC)
                            .toInstant();
                }
                return java.time.LocalDateTime.parse(dateStr.replace(" ", "T"))
                        .atOffset(java.time.ZoneOffset.UTC)
                        .toInstant();
            } catch (Exception ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date format: " + dateStr + ". Expected ISO-8601 or YYYY-MM-DD", ex);
            }
        }
    }

    // ── Validate transition ──────────────────────────────────────────────────

    private void validateStatusTransition(Task task, User actor, String newStatus) {
        String previousStatus = task.getStatus();
        if (previousStatus.equals(newStatus)) return;

        List<String> allowed = ALLOWED_TRANSITIONS.getOrDefault(previousStatus, List.of());
        if (!allowed.contains(newStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid workflow transition: " + previousStatus + " -> " + newStatus);
        }
        if (isAdmin(actor.getRole())) return;

        String actorId = actor.getUserId();
        List<String> managerIds = task.getManagers().stream().map(User::getUserId).collect(Collectors.toList());
        boolean isTaskManager = managerIds.contains(actorId);
        boolean authorized = false;

        switch (newStatus) {
            case "PENDING_APPROVAL" -> {
                boolean clientOrAuthor = ("CLIENT".equals(actor.getRole()) &&
                        (actorId.equals(task.getClientId()) || actorId.equals(task.getAuthorId()))) ||
                        (task.getClientId() == null && (actorId.equals(task.getAuthorId()) || isTaskManager));
                authorized = clientOrAuthor && "DRAFT".equals(previousStatus);
            }
            case "ASSIGNED" -> {
                authorized = "MANAGER".equals(actor.getRole()) && isTaskManager && "PENDING_APPROVAL".equals(previousStatus);
            }
            case "IN_DEVELOPMENT" -> {
                if ("ASSIGNED".equals(previousStatus) && "MANAGER".equals(actor.getRole())) {
                    List<String> devIds = task.getDevelopers().stream().map(User::getUserId).toList();
                    List<String> verIds = task.getVerifiers().stream().map(User::getUserId).toList();
                    authorized = isTaskManager && !devIds.isEmpty() && !verIds.isEmpty();
                } else if (List.of("RETURNED_TO_DEVELOPER","DELAYED","ON_HOLD").contains(previousStatus)) {
                    List<String> devIds = task.getDevelopers().stream().map(User::getUserId).toList();
                    boolean isDev = "DEVELOPER".equals(actor.getRole()) && devIds.contains(actorId);
                    boolean isMgr = "MANAGER".equals(actor.getRole()) && isTaskManager;
                    authorized = isDev || isMgr;
                }
            }
            case "VERIFYING" -> {
                List<String> devIds = task.getDevelopers().stream().map(User::getUserId).toList();
                authorized = "DEVELOPER".equals(actor.getRole()) && devIds.contains(actorId) && "IN_DEVELOPMENT".equals(previousStatus);
            }
            default -> {
                if (List.of("COMPLETED","RETURNED_TO_DEVELOPER","REJECTED","ON_HOLD","CANCELLED").contains(newStatus)) {
                    List<String> verIds = task.getVerifiers().stream().map(User::getUserId).toList();
                    authorized = "VERIFIER".equals(actor.getRole()) && verIds.contains(actorId) && "VERIFYING".equals(previousStatus);
                }
            }
        }

        if (!authorized) throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Forbidden: You are not authorized to move this patch to that stage");
    }

    // ── Normalization ────────────────────────────────────────────────────────

    public Map<String, Object> normalizeUser(User user) {
        if (user == null) return null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", user.getUserId()); m.put("userId", user.getUserId());
        m.put("username", user.getUsername()); m.put("name", user.getName());
        m.put("role", user.getRole()); m.put("designation", user.getDesignation());
        m.put("isActive", user.isActive());
        return m;
    }

    public Map<String, Object> normalizeTask(Task task) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", task.getId());
        m.put("isInternal", task.getIsInternal() != null ? task.getIsInternal() : false);
        m.put("clientRequestId", task.getClientRequestId());
        m.put("title", task.getTitle());
        m.put("description", task.getDescription());
        m.put("status", task.getStatus());
        m.put("authorId", task.getAuthorId());
        m.put("lifecycleStatus", task.getLifecycleStatus());
        m.put("clientId", task.getClientId());
        m.put("teamId", task.getTeamId());
        m.put("moduleId", task.getModuleId());
        m.put("createdAt", task.getCreatedAt());
        m.put("updatedAt", task.getUpdatedAt());
        m.put("plannedStartDate", task.getPlannedStartDate());
        m.put("plannedEndDate", task.getPlannedEndDate());
        m.put("completedAt", task.getCompletedAt());
        m.put("dateGiven", task.getDateGiven());
        m.put("dateStarted", task.getDateStarted());
        m.put("dateEnded", task.getDateEnded());
        m.put("author",  normalizeUser(task.getAuthor()));
        m.put("client",  normalizeUser(task.getClient()));
        m.put("managers",   task.getManagers().stream().map(this::normalizeUser).collect(Collectors.toList()));
        m.put("developers", task.getDevelopers().stream().map(this::normalizeUser).collect(Collectors.toList()));
        m.put("verifiers",  task.getVerifiers().stream().map(this::normalizeUser).collect(Collectors.toList()));
        // backwards-compat aliases
        m.put("manager",  task.getManagers().isEmpty() ? null : normalizeUser(task.getManagers().get(0)));
        m.put("assignee", task.getDevelopers().isEmpty() ? null : normalizeUser(task.getDevelopers().get(0)));
        m.put("verifier", task.getVerifiers().isEmpty() ? null : normalizeUser(task.getVerifiers().get(0)));
        m.put("approver", normalizeUser(task.getApprover() != null ? task.getApprover() : (task.getManagers().isEmpty() ? null : task.getManagers().get(0))));
        if (task.getModule() != null) {
            m.put("module", Map.of("id", task.getModule().getModuleId(), "name", task.getModule().getModuleName()));
        } else { m.put("module", null); }
        if (task.getTeam() != null) m.put("team", Map.of("id", task.getTeam().getId(), "name", task.getTeam().getName()));
        else m.put("team", null);
        if (task.getComments() != null) {
            m.put("comments", task.getComments().stream().map(c -> {
                Map<String, Object> cm = new LinkedHashMap<>();
                cm.put("id", c.getId()); cm.put("taskId", c.getTaskId()); cm.put("content", c.getContent());
                cm.put("authorName", c.getAuthorName()); cm.put("authorRole", c.getAuthorRole());
                cm.put("files", c.getFiles()); cm.put("createdAt", c.getCreatedAt());
                cm.put("user", normalizeUser(c.getUser()));
                return cm;
            }).collect(Collectors.toList()));
        }
        if (task.getAttachments() != null) {
            m.put("attachments", task.getAttachments().stream().map(a -> {
                Map<String, Object> am = new LinkedHashMap<>();
                am.put("id", a.getId());
                am.put("taskId", a.getTaskId());
                am.put("uploaderId", a.getUploaderId());
                am.put("fileUrl", a.getFileUrl());
                am.put("fileName", a.getFileName());
                am.put("fileType", a.getFileType());
                am.put("size", a.getSize());
                am.put("createdAt", a.getCreatedAt());
                am.put("uploader", normalizeUser(a.getUploader()));
                return am;
            }).collect(Collectors.toList()));
        } else {
            m.put("attachments", List.of());
        }
        if (task.getStatusHistory() != null) {
            m.put("statusHistory", task.getStatusHistory().stream().map(h -> {
                Map<String, Object> hm = new LinkedHashMap<>();
                hm.put("id", h.getId()); hm.put("taskId", h.getTaskId());
                hm.put("previousStatus", h.getPreviousStatus()); hm.put("newStatus", h.getNewStatus());
                hm.put("changedById", h.getChangedById()); hm.put("changedByName", h.getChangedByName());
                hm.put("changedByUsername", h.getChangedByUsername()); hm.put("changedByRole", h.getChangedByRole());
                hm.put("reason", h.getReason()); hm.put("createdAt", h.getCreatedAt());
                return hm;
            }).collect(Collectors.toList()));
        }
        return m;
    }

    // ── createTask ───────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> createTask(String authorId, String title, String description,
            String moduleId, String teamId, String clientId, Integer clientRequestId,
            List<String> managerIds, List<String> developerIds, List<String> verifierIds,
            String dateGiven, Integer lifecycleStatus, String plannedStartDate, String plannedEndDate,
            Boolean isInternal) {

        User actor = getActor(authorId);
        if (!isAdmin(actor.getRole()) && !Set.of("CLIENT","MANAGER","DEVELOPER").contains(actor.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only ADMIN, CLIENT, MANAGER, and DEVELOPER can create patches");
        }
        if ("CLIENT".equals(actor.getRole())) {
            if (plannedEndDate != null && !plannedEndDate.isBlank()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Clients cannot set deadlines");
            }
            if (plannedStartDate != null && !plannedStartDate.isBlank()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Clients cannot set start dates");
            }
            if ((developerIds != null && !developerIds.isEmpty()) || (verifierIds != null && !verifierIds.isEmpty())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Clients can only assign managers, not other resources");
            }
        }
        assertModule(moduleId);

        String resolvedClientId = "CLIENT".equals(actor.getRole()) ? actor.getUserId() : clientId;
        if (resolvedClientId != null) assertActiveUser(resolvedClientId, "clientId");

        List<String> finalManagerIds = (managerIds != null && !managerIds.isEmpty()) ? managerIds : List.of();
        if (finalManagerIds.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing required field: managerId or managerIds");
        finalManagerIds.forEach(id -> assertActiveUser(id, "managerId"));

        List<String> finalDevIds = developerIds != null ? developerIds : List.of();
        List<String> finalVerIds = verifierIds  != null ? verifierIds  : List.of();
        finalDevIds.forEach(id -> assertActiveUser(id, "developerId"));
        finalVerIds.forEach(id -> assertActiveUser(id, "verifierId"));

        String initialStatus = (!finalManagerIds.isEmpty() && !finalDevIds.isEmpty() && !finalVerIds.isEmpty())
                ? "ASSIGNED" : "DRAFT";

        List<User> managers   = userRepository.findAllById(finalManagerIds);
        List<User> developers = userRepository.findAllById(finalDevIds);
        List<User> verifiers  = userRepository.findAllById(finalVerIds);

        String generatedId = generateTaskId();
        String finalDescription = description;
        if (description != null) {
            finalDescription = description.replaceAll("\\[CHANGE_ID:\\s*([^\\]]+)\\]", "[CHANGE_ID: " + generatedId + "]");
        }

        Task task = Task.builder()
                .id(generatedId)
                .title(title).description(finalDescription).authorId(authorId)
                .moduleId(moduleId).teamId(teamId)
                .clientId(resolvedClientId)
                .isInternal(isInternal != null ? isInternal : false)
                .clientRequestId(resolvedClientId != null ? (clientRequestId != null ? clientRequestId : 0) : 0)
                .managers(new ArrayList<>(managers))
                .developers(new ArrayList<>(developers))
                .verifiers(new ArrayList<>(verifiers))
                .dateGiven(parseInstant(dateGiven, Instant.now()))
                .plannedStartDate(parseInstant(plannedStartDate, null))
                .plannedEndDate(parseInstant(plannedEndDate, null))
                .status(initialStatus)
                .lifecycleStatus(lifecycleStatus)
                .build();
        task = taskRepository.save(task);

        statusHistoryRepository.save(StatusHistory.builder()
                .taskId(task.getId()).previousStatus("DRAFT").newStatus(initialStatus)
                .changedById(authorId).changedByName(actor.getName())
                .changedByUsername(actor.getUsername()).changedByRole(actor.getRole())
                .reason("ASSIGNED".equals(initialStatus) ? "Task created and automatically assigned" : "Task created")
                .build());

        auditLogRepository.save(AuditLog.builder()
                .taskId(task.getId()).changedBy(authorId).fieldChanged("Task Created")
                .newValue("{\"id\":\"" + task.getId() + "\",\"title\":\"" + title + "\",\"status\":\"" + initialStatus + "\"}")
                .reason("Task created by author").build());

        // Notifications on creation
        final Task finalTask = task;
        task.getManagers().forEach(m -> 
            notificationService.createNotification(m.getUserId(), "TASK_ASSIGNED", 
                "You have been assigned as Manager for patch: \"" + finalTask.getTitle() + "\""));
        task.getDevelopers().forEach(d -> 
            notificationService.createNotification(d.getUserId(), "TASK_ASSIGNED", 
                "You have been assigned as Developer for patch: \"" + finalTask.getTitle() + "\""));
        task.getVerifiers().forEach(v -> 
            notificationService.createNotification(v.getUserId(), "TASK_ASSIGNED", 
                "You have been assigned as Verifier for patch: \"" + finalTask.getTitle() + "\""));

        return getTaskById(task.getId());
    }

    // ── getTasks ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTasks(String role, String userId, String status, boolean includeDeleted) {
        // Use JOIN FETCH query to load managers/developers/verifiers/module in ONE SQL
        // instead of N+1 lazy loads (massive performance fix)
        List<Task> tasks;
        if (isAdmin(role) && includeDeleted) {
            tasks = taskRepository.findAllWithRelations().stream()
                    .collect(Collectors.toList());
        } else {
            tasks = taskRepository.findAllActiveWithRelations().stream()
                    .filter(t -> hasReadAccess(t, role, userId))
                    .collect(Collectors.toList());
        }
        if (status != null && !status.isBlank()) {
            tasks = tasks.stream()
                    .filter(t -> status.equalsIgnoreCase(t.getStatus()))
                    .collect(Collectors.toList());
        }
        return tasks.stream().map(this::normalizeTask).collect(Collectors.toList());
    }

    private boolean hasReadAccess(Task task, String role, String userId) {
        if (isAdmin(role) || "MANAGER".equals(role) || "VIEWER".equals(role)) return true;
        
        if ("UPCL_VIEWER".equals(role)) {
            return task.getIsInternal() == null || !task.getIsInternal();
        }

        if (task.getIsInternal() != null && task.getIsInternal()) {
            if ("CLIENT".equals(role)) return false;
        } else {
            if ("CLIENT".equals(role)) {
                return userId.equals(task.getClientId()) || userId.equals(task.getAuthorId());
            }
        }
        
        if ("DEVELOPER".equals(role)) {
            return task.getDevelopers().stream().anyMatch(d -> d.getUserId().equals(userId));
        }
        if ("VERIFIER".equals(role)) {
            return task.getVerifiers().stream().anyMatch(v -> v.getUserId().equals(userId));
        }
        return false;
    }

    // ── getTaskById ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getTaskById(String id) {
        // Three focused queries — each loads exactly one bag collection.
        // Hibernate's first-level cache merges them into the same Task instance.
        taskRepository.findByIdWithManagers(id);       // loads managers
        taskRepository.findByIdWithDevelopers(id);     // loads developers
        taskRepository.findByIdWithVerifiers(id);      // loads verifiers
        Task task = taskRepository.findById(id).orElse(null); // final fetch (comments/statusHistory/auditLogs lazy-load per task = fine for 1 entity)
        if (task == null) return null;
        Map<String, Object> normalized = normalizeTask(task);
        if (task.getAuditLogs() != null) {
            normalized.put("auditLogs", task.getAuditLogs().stream().map(l -> {
                Map<String, Object> am = new LinkedHashMap<>();
                am.put("logId", l.getLogId()); am.put("taskId", l.getTaskId());
                am.put("fieldChanged", l.getFieldChanged()); am.put("oldValue", l.getOldValue());
                am.put("newValue", l.getNewValue()); am.put("reason", l.getReason());
                am.put("changedAt", l.getChangedAt()); am.put("changedBy", l.getChangedBy());
                am.put("actor", normalizeUser(l.getActor()));
                return am;
            }).collect(Collectors.toList()));
        }
        return normalized;
    }

    public void checkReadPermission(Map<String, Object> task, String actorId, String role) {
        if (isAdmin(role) || "MANAGER".equals(role) || "VIEWER".equals(role)) return;
        Boolean isInternal = (Boolean) task.get("isInternal");
        if ("UPCL_VIEWER".equals(role)) {
            if (isInternal != null && isInternal) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: UPCL Viewers cannot access internal patches");
            }
            return;
        }
        if (isInternal != null && isInternal) {
            if ("CLIENT".equals(role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: Clients cannot access internal patches");
        }
        String clientId  = (String) task.get("clientId");
        String authorId  = (String) task.get("authorId");
        @SuppressWarnings("unchecked") List<Map<String,Object>> developers = (List<Map<String,Object>>) task.get("developers");
        @SuppressWarnings("unchecked") List<Map<String,Object>> verifiers  = (List<Map<String,Object>>) task.get("verifiers");
        boolean ok = switch (role) {
            case "CLIENT"    -> actorId.equals(clientId) || actorId.equals(authorId);
            case "DEVELOPER" -> developers.stream().anyMatch(d -> actorId.equals(d.get("userId")));
            case "VERIFIER"  -> verifiers.stream().anyMatch(v -> actorId.equals(v.get("userId")));
            default -> false;
        };
        if (!ok) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You do not have permission to view this patch");
    }

    // ── updateStatus ─────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> updateStatus(String taskId, String actorId, String newStatus, String reason) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        if (task.getLifecycleStatus() >= 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot update a soft deleted patch");
        User actor = getActor(actorId);
        if ("VIEWER".equals(actor.getRole()) || "UPCL_VIEWER".equals(actor.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: Viewers cannot modify status");
        }
        String previousStatus = task.getStatus();
        validateStatusTransition(task, actor, newStatus);

        task.setStatus(newStatus);
        if ("IN_DEVELOPMENT".equals(newStatus) && task.getDateStarted() == null) task.setDateStarted(Instant.now());
        if (List.of("COMPLETED","REJECTED","CANCELLED").contains(newStatus)) task.setDateEnded(Instant.now());
        else if (!List.of("COMPLETED","REJECTED","CANCELLED").contains(newStatus)) task.setDateEnded(null);
        taskRepository.save(task);

        statusHistoryRepository.save(StatusHistory.builder()
                .taskId(taskId).previousStatus(previousStatus).newStatus(newStatus)
                .changedById(actorId).changedByName(actor.getName())
                .changedByUsername(actor.getUsername()).changedByRole(actor.getRole())
                .reason(reason != null ? reason : "Status changed to " + newStatus).build());

        auditLogRepository.save(AuditLog.builder()
                .taskId(taskId).changedBy(actorId).fieldChanged("Task Status")
                .oldValue(previousStatus).newValue(newStatus)
                .reason(reason != null ? reason : "Status changed from " + previousStatus + " to " + newStatus).build());

        // Notifications
        sendStatusNotifications(task, newStatus, actorId);

        return getTaskById(taskId);
    }

    private void sendStatusNotifications(Task task, String newStatus, String actorId) {
        try {
            switch (newStatus) {
                case "PENDING_APPROVAL" -> task.getManagers().forEach(m ->
                    notificationService.createNotification(m.getUserId(), "TASK_PENDING_APPROVAL", "Patch \"" + task.getTitle() + "\" is pending your review and approval."));
                case "ASSIGNED" -> {
                    task.getDevelopers().forEach(d ->
                        notificationService.createNotification(d.getUserId(), "TASK_ASSIGNED", "You have been assigned as Developer for patch: \"" + task.getTitle() + "\""));
                    task.getVerifiers().forEach(v ->
                        notificationService.createNotification(v.getUserId(), "TASK_ASSIGNED", "You have been assigned as Verifier for patch: \"" + task.getTitle() + "\""));
                    if (task.getClientId() != null) {
                        notificationService.createNotification(task.getClientId(), "TASK_ASSIGNED", "Your patch request \"" + task.getTitle() + "\" has been approved and assigned.");
                    }
                }
                case "IN_DEVELOPMENT" -> task.getDevelopers().forEach(d ->
                    notificationService.createNotification(d.getUserId(), "TASK_IN_DEVELOPMENT", "Work has started on your task: \"" + task.getTitle() + "\"."));
                case "VERIFYING" -> task.getVerifiers().forEach(v ->
                    notificationService.createNotification(v.getUserId(), "TASK_PENDING_VERIFICATION", "Task \"" + task.getTitle() + "\" is ready for verification."));
                case "RETURNED_TO_DEVELOPER" -> task.getDevelopers().forEach(d ->
                    notificationService.createNotification(d.getUserId(), "TASK_RETURNED", "Task \"" + task.getTitle() + "\" failed verification and has been returned to you for rework."));
                case "COMPLETED" -> {
                    String msg = "Task \"" + task.getTitle() + "\" has been successfully verified and completed.";
                    task.getManagers().forEach(m -> notificationService.createNotification(m.getUserId(), "TASK_COMPLETED", msg));
                    task.getDevelopers().forEach(d -> notificationService.createNotification(d.getUserId(), "TASK_COMPLETED", msg));
                    task.getVerifiers().forEach(v -> notificationService.createNotification(v.getUserId(), "TASK_COMPLETED", msg));
                    if (task.getClientId() != null) {
                        notificationService.createNotification(task.getClientId(), "TASK_FINALIZED", "Your patch request \"" + task.getTitle() + "\" has been verified and completed.");
                    }
                }
                case "DELAYED" -> {
                    String msg = "Task \"" + task.getTitle() + "\" has been delayed.";
                    task.getManagers().forEach(m -> notificationService.createNotification(m.getUserId(), "TASK_DELAYED", msg));
                    task.getDevelopers().forEach(d -> notificationService.createNotification(d.getUserId(), "TASK_DELAYED", msg));
                    task.getVerifiers().forEach(v -> notificationService.createNotification(v.getUserId(), "TASK_DELAYED", msg));
                    if (task.getClientId() != null) {
                        notificationService.createNotification(task.getClientId(), "TASK_DELAYED", "Your patch request \"" + task.getTitle() + "\" has been delayed.");
                    }
                }
                default -> {
                    if (task.getClientId() != null && List.of("REJECTED","CANCELLED","ON_HOLD").contains(newStatus)) {
                        notificationService.createNotification(task.getClientId(), "TASK_FINALIZED", "Your patch request \"" + task.getTitle() + "\" status has been updated to " + newStatus + ".");
                    }
                }
            }
        } catch (Exception ignored) {}
    }

    // ── addComment ───────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> addComment(String taskId, String actorId, String content, Object files) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        if (task.getLifecycleStatus() >= 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot comment on a soft deleted patch");
        User actor = getActor(actorId);
        if ("VIEWER".equals(actor.getRole()) || "UPCL_VIEWER".equals(actor.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: Viewers cannot add comments");
        }

        @SuppressWarnings("unchecked")
        List<String> fileList = (List<String>) files;
        TaskComment comment = TaskComment.builder()
                .taskId(taskId).userId(actorId).content(content.trim())
                .authorName(actor.getName()).authorRole(actor.getRole())
                .files(fileList != null ? fileList : List.of()).build();
        task.getComments().add(comment);

        statusHistoryRepository.save(StatusHistory.builder()
                .taskId(taskId).previousStatus(task.getStatus()).newStatus(task.getStatus())
                .changedById(actorId).changedByName(actor.getName())
                .changedByUsername(actor.getUsername()).changedByRole(actor.getRole())
                .reason("Comment added").build());

        auditLogRepository.save(AuditLog.builder()
                .taskId(taskId).changedBy(actorId).fieldChanged("Task Comment")
                .newValue(content.trim()).reason("Comment added").build());

        taskRepository.save(task);
        return getTaskById(taskId);
    }

    // ── softDelete / restore ─────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> softDeleteTask(String taskId, String actorId) {
        User actor = getActor(actorId);
        if (!isAdmin(actor.getRole())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only ADMIN can delete patches");
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        task.setLifecycleStatus(100);
        taskRepository.save(task);
        statusHistoryRepository.save(StatusHistory.builder()
                .taskId(taskId).previousStatus(task.getStatus()).newStatus(task.getStatus())
                .changedById(actorId).changedByName(actor.getName())
                .changedByUsername(actor.getUsername()).changedByRole(actor.getRole())
                .reason("Patch soft deleted").build());
        auditLogRepository.save(AuditLog.builder().taskId(taskId).changedBy(actorId)
                .fieldChanged("Task Lifecycle").oldValue("0").newValue("100").reason("Patch soft deleted").build());
        return getTaskById(taskId);
    }

    @Transactional
    public Map<String, Object> restoreTask(String taskId, String actorId) {
        User actor = getActor(actorId);
        if (!isAdmin(actor.getRole())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only ADMIN can restore patches");
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        task.setLifecycleStatus(0);
        taskRepository.save(task);
        statusHistoryRepository.save(StatusHistory.builder()
                .taskId(taskId).previousStatus(task.getStatus()).newStatus(task.getStatus())
                .changedById(actorId).changedByName(actor.getName())
                .changedByUsername(actor.getUsername()).changedByRole(actor.getRole())
                .reason("Patch restored").build());
        auditLogRepository.save(AuditLog.builder().taskId(taskId).changedBy(actorId)
                .fieldChanged("Task Lifecycle").oldValue("100").newValue("0").reason("Patch restored").build());
        return getTaskById(taskId);
    }

    // ── assignTask ───────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> assignTask(String taskId, String assigneeId, String actorId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        User actor = getActor(actorId);
        List<String> managerIds = task.getManagers().stream().map(User::getUserId).toList();
        if (!isAdmin(actor.getRole()) && !"MANAGER".equals(actor.getRole()) && !managerIds.contains(actorId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
        }
        User assignee = userRepository.findById(assigneeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tasks can only be assigned to Developers"));
        if (!"DEVELOPER".equals(assignee.getRole())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tasks can only be assigned to Developers");
        task.getDevelopers().add(assignee);
        taskRepository.save(task);
        auditLogRepository.save(AuditLog.builder().taskId(taskId).changedBy(actorId)
                .fieldChanged("Task Developers").newValue(assigneeId).reason("Added developer assignee").build());
        notificationService.createNotification(assigneeId, "TASK_ASSIGNED", "You've been assigned as developer to: \"" + task.getTitle() + "\"");
        return getTaskById(taskId);
    }

    // ── updateTaskDetails ────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> updateTaskDetails(String taskId, Map<String, Object> data, String actorId) {
        User actor = getActor(actorId);
        String role = actor.getRole();
        if ("VIEWER".equals(role) || "UPCL_VIEWER".equals(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: Viewers cannot edit patches");
        }
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));

        boolean isAdmin = "ADMIN".equals(role) || "SUPER_ADMIN".equals(role);
        if (!isAdmin) {
            if ("CLIENT".equals(role)) {
                if (!actorId.equals(task.getClientId()) && !actorId.equals(task.getAuthorId()))
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You do not own this patch");
                if (!"DRAFT".equals(task.getStatus()))
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: Cannot edit patches after submission");
                if (data.containsKey("plannedEndDate")) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Clients cannot set deadlines");
                }
                if (data.containsKey("plannedStartDate")) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Clients cannot set start dates");
                }
                if (data.containsKey("developerIds") || data.containsKey("developers") ||
                    data.containsKey("verifierIds") || data.containsKey("verifiers")) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Clients can only assign managers, not other resources");
                }
            } else if ("MANAGER".equals(role)) {
                boolean isAssignedManager = task.getManagers().stream()
                        .anyMatch(m -> m.getUserId().equals(actorId));
                if (!isAssignedManager) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You are not assigned to this patch");
                }
            } else {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: Only admins and assigned managers can edit patch details");
            }
        }

        // Capture previous state
        Set<String> prevManagers = task.getManagers().stream().map(User::getUserId).collect(Collectors.toSet());
        Set<String> prevDevelopers = task.getDevelopers().stream().map(User::getUserId).collect(Collectors.toSet());
        Set<String> prevVerifiers = task.getVerifiers().stream().map(User::getUserId).collect(Collectors.toSet());
        String prevTitle = task.getTitle();
        String prevDescription = task.getDescription();
        String prevModuleId = task.getModuleId();
        Instant prevPlannedEndDate = task.getPlannedEndDate();

        String oldStatus = task.getStatus();

        if (data.containsKey("title"))       task.setTitle((String) data.get("title"));
        if (data.containsKey("description")) task.setDescription((String) data.get("description"));
        if (data.containsKey("moduleId") && data.get("moduleId") != null) { assertModule((String) data.get("moduleId")); task.setModuleId((String) data.get("moduleId")); }
        if (data.containsKey("clientId"))    task.setClientId((String) data.get("clientId"));
        if (data.containsKey("isInternal"))  task.setIsInternal((Boolean) data.get("isInternal"));
        if (data.containsKey("dateGiven") && data.get("dateGiven") != null) task.setDateGiven(parseInstant((String)data.get("dateGiven"), null));
        if (data.containsKey("plannedStartDate") && data.get("plannedStartDate") != null) task.setPlannedStartDate(parseInstant((String)data.get("plannedStartDate"), null));
        if (data.containsKey("plannedEndDate")   && data.get("plannedEndDate")   != null) task.setPlannedEndDate(parseInstant((String)data.get("plannedEndDate"), null));

        // managers
        if (data.containsKey("managerIds") || data.containsKey("managerId")) {
            @SuppressWarnings("unchecked")
            List<String> ids = data.containsKey("managerIds") ? (List<String>) data.get("managerIds") : List.of((String) data.get("managerId"));
            ids.forEach(id -> assertActiveUser(id, "managerId"));
            task.setManagers(new ArrayList<>(userRepository.findAllById(ids)));
        }
        if (data.containsKey("developerIds") || data.containsKey("developers")) {
            @SuppressWarnings("unchecked")
            List<String> ids = data.containsKey("developerIds") ? (List<String>) data.get("developerIds") : (List<String>) data.get("developers");
            task.setDevelopers(new ArrayList<>(userRepository.findAllById(ids)));
        }
        if (data.containsKey("verifierIds") || data.containsKey("verifiers")) {
            @SuppressWarnings("unchecked")
            List<String> ids = data.containsKey("verifierIds") ? (List<String>) data.get("verifierIds") : (List<String>) data.get("verifiers");
            task.setVerifiers(new ArrayList<>(userRepository.findAllById(ids)));
        }

        String newStatus = (String) data.get("status");
        if (newStatus != null && !newStatus.equals(oldStatus)) {
            validateStatusTransition(task, actor, newStatus);
            task.setStatus(newStatus);
            statusHistoryRepository.save(StatusHistory.builder()
                    .taskId(taskId).previousStatus(oldStatus).newStatus(newStatus)
                    .changedById(actorId).changedByName(actor.getName())
                    .changedByUsername(actor.getUsername()).changedByRole(actor.getRole())
                    .reason((String) data.getOrDefault("reason", "Status changed via details update")).build());
            auditLogRepository.save(AuditLog.builder().taskId(taskId).changedBy(actorId)
                    .fieldChanged("Task Status").oldValue(oldStatus).newValue(newStatus)
                    .reason((String) data.getOrDefault("reason", "Status changed from " + oldStatus + " to " + newStatus)).build());
        }

        task = taskRepository.save(task);

        // Fetch new states
        Set<String> newManagers = task.getManagers().stream().map(User::getUserId).collect(Collectors.toSet());
        Set<String> newDevelopers = task.getDevelopers().stream().map(User::getUserId).collect(Collectors.toSet());
        Set<String> newVerifiers = task.getVerifiers().stream().map(User::getUserId).collect(Collectors.toSet());

        // 1. Notify newly assigned resources
        final Task finalTask1 = task;
        newManagers.stream().filter(id -> !prevManagers.contains(id)).forEach(id -> {
            notificationService.createNotification(id, "TASK_ASSIGNED", 
                "You have been assigned as Manager for patch: \"" + finalTask1.getTitle() + "\"");
        });
        newDevelopers.stream().filter(id -> !prevDevelopers.contains(id)).forEach(id -> {
            notificationService.createNotification(id, "TASK_ASSIGNED", 
                "You have been assigned as Developer for patch: \"" + finalTask1.getTitle() + "\"");
        });
        newVerifiers.stream().filter(id -> !prevVerifiers.contains(id)).forEach(id -> {
            notificationService.createNotification(id, "TASK_ASSIGNED", 
                "You have been assigned as Verifier for patch: \"" + finalTask1.getTitle() + "\"");
        });

        // 2. Notify on field changes (title, description, module)
        boolean fieldsChanged = false;
        if (!Objects.equals(prevTitle, task.getTitle())) fieldsChanged = true;
        if (!Objects.equals(prevDescription, task.getDescription())) fieldsChanged = true;
        if (!Objects.equals(prevModuleId, task.getModuleId())) fieldsChanged = true;

        if (fieldsChanged) {
            String updateMsg = "Task \"" + task.getTitle() + "\" details have been updated.";
            task.getManagers().forEach(m -> notificationService.createNotification(m.getUserId(), "TASK_UPDATED", updateMsg));
            task.getDevelopers().forEach(d -> notificationService.createNotification(d.getUserId(), "TASK_UPDATED", updateMsg));
            task.getVerifiers().forEach(v -> notificationService.createNotification(v.getUserId(), "TASK_UPDATED", updateMsg));
            if (task.getClientId() != null) {
                notificationService.createNotification(task.getClientId(), "TASK_UPDATED", updateMsg);
            }
        }

        // 3. Notify on deadline changes
        if (data.containsKey("plannedEndDate")) {
            Instant newPlannedEndDate = task.getPlannedEndDate();
            if (!Objects.equals(prevPlannedEndDate, newPlannedEndDate) && newPlannedEndDate != null) {
                String deadlineMsg = "A new deadline has been set for task \"" + task.getTitle() + "\": " + 
                    java.time.format.DateTimeFormatter.ISO_LOCAL_DATE.withZone(java.time.ZoneOffset.UTC).format(newPlannedEndDate);
                task.getManagers().forEach(m -> notificationService.createNotification(m.getUserId(), "DEADLINE_UPDATED", deadlineMsg));
                task.getDevelopers().forEach(d -> notificationService.createNotification(d.getUserId(), "DEADLINE_UPDATED", deadlineMsg));
                task.getVerifiers().forEach(v -> notificationService.createNotification(v.getUserId(), "DEADLINE_UPDATED", deadlineMsg));
                if (task.getClientId() != null) {
                    notificationService.createNotification(task.getClientId(), "DEADLINE_UPDATED", deadlineMsg);
                }
            }
        }

        // 4. Notify on status changes
        if (newStatus != null && !newStatus.equals(oldStatus)) {
            sendStatusNotifications(task, newStatus, actorId);
        }

        return getTaskById(taskId);
    }

    @Transactional
    public Map<String, Object> uploadAttachment(String taskId, String uploaderId, MultipartFile file) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        if (task.getLifecycleStatus() >= 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot upload to a soft deleted patch");

        // Client folder name
        String folderName = task.getClientId() != null ? task.getClientId() : "internal";

        // Root directory
        java.io.File rootDir = new java.io.File("uploads/" + folderName);
        if (!rootDir.exists()) {
            rootDir.mkdirs();
        }

        // Make file name unique to prevent collisions
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) originalFilename = "file";
        String extension = "";
        int dotIdx = originalFilename.lastIndexOf('.');
        if (dotIdx > 0) {
            extension = originalFilename.substring(dotIdx);
        }
        String baseName = dotIdx > 0 ? originalFilename.substring(0, dotIdx) : originalFilename;
        String uniqueName = baseName + "_" + System.currentTimeMillis() + extension;

        java.io.File destFile = new java.io.File(rootDir, uniqueName);
        try {
            file.transferTo(destFile);
        } catch (java.io.IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save file: " + e.getMessage(), e);
        }

        // Save attachment record in DB
        String fileUrl = "/uploads/" + folderName + "/" + uniqueName;

        TaskAttachment attachment = TaskAttachment.builder()
                .taskId(taskId)
                .uploaderId(uploaderId)
                .fileName(originalFilename)
                .fileUrl(fileUrl)
                .fileType(file.getContentType() != null ? file.getContentType() : "application/octet-stream")
                .size((int) file.getSize())
                .build();

        task.getAttachments().add(attachment);
        taskRepository.save(task);

        // Add audit log
        auditLogRepository.save(AuditLog.builder()
                .taskId(taskId)
                .changedBy(uploaderId)
                .fieldChanged("Task Attachment")
                .newValue(originalFilename)
                .reason("File uploaded to client folder: " + folderName)
                .build());

        return getTaskById(taskId);
    }
}
