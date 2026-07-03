package com.patchflow.config;
 
import com.patchflow.entity.*;
import com.patchflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
 
@Component
@Profile({"dev", "local"})
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {
 
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final AppModuleRepository moduleRepository;
    private final ProjectRepository projectRepository;
    private final JdbcTemplate jdbcTemplate;
    private final TaskRepository taskRepository;
    private final StatusHistoryRepository statusHistoryRepository;
    private final AuditLogRepository auditLogRepository;

    @Value("${app.upload-dir:./uploads}")
    private String uploadDir;
 
    /** Seed a user only if it doesn't already exist. */
    private void seedUser(String username, String name, String role, String designation, String password) {
        User u = userRepository.findByUsername(username).orElse(null);
        if (u == null) {
            u = User.builder()
                    .username(username)
                    .passwordHash(passwordEncoder.encode(password))
                    .role(role)
                    .name(name)
                    .designation(designation)
                    .isActive(true)
                    .build();
            userRepository.save(u);
        }
    }
 
    /** Seed a module only if the module name doesn't already exist. */
    private void seedModule(String name, String description) {
        if (!moduleRepository.existsByModuleName(name)) {
            Project project = projectRepository.findFirstBy().orElseGet(() ->
                projectRepository.save(Project.builder()
                        .projectName("Change Management Default Project")
                        .description("Default project for module management")
                        .build()));
            AppModule m = AppModule.builder()
                    .moduleName(name)
                    .description(description)
                    .projectId(project.getProjectId())
                    .isActive(true)
                    .build();
            moduleRepository.save(m);
        }
    }

    private void createDummyAttachmentFile(String folderName, String fileName, String content) {
        try {
            java.io.File dir = new java.io.File(uploadDir, folderName);
            if (!dir.exists()) {
                dir.mkdirs();
            }
            java.io.File file = new java.io.File(dir, fileName);
            java.nio.file.Files.writeString(file.toPath(), content);
        } catch (Exception e) {
            System.err.println("Failed to write dummy attachment file: " + e.getMessage());
        }
    }
 
    @Override
    public void run(String... args) throws Exception {


        // Skip seeder if running within JUnit tests to prevent multiple execution logs during maven build
        boolean isTest = java.util.Arrays.stream(Thread.currentThread().getStackTrace())
                .anyMatch(element -> element.getClassName().startsWith("org.junit."));
        if (isTest) {
            return;
        }

        // Clear all existing task-related data
        try {
            jdbcTemplate.execute("DELETE FROM \"TaskComment\"");
            jdbcTemplate.execute("DELETE FROM \"TaskAttachment\"");
            jdbcTemplate.execute("DELETE FROM \"StatusHistory\"");
            jdbcTemplate.execute("DELETE FROM \"AuditLog\"");
            jdbcTemplate.execute("DELETE FROM \"_TaskManagers\"");
            jdbcTemplate.execute("DELETE FROM \"_TaskDevelopers\"");
            jdbcTemplate.execute("DELETE FROM \"_TaskVerifiers\"");
            jdbcTemplate.execute("DELETE FROM \"Task\"");

        } catch (Exception e) {
            System.err.println("Error clearing task tables: " + e.getMessage());
        }

        // Run SQL schema checks/updates to add missing columns to the Task table (Commented out to avoid ACCESS EXCLUSIVE lock waits)
        /*
        try {
            jdbcTemplate.execute("ALTER TABLE \"Task\" ADD COLUMN IF NOT EXISTS \"isInternal\" boolean NOT NULL DEFAULT false");
            jdbcTemplate.execute("ALTER TABLE \"Task\" ADD COLUMN IF NOT EXISTS \"dateGiven\" timestamp with time zone");
            jdbcTemplate.execute("ALTER TABLE \"Task\" ADD COLUMN IF NOT EXISTS \"dateStarted\" timestamp with time zone");
            jdbcTemplate.execute("ALTER TABLE \"Task\" ADD COLUMN IF NOT EXISTS \"dateEnded\" timestamp with time zone");
        } catch (Exception e) {
            System.err.println("Note: Skipped or error in dynamic schema updates: " + e.getMessage());
        }
        */

        // ── Seed default modules ──────────────────────────────────────────────
        seedModule("NSC", "NSC Module");
        seedModule("DND", "DND Module");
        seedModule("CSC", "CSC Module");
        seedModule("BILLING", "BILLING Module");
        seedModule("METERING", "METERING Module");
        seedModule("FAM", "FAM Module");
        seedModule("MOBILE BILLING", "MOBILE BILLING Module");
        seedModule("REPORT", "REPORT Module");
        seedModule("INTEGRATION", "INTEGRATION Module");
        seedModule("SMART METER INTEGRATION", "SMART METER INTEGRATION Module");

        // Delete other modules to keep exactly and only the 10 requested modules
        java.util.Set<String> activeModuleNames = java.util.Set.of(
            "NSC", "DND", "CSC", "BILLING", "METERING", "FAM", "MOBILE BILLING", "REPORT", "INTEGRATION", "SMART METER INTEGRATION"
        );
        moduleRepository.findAll().forEach(mod -> {
            if (!activeModuleNames.contains(mod.getModuleName())) {
                // Set task module references to null to prevent foreign key constraint violations
                jdbcTemplate.update("UPDATE \"Task\" SET \"moduleId\" = NULL WHERE \"moduleId\" = ?", mod.getModuleId());
                moduleRepository.delete(mod);
            }
        });
 
        // ── System admin ──────────────────────────────────────────────────────
        seedUser("admin", "System Admin", "SUPER_ADMIN", "System Administrator", "upcl@123");
 
        // ── Demo users for client demo ────────────────────────────────────────
        // Credentials: username / upcl@123
        seedUser("komal",        "Komal",          "CLIENT",   "Client",               "upcl@123");
 
        // ── Managers ──────────────────────────────────────────────────────────
        seedUser("abhishek_rishi", "ABHISHEK_RISHI", "MANAGER", "Project Manager", "upcl@123");
        seedUser("prashantp",      "PRASHANTP",      "MANAGER", "Project Manager", "upcl@123");
        seedUser("abhishiek_r",    "ABHISHIEK_R",    "MANAGER", "Project Manager", "upcl@123");
        seedUser("manager1",       "Manager 1",      "MANAGER", "Project Manager", "upcl@123");

        // ── Developers ────────────────────────────────────────────────────────
        seedUser("siva",           "SIVA",           "DEVELOPER", "Software Developer", "upcl@123");
        seedUser("trinadh",        "TRINADH",        "DEVELOPER", "Software Developer", "upcl@123");
        seedUser("anukriti",       "ANUKRITI",       "DEVELOPER", "Software Developer", "upcl@123");
        seedUser("sachinp",        "SACHINP",        "DEVELOPER", "Software Developer", "upcl@123");
        seedUser("developer1",     "Developer 1",    "DEVELOPER", "Software Developer", "upcl@123");

        // ── Verifiers ─────────────────────────────────────────────────────────
        seedUser("pankaj",         "PANKAJ",         "VERIFIER", "QA Engineer", "upcl@123");
        seedUser("jagdish",        "JAGDISH",        "VERIFIER", "QA Engineer", "upcl@123");
        seedUser("verifier",       "verifier",       "VERIFIER", "QA Engineer", "upcl@123");
        seedUser("verifier1",      "Verifier 1",     "VERIFIER", "QA Engineer", "upcl@123");
 
        // ── Legacy demo accounts ──────────────────────────────────────────────
        seedUser("superadmin1",  "Super Admin 1",  "SUPER_ADMIN",       "Administrator",         "upcl@123");
        seedUser("admin1",       "Admin 1",        "VIEWER",      "Viewer Profile",        "upcl@123");
        seedUser("client1",      "Client 1",       "CLIENT",      "Client Profile",        "upcl@123");
        seedUser("upclviewer1",  "UPCL Viewer 1",   "UPCL_VIEWER", "UPCL Client Viewer",    "upcl@123");

        // ── Update existing users in the database ─────────────────────────────
        // Commented out to avoid bulk update DB latency/locks
        /*
        String defaultHash = passwordEncoder.encode("upcl@123");
        userRepository.findAll().forEach(user -> {
            user.setPasswordHash(defaultHash);
            
            // Force the primary admin account and superadmin1 to SUPER_ADMIN role
            if ("admin".equals(user.getUsername()) || "superadmin1".equals(user.getUsername())) {
                user.setRole("SUPER_ADMIN");
            } else if ("ADMIN".equals(user.getRole())) {
                user.setRole("VIEWER");
            }
            
            userRepository.save(user);
        });
        */

        // ── Seed test tasks ──────────────────────────────────────────────────

        User komalUser = userRepository.findByUsername("komal").orElse(null);
        User client1User = userRepository.findByUsername("client1").orElse(null);
        User abhishekRishiUser = userRepository.findByUsername("abhishek_rishi").orElse(null);
        User prashantpUser = userRepository.findByUsername("prashantp").orElse(null);
        User abhishiekRUser = userRepository.findByUsername("abhishiek_r").orElse(null);
        User manager1User = userRepository.findByUsername("manager1").orElse(null);
        User sivaUser = userRepository.findByUsername("siva").orElse(null);
        User trinadhUser = userRepository.findByUsername("trinadh").orElse(null);
        User anukritiUser = userRepository.findByUsername("anukriti").orElse(null);
        User sachinpUser = userRepository.findByUsername("sachinp").orElse(null);
        User pankajUser = userRepository.findByUsername("pankaj").orElse(null);
        User jagdishUser = userRepository.findByUsername("jagdish").orElse(null);
        User verifierUser = userRepository.findByUsername("verifier").orElse(null);

        AppModule nscModule = moduleRepository.findByModuleName("NSC").orElse(null);
        AppModule dndModule = moduleRepository.findByModuleName("DND").orElse(null);
        AppModule cscModule = moduleRepository.findByModuleName("CSC").orElse(null);
        AppModule meteringModule = moduleRepository.findByModuleName("METERING").orElse(null);



        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd");
        String prefix = java.time.LocalDate.now().format(formatter);

        // 1. Task test1: NSC module, status = DRAFT
        if (komalUser != null && nscModule != null) {
            String taskId = prefix + "0001";
            Task task1 = Task.builder()
                    .id(taskId)
                    .title("test1")
                    .description("Test Patch 1 - NSC Billing Interface [CHANGE_ID: " + taskId + "]")
                    .status("DRAFT")
                    .lifecycleStatus(0)
                    .authorId(komalUser.getUserId())
                    .clientId(komalUser.getUserId())
                    .clientRequestId(101)
                    .moduleId(nscModule.getModuleId())
                    .dateGiven(java.time.Instant.now())
                    .isInternal(false)
                    .managers(new java.util.ArrayList<>())
                    .developers(new java.util.ArrayList<>())
                    .verifiers(new java.util.ArrayList<>())
                    .build();

            task1 = taskRepository.save(task1);

            TaskComment comment = TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(komalUser.getUserId())
                    .content("Created the patch request for NSC module interface integration. Please review.")
                    .authorName(komalUser.getName())
                    .authorRole(komalUser.getRole())
                    .build();
            task1.getComments().add(comment);
            taskRepository.save(task1);

            statusHistoryRepository.save(StatusHistory.builder()
                    .taskId(taskId)
                    .previousStatus("DRAFT")
                    .newStatus("DRAFT")
                    .changedById(komalUser.getUserId())
                    .changedByName(komalUser.getName())
                    .changedByUsername(komalUser.getUsername())
                    .changedByRole(komalUser.getRole())
                    .reason("Task created in draft mode")
                    .build());
        }

        // 2. Task test2: DND module, status = IN_DEVELOPMENT
        if (client1User != null && dndModule != null && sivaUser != null && pankajUser != null && abhishekRishiUser != null && trinadhUser != null) {
            String taskId = prefix + "0002";
            Task task2 = Task.builder()
                    .id(taskId)
                    .title("test2")
                    .description("Test Patch 2 - DND Security Update [CHANGE_ID: " + taskId + "]")
                    .status("IN_DEVELOPMENT")
                    .lifecycleStatus(0)
                    .authorId(client1User.getUserId())
                    .clientId(client1User.getUserId())
                    .clientRequestId(102)
                    .moduleId(dndModule.getModuleId())
                    .dateGiven(java.time.Instant.now().minusSeconds(86400))
                    .dateStarted(java.time.Instant.now())
                    .isInternal(false)
                    .managers(new java.util.ArrayList<>(java.util.List.of(abhishekRishiUser)))
                    .developers(new java.util.ArrayList<>(java.util.List.of(sivaUser))) // siva remains, trinadh was removed
                    .verifiers(new java.util.ArrayList<>(java.util.List.of(pankajUser)))
                    .build();

            task2 = taskRepository.save(task2);

            task2.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(client1User.getUserId())
                    .content("Patch request submitted to assignment pool.")
                    .authorName(client1User.getName())
                    .authorRole(client1User.getRole())
                    .build());
            task2.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(abhishekRishiUser.getUserId())
                    .content("Assigned Siva and Trinadh for DND development, and Pankaj for QA verification.")
                    .authorName(abhishekRishiUser.getName())
                    .authorRole(abhishekRishiUser.getRole())
                    .build());
            task2.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(trinadhUser.getUserId())
                    .content("I've been pulled to work on a high-priority CSC issue. Please remove me from this task.")
                    .authorName(trinadhUser.getName())
                    .authorRole(trinadhUser.getRole())
                    .build());
            task2.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(abhishekRishiUser.getUserId())
                    .content("Removed Trinadh from this task. Siva will proceed with development.")
                    .authorName(abhishekRishiUser.getName())
                    .authorRole(abhishekRishiUser.getRole())
                    .build());
            task2.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(sivaUser.getUserId())
                    .content("Beginning development on safety filters.")
                    .authorName(sivaUser.getName())
                    .authorRole(sivaUser.getRole())
                    .build());

            // Add dummy file on disk & register TaskAttachment
            String uniqueName = "dnd_spec_" + System.currentTimeMillis() + ".pdf";
            createDummyAttachmentFile(client1User.getUserId(), uniqueName, "Dummy PDF content for DND spec.");
            task2.getAttachments().add(TaskAttachment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .uploaderId(client1User.getUserId())
                    .fileName("dnd_spec.pdf")
                    .fileUrl("/uploads/" + client1User.getUserId() + "/" + uniqueName)
                    .fileType("application/pdf")
                    .size(26)
                    .build());

            taskRepository.save(task2);

            statusHistoryRepository.save(StatusHistory.builder()
                    .taskId(taskId)
                    .previousStatus("DRAFT")
                    .newStatus("ASSIGNED")
                    .changedById(client1User.getUserId())
                    .changedByName(client1User.getName())
                    .changedByUsername(client1User.getUsername())
                    .changedByRole(client1User.getRole())
                    .reason("Submitted to assignment pool")
                    .build());

            statusHistoryRepository.save(StatusHistory.builder()
                    .taskId(taskId)
                    .previousStatus("ASSIGNED")
                    .newStatus("PENDING_APPROVAL")
                    .changedById(abhishekRishiUser.getUserId())
                    .changedByName(abhishekRishiUser.getName())
                    .changedByUsername(abhishekRishiUser.getUsername())
                    .changedByRole(abhishekRishiUser.getRole())
                    .reason("Assigned resources")
                    .build());

            statusHistoryRepository.save(StatusHistory.builder()
                    .taskId(taskId)
                    .previousStatus("PENDING_APPROVAL")
                    .newStatus("IN_DEVELOPMENT")
                    .changedById(abhishekRishiUser.getUserId())
                    .changedByName(abhishekRishiUser.getName())
                    .changedByUsername(abhishekRishiUser.getUsername())
                    .changedByRole(abhishekRishiUser.getRole())
                    .reason("Development process approved")
                    .build());
        }

        // 3. Task test3: CSC module, status = VERIFYING
        if (manager1User != null && cscModule != null && trinadhUser != null && anukritiUser != null && jagdishUser != null && sachinpUser != null && verifierUser != null) {
            String taskId = prefix + "0003";
            Task task3 = Task.builder()
                    .id(taskId)
                    .title("test3")
                    .description("Test Patch 3 - CSC Billing Verification [CHANGE_ID: " + taskId + "]")
                    .status("VERIFYING")
                    .lifecycleStatus(0)
                    .authorId(manager1User.getUserId())
                    .moduleId(cscModule.getModuleId())
                    .dateGiven(java.time.Instant.now().minusSeconds(2 * 86400))
                    .dateStarted(java.time.Instant.now().minusSeconds(86400))
                    .isInternal(true)
                    .managers(new java.util.ArrayList<>(java.util.List.of(manager1User)))
                    .developers(new java.util.ArrayList<>(java.util.List.of(anukritiUser, sachinpUser))) // trinadh was removed
                    .verifiers(new java.util.ArrayList<>(java.util.List.of(jagdishUser))) // verifier was removed
                    .build();

            task3 = taskRepository.save(task3);

            task3.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(manager1User.getUserId())
                    .content("Internal billing adjustments needed for CSC.")
                    .authorName(manager1User.getName())
                    .authorRole(manager1User.getRole())
                    .build());
            task3.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(manager1User.getUserId())
                    .content("Assigned Trinadh and Anukriti as developers. Assigned Jagdish as verifier.")
                    .authorName(manager1User.getName())
                    .authorRole(manager1User.getRole())
                    .build());
            task3.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(manager1User.getUserId())
                    .content("Wait, Trinadh is working on CSC, Sachin needs to help. Adding Sachin, removing Trinadh.")
                    .authorName(manager1User.getName())
                    .authorRole(manager1User.getRole())
                    .build());
            task3.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(sachinpUser.getUserId())
                    .content("Implemented custom triggers in CSC module. Ready for verification.")
                    .authorName(sachinpUser.getName())
                    .authorRole(sachinpUser.getRole())
                    .build());
            task3.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(anukritiUser.getUserId())
                    .content("Double checked code logic. Handing over to Jagdish.")
                    .authorName(anukritiUser.getName())
                    .authorRole(anukritiUser.getRole())
                    .build());
            task3.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(manager1User.getUserId())
                    .content("Adding Verifier 'verifier' to assist Jagdish with the verification load.")
                    .authorName(manager1User.getName())
                    .authorRole(manager1User.getRole())
                    .build());
            task3.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(verifierUser.getUserId())
                    .content("I have too many pending tasks. Jagdish, please take care of this solo. Manager, please remove me.")
                    .authorName(verifierUser.getName())
                    .authorRole(verifierUser.getRole())
                    .build());
            task3.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(manager1User.getUserId())
                    .content("Removed verifier from the task. Jagdish is the sole verifier.")
                    .authorName(manager1User.getName())
                    .authorRole(manager1User.getRole())
                    .build());
            task3.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(jagdishUser.getUserId())
                    .content("Starting QA verification on CSC module.")
                    .authorName(jagdishUser.getName())
                    .authorRole(jagdishUser.getRole())
                    .build());

            // Add dummy file on disk & register TaskAttachment
            String uniqueName = "test_report_" + System.currentTimeMillis() + ".json";
            createDummyAttachmentFile("internal", uniqueName, "{\"status\": \"passed\"}");
            task3.getAttachments().add(TaskAttachment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .uploaderId(anukritiUser.getUserId())
                    .fileName("test_report.json")
                    .fileUrl("/uploads/internal/" + uniqueName)
                    .fileType("application/json")
                    .size(20)
                    .build());

            taskRepository.save(task3);

            statusHistoryRepository.save(StatusHistory.builder()
                    .taskId(taskId)
                    .previousStatus("DRAFT")
                    .newStatus("ASSIGNED")
                    .changedById(manager1User.getUserId())
                    .changedByName(manager1User.getName())
                    .changedByUsername(manager1User.getUsername())
                    .changedByRole(manager1User.getRole())
                    .reason("Internal task created and assigned")
                    .build());

            statusHistoryRepository.save(StatusHistory.builder()
                    .taskId(taskId)
                    .previousStatus("ASSIGNED")
                    .newStatus("PENDING_APPROVAL")
                    .changedById(manager1User.getUserId())
                    .changedByName(manager1User.getName())
                    .changedByUsername(manager1User.getUsername())
                    .changedByRole(manager1User.getRole())
                    .reason("Resource validation")
                    .build());

            statusHistoryRepository.save(StatusHistory.builder()
                    .taskId(taskId)
                    .previousStatus("PENDING_APPROVAL")
                    .newStatus("IN_DEVELOPMENT")
                    .changedById(manager1User.getUserId())
                    .changedByName(manager1User.getName())
                    .changedByUsername(manager1User.getUsername())
                    .changedByRole(manager1User.getRole())
                    .reason("Development kicked off")
                    .build());

            statusHistoryRepository.save(StatusHistory.builder()
                    .taskId(taskId)
                    .previousStatus("IN_DEVELOPMENT")
                    .newStatus("VERIFYING")
                    .changedById(sachinpUser.getUserId())
                    .changedByName(sachinpUser.getName())
                    .changedByUsername(sachinpUser.getUsername())
                    .changedByRole(sachinpUser.getRole())
                    .reason("Triggers code committed")
                    .build());
        }

        // 4. Task test4: METERING module, status = COMPLETED
        if (client1User != null && meteringModule != null && sachinpUser != null && verifierUser != null && abhishiekRUser != null && prashantpUser != null) {
            String taskId = prefix + "0004";
            Task task4 = Task.builder()
                    .id(taskId)
                    .title("test4")
                    .description("Test Patch 4 - Metering Calibration Rollout [CHANGE_ID: " + taskId + "]")
                    .status("COMPLETED")
                    .lifecycleStatus(0)
                    .authorId(client1User.getUserId())
                    .clientId(client1User.getUserId())
                    .clientRequestId(103)
                    .moduleId(meteringModule.getModuleId())
                    .dateGiven(java.time.Instant.now().minusSeconds(5 * 86400))
                    .dateStarted(java.time.Instant.now().minusSeconds(4 * 86400))
                    .dateEnded(java.time.Instant.now().minusSeconds(86400))
                    .isInternal(false)
                    .managers(new java.util.ArrayList<>(java.util.List.of(abhishiekRUser))) // prashantp was removed
                    .developers(new java.util.ArrayList<>(java.util.List.of(sachinpUser)))
                    .verifiers(new java.util.ArrayList<>(java.util.List.of(verifierUser)))
                    .build();

            task4 = taskRepository.save(task4);

            task4.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(client1User.getUserId())
                    .content("Metering calibration script rollout.")
                    .authorName(client1User.getName())
                    .authorRole(client1User.getRole())
                    .build());
            task4.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(prashantpUser.getUserId())
                    .content("Assigned Sachin and verifier. I (prashantp) will manage.")
                    .authorName(prashantpUser.getName())
                    .authorRole(prashantpUser.getRole())
                    .build());
            task4.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(prashantpUser.getUserId())
                    .content("Handing over management of this task to Abhishiek R. Removing myself as manager.")
                    .authorName(prashantpUser.getName())
                    .authorRole(prashantpUser.getRole())
                    .build());
            task4.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(abhishiekRUser.getUserId())
                    .content("Abhishiek R taking over management. Confirmed prashantp is removed.")
                    .authorName(abhishiekRUser.getName())
                    .authorRole(abhishiekRUser.getRole())
                    .build());
            task4.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(sachinpUser.getUserId())
                    .content("Development complete.")
                    .authorName(sachinpUser.getName())
                    .authorRole(sachinpUser.getRole())
                    .build());
            task4.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(verifierUser.getUserId())
                    .content("QA verification passed successfully.")
                    .authorName(verifierUser.getName())
                    .authorRole(verifierUser.getRole())
                    .build());
            task4.getComments().add(TaskComment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .userId(abhishiekRUser.getUserId())
                    .content("Approved and marked completed.")
                    .authorName(abhishiekRUser.getName())
                    .authorRole(abhishiekRUser.getRole())
                    .build());

            // Add dummy file on disk & register TaskAttachment
            String uniqueName = "release_notes_" + System.currentTimeMillis() + ".txt";
            createDummyAttachmentFile(client1User.getUserId(), uniqueName, "Release notes content.");
            task4.getAttachments().add(TaskAttachment.builder()
                    .id(java.util.UUID.randomUUID().toString())
                    .taskId(taskId)
                    .uploaderId(sachinpUser.getUserId())
                    .fileName("release_notes.txt")
                    .fileUrl("/uploads/" + client1User.getUserId() + "/" + uniqueName)
                    .fileType("text/plain")
                    .size(21)
                    .build());

            taskRepository.save(task4);

            statusHistoryRepository.save(StatusHistory.builder()
                    .taskId(taskId)
                    .previousStatus("DRAFT")
                    .newStatus("ASSIGNED")
                    .changedById(client1User.getUserId())
                    .changedByName(client1User.getName())
                    .changedByUsername(client1User.getUsername())
                    .changedByRole(client1User.getRole())
                    .reason("Auto assigned")
                    .build());

            statusHistoryRepository.save(StatusHistory.builder()
                    .taskId(taskId)
                    .previousStatus("ASSIGNED")
                    .newStatus("PENDING_APPROVAL")
                    .changedById(prashantpUser.getUserId())
                    .changedByName(prashantpUser.getName())
                    .changedByUsername(prashantpUser.getUsername())
                    .changedByRole(prashantpUser.getRole())
                    .reason("Approved resources")
                    .build());

            statusHistoryRepository.save(StatusHistory.builder()
                    .taskId(taskId)
                    .previousStatus("PENDING_APPROVAL")
                    .newStatus("IN_DEVELOPMENT")
                    .changedById(prashantpUser.getUserId())
                    .changedByName(prashantpUser.getName())
                    .changedByUsername(prashantpUser.getUsername())
                    .changedByRole(prashantpUser.getRole())
                    .reason("Started development")
                    .build());

            statusHistoryRepository.save(StatusHistory.builder()
                    .taskId(taskId)
                    .previousStatus("IN_DEVELOPMENT")
                    .newStatus("VERIFYING")
                    .changedById(sachinpUser.getUserId())
                    .changedByName(sachinpUser.getName())
                    .changedByUsername(sachinpUser.getUsername())
                    .changedByRole(sachinpUser.getRole())
                    .reason("Metering calibration code submitted")
                    .build());

            statusHistoryRepository.save(StatusHistory.builder()
                    .taskId(taskId)
                    .previousStatus("VERIFYING")
                    .newStatus("COMPLETED")
                    .changedById(verifierUser.getUserId())
                    .changedByName(verifierUser.getName())
                    .changedByUsername(verifierUser.getUsername())
                    .changedByRole(verifierUser.getRole())
                    .reason("Verification checklist passed")
                    .build());
        }


    }
}
