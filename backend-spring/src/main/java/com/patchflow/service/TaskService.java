package com.patchflow.service;

import com.patchflow.entity.*;
import com.patchflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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

    private static final Set<String> ADMIN_ROLES = Set.of("SUPER_ADMIN", "ADMIN");

    private static final Map<String, List<String>> ALLOWED_TRANSITIONS = new HashMap<>();
    static {
        ALLOWED_TRANSITIONS.put("DRAFT",               List.of("ASSIGNED"));
        ALLOWED_TRANSITIONS.put("ASSIGNED",            List.of("PENDING_APPROVAL"));
        ALLOWED_TRANSITIONS.put("PENDING_APPROVAL",    List.of("IN_DEVELOPMENT"));
        ALLOWED_TRANSITIONS.put("IN_DEVELOPMENT",      List.of("VERIFYING"));
        ALLOWED_TRANSITIONS.put("VERIFYING",           List.of("COMPLETED","RETURNED_TO_DEVELOPER","REJECTED","DELAYED","ON_HOLD","CANCELLED"));
        ALLOWED_TRANSITIONS.put("RETURNED_TO_DEVELOPER", List.of("IN_DEVELOPMENT"));
        ALLOWED_TRANSITIONS.put("DELAYED",             List.of("IN_DEVELOPMENT"));
        ALLOWED_TRANSITIONS.put("ON_HOLD",             List.of("IN_DEVELOPMENT"));
        ALLOWED_TRANSITIONS.put("COMPLETED",           List.of());
        ALLOWED_TRANSITIONS.put("REJECTED",            List.of());
        ALLOWED_TRANSITIONS.put("CANCELLED",           List.of());
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
            case "ASSIGNED" -> {
                boolean clientOrAuthor = ("CLIENT".equals(actor.getRole()) &&
                        (actorId.equals(task.getClientId()) || actorId.equals(task.getAuthorId()))) ||
                        (task.getClientId() == null && (actorId.equals(task.getAuthorId()) || isTaskManager));
                authorized = clientOrAuthor && "DRAFT".equals(previousStatus);
            }
            case "PENDING_APPROVAL" -> {
                if ("MANAGER".equals(actor.getRole())) {
                    List<String> teamIds = getTeamUserIds(actorId);
                    List<String> devIds  = task.getDevelopers().stream().map(User::getUserId).toList();
                    List<String> verIds  = task.getVerifiers().stream().map(User::getUserId).toList();
                    boolean isTeamMgr = devIds.stream().anyMatch(teamIds::contains) || verIds.stream().anyMatch(teamIds::contains);
                    authorized = (isTaskManager || isTeamMgr) && "ASSIGNED".equals(previousStatus);
                }
            }
            case "IN_DEVELOPMENT" -> {
                if ("PENDING_APPROVAL".equals(previousStatus) && "MANAGER".equals(actor.getRole())) {
                    List<String> teamIds = getTeamUserIds(actorId);
                    List<String> devIds  = task.getDevelopers().stream().map(User::getUserId).toList();
                    List<String> verIds  = task.getVerifiers().stream().map(User::getUserId).toList();
                    boolean isTeamMgr = devIds.stream().anyMatch(teamIds::contains) || verIds.stream().anyMatch(teamIds::contains);
                    authorized = isTaskManager || isTeamMgr;
                } else if (List.of("RETURNED_TO_DEVELOPER","DELAYED","ON_HOLD").contains(previousStatus)) {
                    List<String> devIds = task.getDevelopers().stream().map(User::getUserId).toList();
                    boolean isDev = "DEVELOPER".equals(actor.getRole()) && devIds.contains(actorId);
                    boolean isMgr = false;
                    if ("MANAGER".equals(actor.getRole())) {
                        List<String> teamIds = getTeamUserIds(actorId);
                        List<String> verIds  = task.getVerifiers().stream().map(User::getUserId).toList();
                        isMgr = (isTaskManager || devIds.stream().anyMatch(teamIds::contains) || verIds.stream().anyMatch(teamIds::contains));
                    }
                    authorized = isDev || isMgr;
                }
            }
            case "VERIFYING" -> {
                List<String> devIds = task.getDevelopers().stream().map(User::getUserId).toList();
                authorized = "DEVELOPER".equals(actor.getRole()) && devIds.contains(actorId) && "IN_DEVELOPMENT".equals(previousStatus);
            }
            default -> {
                if (List.of("COMPLETED","RETURNED_TO_DEVELOPER","REJECTED","DELAYED","ON_HOLD","CANCELLED").contains(newStatus)) {
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
            String dateGiven, Integer lifecycleStatus, String plannedStartDate, String plannedEndDate) {

        User actor = getActor(authorId);
        if (!isAdmin(actor.getRole()) && !Set.of("CLIENT","MANAGER","DEVELOPER").contains(actor.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only SUPER_ADMIN, ADMIN, CLIENT, MANAGER, and DEVELOPER can create patches");
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

        Task task = Task.builder()
                .title(title).description(description).authorId(authorId)
                .moduleId(moduleId).teamId(teamId)
                .clientId(resolvedClientId)
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

        return getTaskById(task.getId());
    }

    // ── getTasks ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTasks(String role, String userId, boolean includeDeleted) {
        List<Task> tasks;
        if (isAdmin(role) && includeDeleted) {
            tasks = taskRepository.findAll().stream()
                    .sorted(Comparator.comparing(Task::getCreatedAt).reversed())
                    .collect(Collectors.toList());
        } else {
            tasks = taskRepository.findAll().stream()
                    .filter(t -> t.getLifecycleStatus() < 100)
                    .filter(t -> hasReadAccess(t, role, userId))
                    .sorted(Comparator.comparing(Task::getCreatedAt).reversed())
                    .collect(Collectors.toList());
        }
        return tasks.stream().map(this::normalizeTask).collect(Collectors.toList());
    }

    private boolean hasReadAccess(Task task, String role, String userId) {
        if (isAdmin(role)) return true;
        return switch (role) {
            case "CLIENT" -> userId.equals(task.getClientId()) || userId.equals(task.getAuthorId());
            case "DEVELOPER" -> task.getDevelopers().stream().anyMatch(d -> d.getUserId().equals(userId));
            case "VERIFIER"  -> task.getVerifiers().stream().anyMatch(v -> v.getUserId().equals(userId));
            case "MANAGER"   -> {
                if (task.getManagers().stream().anyMatch(m -> m.getUserId().equals(userId))) yield true;
                if (userId.equals(task.getAuthorId())) yield true;
                List<String> teamIds = getTeamUserIds(userId);
                boolean devMatch = task.getDevelopers().stream().anyMatch(d -> teamIds.contains(d.getUserId()));
                boolean verMatch = task.getVerifiers().stream().anyMatch(v -> teamIds.contains(v.getUserId()));
                yield devMatch || verMatch;
            }
            default -> false;
        };
    }

    // ── getTaskById ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getTaskById(String id) {
        Task task = taskRepository.findById(id)
                .orElse(null);
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
        if (isAdmin(role)) return;
        String clientId  = (String) task.get("clientId");
        String authorId  = (String) task.get("authorId");
        @SuppressWarnings("unchecked") List<Map<String,Object>> managers   = (List<Map<String,Object>>) task.get("managers");
        @SuppressWarnings("unchecked") List<Map<String,Object>> developers = (List<Map<String,Object>>) task.get("developers");
        @SuppressWarnings("unchecked") List<Map<String,Object>> verifiers  = (List<Map<String,Object>>) task.get("verifiers");
        boolean ok = switch (role) {
            case "CLIENT"    -> actorId.equals(clientId) || actorId.equals(authorId);
            case "DEVELOPER" -> developers.stream().anyMatch(d -> actorId.equals(d.get("userId")));
            case "VERIFIER"  -> verifiers.stream().anyMatch(v -> actorId.equals(v.get("userId")));
            case "MANAGER"   -> {
                if (managers.stream().anyMatch(m -> actorId.equals(m.get("userId")))) yield true;
                if (actorId.equals(authorId)) yield true;
                List<String> teamIds = getTeamUserIds(actorId);
                yield developers.stream().anyMatch(d -> teamIds.contains(d.get("userId"))) ||
                      verifiers.stream().anyMatch(v -> teamIds.contains(v.get("userId")));
            }
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
                case "ASSIGNED" -> task.getManagers().forEach(m ->
                    notificationService.createNotification(m.getUserId(), "TASK_ASSIGNED", "Task \"" + task.getTitle() + "\" has been assigned to you by Client."));
                case "PENDING_APPROVAL" -> task.getManagers().forEach(m ->
                    notificationService.createNotification(m.getUserId(), "TASK_PENDING_APPROVAL", "Task \"" + task.getTitle() + "\" assignments ready for approval."));
                case "IN_DEVELOPMENT" -> task.getDevelopers().forEach(d ->
                    notificationService.createNotification(d.getUserId(), "TASK_IN_DEVELOPMENT", "Work has started on your task: \"" + task.getTitle() + "\"."));
                case "VERIFYING" -> task.getVerifiers().forEach(v ->
                    notificationService.createNotification(v.getUserId(), "TASK_PENDING_VERIFICATION", "Task \"" + task.getTitle() + "\" is ready for verification."));
                case "RETURNED_TO_DEVELOPER" -> task.getDevelopers().forEach(d ->
                    notificationService.createNotification(d.getUserId(), "TASK_RETURNED", "Task \"" + task.getTitle() + "\" failed verification and has been returned to you for rework."));
                default -> {
                    if (task.getClientId() != null && List.of("COMPLETED","REJECTED","CANCELLED","DELAYED","ON_HOLD").contains(newStatus)) {
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

        TaskComment comment = TaskComment.builder()
                .taskId(taskId).userId(actorId).content(content.trim())
                .authorName(actor.getName()).authorRole(actor.getRole())
                .files(files != null ? files : List.of()).build();
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
        if (!isAdmin(actor.getRole())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only SUPER_ADMIN and ADMIN can delete patches");
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
        if (!isAdmin(actor.getRole())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only SUPER_ADMIN and ADMIN can restore patches");
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
        if (!isAdmin(actor.getRole()) && !managerIds.contains(actorId)) {
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
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));

        if ("CLIENT".equals(actor.getRole())) {
            if (!actorId.equals(task.getClientId()) && !actorId.equals(task.getAuthorId()))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You do not own this patch");
            if (!"DRAFT".equals(task.getStatus()))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: Cannot edit patches after submission");
        }

        if ("MANAGER".equals(actor.getRole())) {
            List<String> managerIds = task.getManagers().stream().map(User::getUserId).toList();
            List<String> teamIds = getTeamUserIds(actorId);
            List<String> devIds = task.getDevelopers().stream().map(User::getUserId).toList();
            List<String> verIds = task.getVerifiers().stream().map(User::getUserId).toList();
            boolean isTeamPatch = managerIds.contains(actorId) || actorId.equals(task.getAuthorId()) ||
                    devIds.stream().anyMatch(teamIds::contains) || verIds.stream().anyMatch(teamIds::contains);
            if (!isTeamPatch) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You can only edit patches assigned to you or your team");
        }

        String oldStatus = task.getStatus();

        if (data.containsKey("title"))       task.setTitle((String) data.get("title"));
        if (data.containsKey("description")) task.setDescription((String) data.get("description"));
        if (data.containsKey("moduleId") && data.get("moduleId") != null) { assertModule((String) data.get("moduleId")); task.setModuleId((String) data.get("moduleId")); }
        if (data.containsKey("clientId"))    task.setClientId((String) data.get("clientId"));
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

        // auto-assign
        String newStatus = (String) data.get("status");
        if ("DRAFT".equals(oldStatus) && (newStatus == null || !"ASSIGNED".equals(newStatus))) {
            if (!task.getManagers().isEmpty() && !task.getDevelopers().isEmpty() && !task.getVerifiers().isEmpty()) {
                newStatus = "ASSIGNED";
            }
        }
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

        taskRepository.save(task);
        return getTaskById(taskId);
    }
}
