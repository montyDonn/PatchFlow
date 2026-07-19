package com.patchflow.service;

import com.patchflow.entity.*;
import com.patchflow.repository.*;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Value;

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
    private final EmailSenderService emailSenderService;
    private final SmsSenderService smsSenderService;
    private final WhatsAppSenderService whatsAppSenderService;
    private final EntityManager entityManager;

    @Value("${app.upload-dir:./uploads}")
    private String uploadDir;

    // ── Constants ────────────────────────────────────────────────────────────

    private static final Set<String> ADMIN_ROLES = Set.of("SUPER_ADMIN");

    private static final Map<String, List<String>> ALLOWED_TRANSITIONS = new HashMap<>();
    static {
        ALLOWED_TRANSITIONS.put("DRAFT", List.of("PENDING_APPROVAL", "CANCELLED"));
        ALLOWED_TRANSITIONS.put("PENDING_APPROVAL", List.of("ASSIGNED", "REJECTED"));
        ALLOWED_TRANSITIONS.put("ASSIGNED", List.of("IN_DEVELOPMENT"));
        ALLOWED_TRANSITIONS.put("IN_DEVELOPMENT", List.of("TESTING"));
        ALLOWED_TRANSITIONS.put("TESTING", List.of("IN_DEVELOPMENT", "MANAGER_REVIEW", "ON_HOLD"));
        ALLOWED_TRANSITIONS.put("MANAGER_REVIEW", List.of("IN_DEVELOPMENT", "DEPLOYMENT", "REJECTED", "ON_HOLD"));
        ALLOWED_TRANSITIONS.put("DEPLOYMENT", List.of("IN_DEVELOPMENT", "FINAL_TESTING_OF_PATCH", "ON_HOLD"));
        ALLOWED_TRANSITIONS.put("FINAL_TESTING_OF_PATCH", List.of("MANAGER_REVIEW", "COMPLETED"));
        // Legacy / exception statuses
        ALLOWED_TRANSITIONS.put("RETURNED_TO_DEVELOPER", List.of("IN_DEVELOPMENT"));
        ALLOWED_TRANSITIONS.put("DELAYED", List.of("IN_DEVELOPMENT"));
        ALLOWED_TRANSITIONS.put("ON_HOLD", List.of("IN_DEVELOPMENT", "ASSIGNED"));
        ALLOWED_TRANSITIONS.put("COMPLETED", List.of());
        ALLOWED_TRANSITIONS.put("REJECTED", List.of());
        ALLOWED_TRANSITIONS.put("CANCELLED", List.of());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private User getActor(String actorId) {
        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Actor not found"));
        if (!actor.isActive())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Actor not found");
        return actor;
    }

    private boolean isAdmin(String role) {
        return ADMIN_ROLES.contains(role);
    }

    private void assertActiveUser(String userId, String field) {
        if (userId == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing required field: " + field);
        User u = userRepository.findById(userId)
                .orElseThrow(
                        () -> new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " not found or inactive"));
        if (!u.isActive())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " not found or inactive");
    }

    private AppModule assertModule(String moduleId) {
        if (moduleId == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing required field: moduleId");
        AppModule m = moduleRepository.findById(moduleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "moduleId not found"));
        if (!m.isActive())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "moduleId not found");
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
            } catch (NumberFormatException ignored) {
            }
        }
        return prefix + String.format("%04d", nextSeq);
    }

    public Instant parseInstant(String dateStr, Instant defaultVal) {
        if (dateStr == null || dateStr.isBlank())
            return defaultVal;
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
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Invalid date format: " + dateStr + ". Expected ISO-8601 or YYYY-MM-DD", ex);
            }
        }
    }

    // ── Validate transition ──────────────────────────────────────────────────

    private void validateStatusTransition(Task task, User actor, String newStatus) {
        String previousStatus = task.getStatus();
        if (previousStatus.equals(newStatus))
            return;

        List<String> allowed = ALLOWED_TRANSITIONS.getOrDefault(previousStatus, List.of());
        if (!allowed.contains(newStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid workflow transition: " + previousStatus + " -> " + newStatus);
        }
        if (isAdmin(actor.getRole()))
            return;

        String actorId = actor.getUserId();
        List<String> managerIds = task.getManagers().stream().map(User::getUserId).collect(Collectors.toList());
        boolean isTaskManager = managerIds.contains(actorId);
        List<String> testerIds = task.getTesters().stream().map(User::getUserId).collect(Collectors.toList());
        boolean isTaskTester = testerIds.contains(actorId);
        List<String> deployerIds = task.getDeployers().stream().map(User::getUserId).collect(Collectors.toList());
        boolean isTaskDeployer = deployerIds.contains(actorId);
        boolean authorized = false;

        List<String> devIds = task.getDevelopers().stream().map(User::getUserId).collect(Collectors.toList());
        boolean isTaskDeveloper = devIds.contains(actorId);
        List<String> verifierIds = task.getVerifiers().stream().map(User::getUserId).collect(Collectors.toList());
        boolean isTaskVerifier = verifierIds.contains(actorId);

        switch (previousStatus) {
            case "DRAFT" -> {
                // Owner: CLIENT
                authorized = "CLIENT".equals(actor.getRole()) && 
                        (actorId.equals(task.getClientId()) || actorId.equals(task.getAuthorId()));
            }
            case "PENDING_APPROVAL" -> {
                // Owner: MANAGER
                authorized = "MANAGER".equals(actor.getRole()) && isTaskManager;
            }
            case "ASSIGNED", "IN_DEVELOPMENT", "RETURNED_TO_DEVELOPER", "DELAYED" -> {
                // Owner: DEVELOPER
                authorized = "DEVELOPER".equals(actor.getRole()) && isTaskDeveloper;
            }
            case "TESTING" -> {
                // Owner: TESTER
                authorized = "TESTER".equals(actor.getRole()) && isTaskTester;
            }
            case "MANAGER_REVIEW" -> {
                // Owner: MANAGER
                authorized = "MANAGER".equals(actor.getRole()) && isTaskManager;
            }
            case "DEPLOYMENT" -> {
                // Owner: DEPLOYER
                authorized = "DEPLOYER".equals(actor.getRole()) && (isTaskDeployer || actorId.equals(task.getDeployerId()));
            }
            case "FINAL_TESTING_OF_PATCH" -> {
                // Owner: Assigned TESTER OR Assigned VERIFIER
                authorized = ("TESTER".equals(actor.getRole()) && isTaskTester) || 
                        ("VERIFIER".equals(actor.getRole()) && isTaskVerifier);
            }
            case "ON_HOLD" -> {
                // Moving off hold: developer can move to IN_DEVELOPMENT, manager can move to ASSIGNED
                if ("IN_DEVELOPMENT".equals(newStatus)) {
                    authorized = "DEVELOPER".equals(actor.getRole()) && isTaskDeveloper;
                } else if ("ASSIGNED".equals(newStatus)) {
                    authorized = "MANAGER".equals(actor.getRole()) && isTaskManager;
                }
            }
        }

        if (!authorized)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Forbidden: You are not authorized to move this patch to that stage");
    }

    // ── Normalization ────────────────────────────────────────────────────────

    public Map<String, Object> normalizeUser(User user) {
        if (user == null)
            return null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", user.getUserId());
        m.put("userId", user.getUserId());
        m.put("username", user.getUsername());
        m.put("name", user.getName());
        m.put("role", user.getRole());
        m.put("designation", user.getDesignation());
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
        m.put("deployerId", task.getDeployerId());
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
        m.put("rollbackPlan", task.getRollbackPlan());
        m.put("deploymentTarget", task.getDeploymentTarget());
        m.put("author", normalizeUser(task.getAuthor()));
        m.put("client", normalizeUser(task.getClient()));
        m.put("deployer", normalizeUser(task.getDeployer()));
        m.put("managers", task.getManagers().stream().map(this::normalizeUser).collect(Collectors.toList()));
        m.put("developers", task.getDevelopers().stream().map(this::normalizeUser).collect(Collectors.toList()));
        m.put("verifiers", task.getVerifiers().stream().map(this::normalizeUser).collect(Collectors.toList()));
        m.put("testers", task.getTesters().stream().map(this::normalizeUser).collect(Collectors.toList()));
        m.put("deployers", task.getDeployers().stream().map(this::normalizeUser).collect(Collectors.toList()));
        // backwards-compat aliases
        m.put("manager", task.getManagers().isEmpty() ? null : normalizeUser(task.getManagers().get(0)));
        m.put("assignee", task.getDevelopers().isEmpty() ? null : normalizeUser(task.getDevelopers().get(0)));
        m.put("verifier", task.getVerifiers().isEmpty() ? null : normalizeUser(task.getVerifiers().get(0)));
        m.put("approver", normalizeUser(task.getApprover() != null ? task.getApprover()
                : (task.getManagers().isEmpty() ? null : task.getManagers().get(0))));
        if (task.getModule() != null) {
            m.put("module", Map.of("id", task.getModule().getModuleId(), "name", task.getModule().getModuleName()));
        } else {
            m.put("module", null);
        }
        if (task.getTeam() != null)
            m.put("team", Map.of("id", task.getTeam().getId(), "name", task.getTeam().getName()));
        else
            m.put("team", null);
        if (task.getComments() != null) {
            m.put("comments", task.getComments().stream().map(c -> {
                Map<String, Object> cm = new LinkedHashMap<>();
                cm.put("id", c.getId());
                cm.put("taskId", c.getTaskId());
                cm.put("content", c.getContent());
                cm.put("authorName", c.getAuthorName());
                cm.put("authorRole", c.getAuthorRole());
                cm.put("files", c.getFiles());
                cm.put("createdAt", c.getCreatedAt());
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
                hm.put("id", h.getId());
                hm.put("taskId", h.getTaskId());
                hm.put("previousStatus", h.getPreviousStatus());
                hm.put("newStatus", h.getNewStatus());
                hm.put("changedById", h.getChangedById());
                hm.put("changedByName", h.getChangedByName());
                hm.put("changedByUsername", h.getChangedByUsername());
                hm.put("changedByRole", h.getChangedByRole());
                hm.put("reason", h.getReason());
                hm.put("createdAt", h.getCreatedAt());
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
            List<String> testerIds, List<String> deployerIds,
            String deployerId,
            String dateGiven, Integer lifecycleStatus, String plannedStartDate, String plannedEndDate,
            Boolean isInternal) {

        User actor = getActor(authorId);
        if (!isAdmin(actor.getRole()) && !Set.of("CLIENT", "MANAGER", "DEVELOPER", "TESTER", "DEPLOYER").contains(actor.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only ADMIN, CLIENT, MANAGER, DEVELOPER, TESTER, and DEPLOYER can create patches");
        }
        if ("CLIENT".equals(actor.getRole())) {
            if (plannedEndDate != null && !plannedEndDate.isBlank()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Clients cannot set deadlines");
            }
            if (plannedStartDate != null && !plannedStartDate.isBlank()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Clients cannot set start dates");
            }
            if ((developerIds != null && !developerIds.isEmpty()) || (verifierIds != null && !verifierIds.isEmpty()) ||
                    (testerIds != null && !testerIds.isEmpty()) || (deployerIds != null && !deployerIds.isEmpty())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Clients can only assign managers, not other resources");
            }
        }
        assertModule(moduleId);

        String resolvedClientId = "CLIENT".equals(actor.getRole()) ? actor.getUserId() : clientId;
        if (resolvedClientId != null)
            assertActiveUser(resolvedClientId, "clientId");

        List<String> finalManagerIds = (managerIds != null && !managerIds.isEmpty()) ? managerIds : List.of();
        if (finalManagerIds.isEmpty())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Missing required field: managerId or managerIds");
        finalManagerIds.forEach(id -> assertActiveUser(id, "managerId"));

        List<String> finalDevIds = developerIds != null ? developerIds : List.of();
        List<String> finalVerIds = verifierIds != null ? verifierIds : List.of();
        List<String> finalTesterIds = testerIds != null ? testerIds : List.of();
        List<String> finalDeployerIds = deployerIds != null ? deployerIds : List.of();
        finalDevIds.forEach(id -> assertActiveUser(id, "developerId"));
        finalVerIds.forEach(id -> assertActiveUser(id, "verifierId"));
        finalTesterIds.forEach(id -> assertActiveUser(id, "testerId"));
        finalDeployerIds.forEach(id -> assertActiveUser(id, "deployerId"));

        String initialStatus = (!finalManagerIds.isEmpty() && !finalDevIds.isEmpty() && !finalVerIds.isEmpty())
                ? "ASSIGNED"
                : "DRAFT";

        List<User> managers = userRepository.findAllById(finalManagerIds);
        List<User> developers = userRepository.findAllById(finalDevIds);
        List<User> verifiers = userRepository.findAllById(finalVerIds);
        List<User> testersUsers = userRepository.findAllById(finalTesterIds);
        List<User> deployersUsers = userRepository.findAllById(finalDeployerIds);

        if (deployerId != null && !deployerId.trim().isEmpty()) {
            assertActiveUser(deployerId, "deployerId");
        }

        String generatedId = generateTaskId();
        String finalDescription = description;
        if (description != null) {
            finalDescription = description.replaceAll("\\[CHANGE_ID:\\s*([^\\]]+)\\]",
                    "[CHANGE_ID: " + generatedId + "]");
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
                .testers(new ArrayList<>(testersUsers))
                .deployers(new ArrayList<>(deployersUsers))
                .deployerId(deployerId != null && !deployerId.trim().isEmpty() ? deployerId : null)
                .dateGiven(parseInstant(dateGiven, Instant.now()))
                .plannedStartDate(parseInstant(plannedStartDate, null))
                .plannedEndDate(parseInstant(plannedEndDate, null))
                .status(initialStatus)
                .lifecycleStatus(lifecycleStatus)
                .build();
        task = taskRepository.save(task);

        // Explicitly activate initial assignments to override database DEFAULT '0'
        final String taskId = task.getId();
        finalManagerIds.forEach(id -> taskRepository.upsertManager(taskId, id));
        finalDevIds.forEach(id -> taskRepository.upsertDeveloper(taskId, id));
        finalVerIds.forEach(id -> taskRepository.upsertVerifier(taskId, id));
        finalTesterIds.forEach(id -> taskRepository.upsertTester(taskId, id));
        finalDeployerIds.forEach(id -> taskRepository.upsertDeployerToList(taskId, id));

        statusHistoryRepository.save(StatusHistory.builder()
                .taskId(task.getId()).previousStatus("DRAFT").newStatus(initialStatus)
                .changedById(authorId).changedByName(actor.getName())
                .changedByUsername(actor.getUsername()).changedByRole(actor.getRole())
                .reason("ASSIGNED".equals(initialStatus) ? "Task created and automatically assigned" : "Task created")
                .build());

        auditLogRepository.save(AuditLog.builder()
                .taskId(task.getId()).changedBy(authorId).fieldChanged("Task Created")
                .newValue("{\"id\":\"" + task.getId() + "\",\"title\":\"" + title + "\",\"status\":\"" + initialStatus
                        + "\"}")
                .reason("Task created by author").build());

        // Notifications on creation
        final Task finalTask = task;
        task.getManagers().forEach(m -> triggerNotifications(m, "TASK_ASSIGNED",
                "You have been assigned as Manager for patch: \"" + finalTask.getTitle() + "\""));
        task.getDevelopers().forEach(d -> triggerNotifications(d, "TASK_ASSIGNED",
                "You have been assigned as Developer for patch: \"" + finalTask.getTitle() + "\""));
        task.getVerifiers().forEach(v -> triggerNotifications(v, "TASK_ASSIGNED",
                "You have been assigned as Verifier for patch: \"" + finalTask.getTitle() + "\""));
        task.getTesters().forEach(t -> triggerNotifications(t, "TASK_ASSIGNED",
                "You have been assigned as Tester for patch: \"" + finalTask.getTitle() + "\""));
        task.getDeployers().forEach(d -> triggerNotifications(d, "TASK_ASSIGNED",
                "You have been assigned as Deployer for patch: \"" + finalTask.getTitle() + "\""));

        return getTaskById(task.getId());
    }

    // ── getTasks ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTasks(String role, String userId, String status, boolean includeDeleted) {
        List<Task> tasks;
        if (isAdmin(role) && includeDeleted) {
            taskRepository.findAllWithDevelopers();
            taskRepository.findAllWithVerifiers();
            taskRepository.findAllWithTesters();
            taskRepository.findAllWithDeployers();
            tasks = taskRepository.findAllWithRelations().stream()
                    .collect(Collectors.toList());
        } else {
            taskRepository.findAllActiveWithDevelopers();
            taskRepository.findAllActiveWithVerifiers();
            taskRepository.findAllActiveWithTesters();
            taskRepository.findAllActiveWithDeployers();
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
        if (isAdmin(role) || "MANAGER".equals(role) || "VIEWER".equals(role))
            return true;

        if ("UPCL_VIEWER".equals(role)) {
            return task.getIsInternal() == null || !task.getIsInternal();
        }

        if (task.getIsInternal() != null && task.getIsInternal()) {
            if ("CLIENT".equals(role))
                return false;
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
        if ("TESTER".equals(role)) {
            return task.getTesters().stream().anyMatch(t -> t.getUserId().equals(userId));
        }
        if ("DEPLOYER".equals(role)) {
            return task.getDeployers().stream().anyMatch(d -> d.getUserId().equals(userId));
        }
        return false;
    }

    // ── getTaskById ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> getTaskById(String id) {
        // Three focused queries — each loads exactly one bag collection.
        // Hibernate's first-level cache merges them into the same Task instance.
        taskRepository.findByIdWithManagers(id); // loads managers
        taskRepository.findByIdWithDevelopers(id); // loads developers
        taskRepository.findByIdWithVerifiers(id); // loads verifiers
        taskRepository.findByIdWithTesters(id); // loads testers
        taskRepository.findByIdWithDeployers(id); // loads deployers
        Task task = taskRepository.findById(id).orElse(null); // final fetch (comments/statusHistory/auditLogs lazy-load
                                                              // per task = fine for 1 entity)
        if (task == null)
            return null;
        Map<String, Object> normalized = normalizeTask(task);
        if (task.getAuditLogs() != null) {
            normalized.put("auditLogs", task.getAuditLogs().stream().map(l -> {
                Map<String, Object> am = new LinkedHashMap<>();
                am.put("logId", l.getLogId());
                am.put("taskId", l.getTaskId());
                am.put("fieldChanged", l.getFieldChanged());
                am.put("oldValue", l.getOldValue());
                am.put("newValue", l.getNewValue());
                am.put("reason", l.getReason());
                am.put("changedAt", l.getChangedAt());
                am.put("changedBy", l.getChangedBy());
                am.put("actor", normalizeUser(l.getActor()));
                return am;
            }).collect(Collectors.toList()));
        }
        return normalized;
    }

    public void checkReadPermission(Map<String, Object> task, String actorId, String role) {
        if (isAdmin(role) || "MANAGER".equals(role) || "VIEWER".equals(role))
            return;
        Boolean isInternal = (Boolean) task.get("isInternal");
        if ("UPCL_VIEWER".equals(role)) {
            if (isInternal != null && isInternal) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Forbidden: UPCL Viewers cannot access internal patches");
            }
            return;
        }
        if (isInternal != null && isInternal) {
            if ("CLIENT".equals(role))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Forbidden: Clients cannot access internal patches");
        }
        String clientId = (String) task.get("clientId");
        String authorId = (String) task.get("authorId");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> developers = (List<Map<String, Object>>) task.get("developers");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> verifiers = (List<Map<String, Object>>) task.get("verifiers");
        boolean ok = switch (role) {
            case "CLIENT" -> actorId.equals(clientId) || actorId.equals(authorId);
            case "DEVELOPER" -> developers.stream().anyMatch(d -> actorId.equals(d.get("userId")));
            case "VERIFIER" -> verifiers.stream().anyMatch(v -> actorId.equals(v.get("userId")));
            case "TESTER" -> {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> testers = (List<Map<String, Object>>) task.get("testers");
                yield testers != null && testers.stream().anyMatch(t -> actorId.equals(t.get("userId")));
            }
            case "DEPLOYER" -> {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> deployers = (List<Map<String, Object>>) task.get("deployers");
                yield deployers != null && deployers.stream().anyMatch(d -> actorId.equals(d.get("userId")));
            }
            default -> false;
        };
        if (!ok)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Forbidden: You do not have permission to view this patch");
    }

    // ── updateStatus ─────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> updateStatus(String taskId, String actorId, String newStatus, String reason) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        if (task.getLifecycleStatus() >= 100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot update a soft deleted patch");
        User actor = getActor(actorId);
        if ("VIEWER".equals(actor.getRole()) || "UPCL_VIEWER".equals(actor.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: Viewers cannot modify status");
        }
        String previousStatus = task.getStatus();
        validateStatusTransition(task, actor, newStatus);

        task.setStatus(newStatus);
        if ("IN_DEVELOPMENT".equals(newStatus) && task.getDateStarted() == null)
            task.setDateStarted(Instant.now());
        if (List.of("COMPLETED", "REJECTED", "CANCELLED").contains(newStatus))
            task.setDateEnded(Instant.now());
        else if (!List.of("COMPLETED", "REJECTED", "CANCELLED").contains(newStatus))
            task.setDateEnded(null);
        taskRepository.save(task);

        statusHistoryRepository.save(StatusHistory.builder()
                .taskId(taskId).previousStatus(previousStatus).newStatus(newStatus)
                .changedById(actorId).changedByName(actor.getName())
                .changedByUsername(actor.getUsername()).changedByRole(actor.getRole())
                .reason(reason != null ? reason : "Status changed to " + newStatus).build());

        auditLogRepository.save(AuditLog.builder()
                .taskId(taskId).changedBy(actorId).fieldChanged("Task Status")
                .oldValue(previousStatus).newValue(newStatus)
                .reason(reason != null ? reason : "Status changed from " + previousStatus + " to " + newStatus)
                .build());

        // Notifications
        sendStatusNotifications(task, newStatus, previousStatus, actorId);

        return getTaskById(taskId);
    }

    private void triggerNotifications(User recipient, String type, String msg) {
        if (recipient == null)
            return;

        // In-App Notification (always, which delegates queueing to
        // UPCLNotificationService)
        try {
            notificationService.createNotification(recipient.getUserId(), type, msg);
        } catch (Exception e) {
            // fail-safe
        }
    }

    private void sendStatusNotifications(Task task, String newStatus, String previousStatus, String actorId) {
        try {
            switch (newStatus) {
                case "PENDING_APPROVAL" ->
                    task.getManagers().forEach(m -> triggerNotifications(m, "TASK_PENDING_APPROVAL",
                            "Patch \"" + task.getTitle() + "\" is pending your review and approval."));
                case "ASSIGNED" -> {
                    task.getDevelopers().forEach(d -> triggerNotifications(d, "TASK_ASSIGNED",
                            "You have been assigned as Developer for patch: \"" + task.getTitle() + "\""));
                    task.getVerifiers().forEach(v -> triggerNotifications(v, "TASK_ASSIGNED",
                            "You have been assigned as Verifier for patch: \"" + task.getTitle() + "\""));
                    if (task.getClient() != null) {
                        triggerNotifications(task.getClient(), "TASK_ASSIGNED",
                                "Your patch request \"" + task.getTitle() + "\" has been approved and assigned.");
                    }
                }
                case "IN_DEVELOPMENT" -> task.getDevelopers().forEach(d -> triggerNotifications(d,
                        "TASK_IN_DEVELOPMENT", "Work has started on your task: \"" + task.getTitle() + "\"."));
                case "TESTING" -> task.getVerifiers().forEach(v -> triggerNotifications(v,
                        "TASK_PENDING_VERIFICATION", "Task \"" + task.getTitle() + "\" is ready for testing."));
                case "MANAGER_REVIEW" -> {
                    String msg = "Testing is complete for patch \"" + task.getTitle() + "\". Pending manager review.";
                    task.getManagers().forEach(m -> triggerNotifications(m, "TASK_MANAGER_REVIEW", msg));
                }
                case "DEPLOYMENT" -> {
                    String msg = "Patch \"" + task.getTitle() + "\" has been approved and is ready for deployment.";
                    if (task.getDeployerId() != null) {
                        userRepository.findById(task.getDeployerId()).ifPresent(dep -> triggerNotifications(dep, "TASK_DEPLOYMENT", msg));
                    } else {
                        task.getManagers().forEach(m -> triggerNotifications(m, "TASK_DEPLOYMENT", msg));
                    }
                }
                case "FINAL_TESTING_OF_PATCH" -> {
                    String msg = "Patch \"" + task.getTitle() + "\" has been deployed. Final testing pending.";
                    task.getVerifiers().forEach(v -> triggerNotifications(v, "TASK_FINAL_TESTING", msg));
                    if (task.getClient() != null) {
                        triggerNotifications(task.getClient(), "TASK_FINAL_TESTING", msg);
                    }
                }
                case "RETURNED_TO_DEVELOPER" ->
                    task.getDevelopers().forEach(d -> triggerNotifications(d, "TASK_RETURNED", "Task \""
                            + task.getTitle() + "\" failed verification and has been returned to you for rework."));
                case "COMPLETED" -> {
                    String msg = "Task \"" + task.getTitle() + "\" has been successfully verified and completed.";
                    task.getManagers().forEach(m -> triggerNotifications(m, "TASK_COMPLETED", msg));
                    task.getDevelopers().forEach(d -> triggerNotifications(d, "TASK_COMPLETED", msg));
                    task.getVerifiers().forEach(v -> triggerNotifications(v, "TASK_COMPLETED", msg));
                    task.getTesters().forEach(t -> triggerNotifications(t, "TASK_COMPLETED", msg));
                    task.getDeployers().forEach(d -> triggerNotifications(d, "TASK_COMPLETED", msg));
                    if (task.getClient() != null) {
                        triggerNotifications(task.getClient(), "TASK_FINALIZED",
                                "Your patch request \"" + task.getTitle() + "\" has been verified and completed.");
                    }
                }
                case "DELAYED" -> {
                    String msg = "Task \"" + task.getTitle() + "\" has been delayed.";
                    task.getManagers().forEach(m -> triggerNotifications(m, "TASK_DELAYED", msg));
                    task.getDevelopers().forEach(d -> triggerNotifications(d, "TASK_DELAYED", msg));
                    task.getVerifiers().forEach(v -> triggerNotifications(v, "TASK_DELAYED", msg));
                    task.getTesters().forEach(t -> triggerNotifications(t, "TASK_DELAYED", msg));
                    task.getDeployers().forEach(d -> triggerNotifications(d, "TASK_DELAYED", msg));
                    if (task.getClient() != null) {
                        triggerNotifications(task.getClient(), "TASK_DELAYED",
                                "Your patch request \"" + task.getTitle() + "\" has been delayed.");
                    }
                }
                case "ON_HOLD" -> {
                    String msg = "Task \"" + task.getTitle() + "\" has been put on hold.";
                    task.getManagers().forEach(m -> triggerNotifications(m, "TASK_ON_HOLD", msg));
                    if (task.getClient() != null) {
                        triggerNotifications(task.getClient(), "TASK_FINALIZED", "Your patch request \""
                                + task.getTitle() + "\" status has been updated to ON_HOLD.");
                    }
                }
                default -> {
                    if (task.getClient() != null && List.of("REJECTED", "CANCELLED").contains(newStatus)) {
                        triggerNotifications(task.getClient(), "TASK_FINALIZED", "Your patch request \""
                                + task.getTitle() + "\" status has been updated to " + newStatus + ".");
                    }
                }
            }

            // Enhanced Manager Notifications when patch changes stage:
            if (previousStatus != null && !previousStatus.equals(newStatus)) {
                String managerMsg = null;

                // 1. Developer -> Testing
                if ("TESTING".equals(newStatus) && "IN_DEVELOPMENT".equals(previousStatus)) {
                    managerMsg = "Patch \"" + task.getTitle() + "\" has completed development and entered Testing stage.";
                }
                // 2. Tester -> Manager Review
                else if ("MANAGER_REVIEW".equals(newStatus) && "TESTING".equals(previousStatus)) {
                    managerMsg = "Testing completed for patch \"" + task.getTitle() + "\". Pending your review.";
                }
                // 3. Manager -> Deployment
                else if ("DEPLOYMENT".equals(newStatus) && "MANAGER_REVIEW".equals(previousStatus)) {
                    managerMsg = "Patch \"" + task.getTitle() + "\" approved and transitioned to Deployment stage.";
                }
                // 4. Deployment Failed (Deployment -> In Development / On Hold)
                else if (("IN_DEVELOPMENT".equals(newStatus) || "ON_HOLD".equals(newStatus)) && "DEPLOYMENT".equals(previousStatus)) {
                    managerMsg = "Deployment failed for patch \"" + task.getTitle() + "\". Status updated to " + newStatus + ".";
                }
                // 5. Deployment Completed (Deployment -> Final Testing)
                else if ("FINAL_TESTING_OF_PATCH".equals(newStatus) && "DEPLOYMENT".equals(previousStatus)) {
                    managerMsg = "Deployment completed for patch \"" + task.getTitle() + "\". Transitioned to Final Testing.";
                }
                // 6. Final Testing Failed (Final Testing -> Manager Review)
                else if ("MANAGER_REVIEW".equals(newStatus) && "FINAL_TESTING_OF_PATCH".equals(previousStatus)) {
                    managerMsg = "Final testing failed for patch \"" + task.getTitle() + "\". Returned to Manager Review.";
                }
                // 7. Final Testing Completed (Final Testing -> Completed)
                else if ("COMPLETED".equals(newStatus) && "FINAL_TESTING_OF_PATCH".equals(previousStatus)) {
                    managerMsg = "Final testing completed. Patch \"" + task.getTitle() + "\" is successfully COMPLETED.";
                }
                // 8. Patch put On Hold
                else if ("ON_HOLD".equals(newStatus)) {
                    managerMsg = "Patch \"" + task.getTitle() + "\" has been put ON HOLD.";
                }

                if (managerMsg != null) {
                    final String finalMsg = managerMsg;
                    task.getManagers().forEach(m -> triggerNotifications(m, "TASK_STAGE_CHANGE", finalMsg));
                }
            }
        } catch (Exception ignored) {
        }
    }

    // ── addComment ───────────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> addComment(String taskId, String actorId, String content, Object files) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        if (task.getLifecycleStatus() >= 100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot comment on a soft deleted patch");
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

        // Trigger notifications if commenter is a manager or admin
        boolean isManager = "MANAGER".equals(actor.getRole()) || "ADMIN".equals(actor.getRole())
                || "SUPER_ADMIN".equals(actor.getRole()) ||
                task.getManagers().stream().anyMatch(m -> m.getUserId().equals(actorId));

        if (isManager) {
            String commentMsg = "Manager " + actor.getName() + " added a comment to patch \"" + task.getTitle() + "\": "
                    + content.trim();
            // Notify developers
            task.getDevelopers().forEach(d -> {
                try {
                    triggerNotifications(d, "MANAGER_COMMENT", commentMsg);
                } catch (Exception e) {
                    // fail-safe
                }
            });
        }

        return getTaskById(taskId);
    }

    // ── softDelete / restore ─────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> softDeleteTask(String taskId, String actorId) {
        User actor = getActor(actorId);
        if (!isAdmin(actor.getRole()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only ADMIN can delete patches");
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
        if (!isAdmin(actor.getRole()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only ADMIN can restore patches");
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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Tasks can only be assigned to Developers"));
        if (!"DEVELOPER".equals(assignee.getRole()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tasks can only be assigned to Developers");
        task.getDevelopers().add(assignee);
        taskRepository.save(task);
        auditLogRepository.save(AuditLog.builder().taskId(taskId).changedBy(actorId)
                .fieldChanged("Task Developers").newValue(assigneeId).reason("Added developer assignee").build());
        triggerNotifications(assignee, "TASK_ASSIGNED",
                "You've been assigned as developer to: \"" + task.getTitle() + "\"");
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

        boolean isAdmin = "SUPER_ADMIN".equals(role);
        if (!isAdmin) {
            if ("CLIENT".equals(role)) {
                if (!actorId.equals(task.getClientId()) && !actorId.equals(task.getAuthorId()))
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: You do not own this patch");
                if (!"DRAFT".equals(task.getStatus()))
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Forbidden: Cannot edit patches after submission");
                if (data.containsKey("plannedEndDate")) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Clients cannot set deadlines");
                }
                if (data.containsKey("plannedStartDate")) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Clients cannot set start dates");
                }
                if (data.containsKey("developerIds") || data.containsKey("developers") ||
                        data.containsKey("verifierIds") || data.containsKey("verifiers")) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Clients can only assign managers, not other resources");
                }
            } else {
                List<String> managerIds = task.getManagers().stream().map(User::getUserId).collect(Collectors.toList());
                boolean isTaskManager = managerIds.contains(actorId);
                List<String> devIds = task.getDevelopers().stream().map(User::getUserId).collect(Collectors.toList());
                boolean isTaskDeveloper = devIds.contains(actorId);
                List<String> testerIds = task.getTesters().stream().map(User::getUserId).collect(Collectors.toList());
                boolean isTaskTester = testerIds.contains(actorId);
                List<String> deployerIds = task.getDeployers().stream().map(User::getUserId).collect(Collectors.toList());
                boolean isTaskDeployer = deployerIds.contains(actorId);
                List<String> verifierIds = task.getVerifiers().stream().map(User::getUserId).collect(Collectors.toList());
                boolean isTaskVerifier = verifierIds.contains(actorId);

                boolean isAuthorized = false;
                String currentStatus = task.getStatus();

                if ("DRAFT".equals(currentStatus)) {
                    isAuthorized = actorId.equals(task.getClientId()) || actorId.equals(task.getAuthorId());
                } else if (List.of("PENDING_APPROVAL", "MANAGER_REVIEW").contains(currentStatus)) {
                    isAuthorized = "MANAGER".equals(role) && isTaskManager;
                } else if (List.of("ASSIGNED", "IN_DEVELOPMENT", "RETURNED_TO_DEVELOPER", "DELAYED").contains(currentStatus)) {
                    isAuthorized = "DEVELOPER".equals(role) && isTaskDeveloper;
                } else if ("TESTING".equals(currentStatus)) {
                    isAuthorized = "TESTER".equals(role) && isTaskTester;
                } else if ("DEPLOYMENT".equals(currentStatus)) {
                    isAuthorized = "DEPLOYER".equals(role) && (isTaskDeployer || actorId.equals(task.getDeployerId()));
                } else if ("FINAL_TESTING_OF_PATCH".equals(currentStatus)) {
                    isAuthorized = ("TESTER".equals(role) && isTaskTester) || ("VERIFIER".equals(role) && isTaskVerifier);
                } else if ("ON_HOLD".equals(currentStatus)) {
                    isAuthorized = ("DEVELOPER".equals(role) && isTaskDeveloper) || ("MANAGER".equals(role) && isTaskManager);
                }

                if (!isAuthorized) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Forbidden: You are not authorized to edit this patch at the current stage");
                }
            }
        }

        // Capture previous state
        Set<String> prevManagers = task.getManagers().stream().map(User::getUserId).collect(Collectors.toSet());
        Set<String> prevDevelopers = task.getDevelopers().stream().map(User::getUserId).collect(Collectors.toSet());
        Set<String> prevVerifiers = task.getVerifiers().stream().map(User::getUserId).collect(Collectors.toSet());
        Set<String> prevTesters = task.getTesters().stream().map(User::getUserId).collect(Collectors.toSet());
        Set<String> prevDeployers = task.getDeployers().stream().map(User::getUserId).collect(Collectors.toSet());
        String prevTitle = task.getTitle();
        String prevDescription = task.getDescription();
        String prevModuleId = task.getModuleId();
        Instant prevPlannedEndDate = task.getPlannedEndDate();

        String oldStatus = task.getStatus();

        if (data.containsKey("title"))
            task.setTitle((String) data.get("title"));
        if (data.containsKey("description"))
            task.setDescription((String) data.get("description"));
        if (data.containsKey("moduleId") && data.get("moduleId") != null) {
            assertModule((String) data.get("moduleId"));
            task.setModuleId((String) data.get("moduleId"));
        }
        if (data.containsKey("clientId"))
            task.setClientId((String) data.get("clientId"));
        if (data.containsKey("isInternal"))
            task.setIsInternal((Boolean) data.get("isInternal"));
        if (data.containsKey("dateGiven") && data.get("dateGiven") != null)
            task.setDateGiven(parseInstant((String) data.get("dateGiven"), null));
        if (data.containsKey("plannedStartDate") && data.get("plannedStartDate") != null)
            task.setPlannedStartDate(parseInstant((String) data.get("plannedStartDate"), null));
        if (data.containsKey("plannedEndDate") && data.get("plannedEndDate") != null)
            task.setPlannedEndDate(parseInstant((String) data.get("plannedEndDate"), null));
        if (data.containsKey("deployerId")) {
            String depId = (String) data.get("deployerId");
            if (depId != null && !depId.trim().isEmpty()) {
                assertActiveUser(depId, "deployerId");
                task.setDeployerId(depId);
            } else {
                task.setDeployerId(null);
            }
        }
        if (data.containsKey("rollbackPlan"))
            task.setRollbackPlan((String) data.get("rollbackPlan"));
        if (data.containsKey("deploymentTarget"))
            task.setDeploymentTarget((String) data.get("deploymentTarget"));

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
                    .reason((String) data.getOrDefault("reason",
                            "Status changed from " + oldStatus + " to " + newStatus))
                    .build());
        }

        task = taskRepository.save(task);

        boolean assignmentChanged = false;

        if (data.containsKey("managerIds") || data.containsKey("managerId")) {
            @SuppressWarnings("unchecked")
            List<String> ids = data.containsKey("managerIds") ? (List<String>) data.get("managerIds")
                    : List.of((String) data.get("managerId"));
            ids.forEach(id -> assertActiveUser(id, "managerId"));
            List<User> validUsers = userRepository.findAllById(ids);
            List<String> validIds = validUsers.stream().map(User::getUserId)
                    .collect(Collectors.toList());

            taskRepository.deactivateManagersByTaskId(taskId);
            validIds.forEach(id -> taskRepository.upsertManager(taskId, id));
            assignmentChanged = true;
        }
        if (data.containsKey("developerIds") || data.containsKey("developers")) {
            @SuppressWarnings("unchecked")
            List<String> ids = data.containsKey("developerIds") ? (List<String>) data.get("developerIds")
                    : (List<String>) data.get("developers");
            List<User> validUsers = userRepository.findAllById(ids);
            List<String> validIds = validUsers.stream().map(User::getUserId)
                    .collect(Collectors.toList());

            taskRepository.deactivateDevelopersByTaskId(taskId);
            validIds.forEach(id -> taskRepository.upsertDeveloper(taskId, id));
            assignmentChanged = true;
        }
        if (data.containsKey("verifierIds") || data.containsKey("verifiers")) {
            @SuppressWarnings("unchecked")
            List<String> ids = data.containsKey("verifierIds") ? (List<String>) data.get("verifierIds")
                    : (List<String>) data.get("verifiers");
            List<User> validUsers = userRepository.findAllById(ids);
            List<String> validIds = validUsers.stream().map(User::getUserId)
                    .collect(Collectors.toList());

            taskRepository.deactivateVerifiersByTaskId(taskId);
            validIds.forEach(id -> taskRepository.upsertVerifier(taskId, id));
            assignmentChanged = true;
        }
        if (data.containsKey("testerIds") || data.containsKey("testers")) {
            @SuppressWarnings("unchecked")
            List<String> ids = data.containsKey("testerIds") ? (List<String>) data.get("testerIds")
                    : (List<String>) data.get("testers");
            List<User> validUsers = userRepository.findAllById(ids);
            List<String> validIds = validUsers.stream().map(User::getUserId)
                    .collect(Collectors.toList());

            taskRepository.deactivateTestersByTaskId(taskId);
            validIds.forEach(id -> taskRepository.upsertTester(taskId, id));
            assignmentChanged = true;
        }
        if (data.containsKey("deployerIds") || data.containsKey("deployers")) {
            @SuppressWarnings("unchecked")
            List<String> ids = data.containsKey("deployerIds") ? (List<String>) data.get("deployerIds")
                    : (List<String>) data.get("deployers");
            List<User> validUsers = userRepository.findAllById(ids);
            List<String> validIds = validUsers.stream().map(User::getUserId)
                    .collect(Collectors.toList());

            taskRepository.deactivateDeployersByTaskId(taskId);
            validIds.forEach(id -> taskRepository.upsertDeployerToList(taskId, id));
            assignmentChanged = true;
        }

        if (assignmentChanged) {
            entityManager.detach(task);
            task = taskRepository.findById(taskId).orElseThrow();
        }

        // Fetch new states
        Set<String> newManagers = task.getManagers().stream().map(User::getUserId).collect(Collectors.toSet());
        Set<String> newDevelopers = task.getDevelopers().stream().map(User::getUserId).collect(Collectors.toSet());
        Set<String> newVerifiers = task.getVerifiers().stream().map(User::getUserId).collect(Collectors.toSet());
        Set<String> newTesters = task.getTesters().stream().map(User::getUserId).collect(Collectors.toSet());
        Set<String> newDeployers = task.getDeployers().stream().map(User::getUserId).collect(Collectors.toSet());

        // 1. Notify newly assigned resources
        final Task finalTask1 = task;
        List<User> addedManagers = userRepository.findAllById(
                newManagers.stream().filter(id -> !prevManagers.contains(id)).collect(Collectors.toList()));
        List<User> addedDevelopers = userRepository.findAllById(
                newDevelopers.stream().filter(id -> !prevDevelopers.contains(id)).collect(Collectors.toList()));
        List<User> addedVerifiers = userRepository.findAllById(
                newVerifiers.stream().filter(id -> !prevVerifiers.contains(id)).collect(Collectors.toList()));
        List<User> addedTesters = userRepository.findAllById(
                newTesters.stream().filter(id -> !prevTesters.contains(id)).collect(Collectors.toList()));
        List<User> addedDeployers = userRepository.findAllById(
                newDeployers.stream().filter(id -> !prevDeployers.contains(id)).collect(Collectors.toList()));

        addedManagers.forEach(m -> triggerNotifications(m, "TASK_ASSIGNED",
                "You have been assigned as Manager for patch: \"" + finalTask1.getTitle() + "\""));
        addedDevelopers.forEach(d -> triggerNotifications(d, "TASK_ASSIGNED",
                "You have been assigned as Developer for patch: \"" + finalTask1.getTitle() + "\""));
        addedVerifiers.forEach(v -> triggerNotifications(v, "TASK_ASSIGNED",
                "You have been assigned as Verifier for patch: \"" + finalTask1.getTitle() + "\""));
        addedTesters.forEach(t -> triggerNotifications(t, "TASK_ASSIGNED",
                "You have been assigned as Tester for patch: \"" + finalTask1.getTitle() + "\""));
        addedDeployers.forEach(d -> triggerNotifications(d, "TASK_ASSIGNED",
                "You have been assigned as Deployer for patch: \"" + finalTask1.getTitle() + "\""));

        // 2. Notify on field changes (title, description, module)
        boolean fieldsChanged = false;
        if (!Objects.equals(prevTitle, task.getTitle()))
            fieldsChanged = true;
        if (!Objects.equals(prevDescription, task.getDescription()))
            fieldsChanged = true;
        if (!Objects.equals(prevModuleId, task.getModuleId()))
            fieldsChanged = true;

        if (fieldsChanged) {
            String updateMsg = "Task \"" + task.getTitle() + "\" details have been updated.";
            task.getManagers().forEach(m -> triggerNotifications(m, "TASK_UPDATED", updateMsg));
            task.getDevelopers().forEach(d -> triggerNotifications(d, "TASK_UPDATED", updateMsg));
            task.getVerifiers().forEach(v -> triggerNotifications(v, "TASK_UPDATED", updateMsg));
            task.getTesters().forEach(t -> triggerNotifications(t, "TASK_UPDATED", updateMsg));
            task.getDeployers().forEach(d -> triggerNotifications(d, "TASK_UPDATED", updateMsg));
            if (task.getClient() != null) {
                triggerNotifications(task.getClient(), "TASK_UPDATED", updateMsg);
            }
        }

        // 3. Notify on deadline changes
        if (data.containsKey("plannedEndDate")) {
            Instant newPlannedEndDate = task.getPlannedEndDate();
            if (!Objects.equals(prevPlannedEndDate, newPlannedEndDate) && newPlannedEndDate != null) {
                String deadlineMsg = "A new deadline has been set for task \"" + task.getTitle() + "\": " +
                        java.time.format.DateTimeFormatter.ISO_LOCAL_DATE.withZone(java.time.ZoneOffset.UTC)
                                .format(newPlannedEndDate);
                task.getManagers().forEach(m -> triggerNotifications(m, "DEADLINE_UPDATED", deadlineMsg));
                task.getDevelopers().forEach(d -> triggerNotifications(d, "DEADLINE_UPDATED", deadlineMsg));
                task.getVerifiers().forEach(v -> triggerNotifications(v, "DEADLINE_UPDATED", deadlineMsg));
                task.getTesters().forEach(t -> triggerNotifications(t, "DEADLINE_UPDATED", deadlineMsg));
                task.getDeployers().forEach(d -> triggerNotifications(d, "DEADLINE_UPDATED", deadlineMsg));
                if (task.getClient() != null) {
                    triggerNotifications(task.getClient(), "DEADLINE_UPDATED", deadlineMsg);
                }
            }
        }

        if (newStatus != null && !newStatus.equals(oldStatus)) {
            sendStatusNotifications(task, newStatus, oldStatus, actorId);
        }

        return getTaskById(taskId);
    }

    @Transactional
    public Map<String, Object> uploadAttachment(String taskId, String uploaderId, MultipartFile file) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        if (task.getLifecycleStatus() >= 100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot upload to a soft deleted patch");

        // Client folder name
        String folderName = task.getClientId() != null ? task.getClientId() : "internal";

        // Root directory
        java.io.File rootDir = new java.io.File(uploadDir, folderName);
        if (!rootDir.exists()) {
            rootDir.mkdirs();
        }

        // Make file name unique to prevent collisions
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null)
            originalFilename = "file";
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
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to save file: " + e.getMessage(), e);
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
