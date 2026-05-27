package com.patchflow.config;
 
import com.patchflow.entity.*;
import com.patchflow.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
 
@Component
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
 
    /** Seed a user only if it doesn't already exist. */
    private void seedUser(String username, String name, String role, String designation, String password) {
        User u = userRepository.findByUsername(username).orElse(null);
        if (u == null) {
            u = User.builder()
                    .username(username)
                    .passwordHash(passwordEncoder.encode(password))
                    .salt("BCrypt")
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
            java.io.File dir = new java.io.File("uploads/" + folderName);
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
            System.out.println("Cleared all existing tasks and comments successfully.");
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
        seedUser("admin", "System Admin", "ADMIN", "System Administrator", "upcl@123");
 
        // ── Demo users for client demo ────────────────────────────────────────
        // Credentials: username / upcl@123
        seedUser("client1",        "Client 1",       "CLIENT",   "Client",               "upcl@123");
        seedUser("client2",        "Client 2",       "CLIENT",   "Client",               "upcl@123");
 
        // ── Managers ──────────────────────────────────────────────────────────
        seedUser("manager1",       "Manager 1",      "MANAGER", "Project Manager", "upcl@123");
        seedUser("manager2",       "Manager 2",      "MANAGER", "Project Manager", "upcl@123");
        seedUser("manager3",       "Manager 3",      "MANAGER", "Project Manager", "upcl@123");
        seedUser("manager4",       "Manager 4",      "MANAGER", "Project Manager", "upcl@123");

        // ── Developers ────────────────────────────────────────────────────────
        seedUser("developer1",     "Developer 1",    "DEVELOPER", "Software Developer", "upcl@123");
        seedUser("developer2",     "Developer 2",    "DEVELOPER", "Software Developer", "upcl@123");
        seedUser("developer3",     "Developer 3",    "DEVELOPER", "Software Developer", "upcl@123");
        seedUser("developer4",     "Developer 4",    "DEVELOPER", "Software Developer", "upcl@123");
        seedUser("developer5",     "Developer 5",    "DEVELOPER", "Software Developer", "upcl@123");

        // ── Verifiers ─────────────────────────────────────────────────────────
        seedUser("verifier1",      "Verifier 1",     "VERIFIER", "QA Engineer", "upcl@123");
        seedUser("verifier2",      "Verifier 2",     "VERIFIER", "QA Engineer", "upcl@123");
        seedUser("verifier3",      "Verifier 3",     "VERIFIER", "QA Engineer", "upcl@123");
        seedUser("verifier4",      "Verifier 4",     "VERIFIER", "QA Engineer", "upcl@123");
 
        // ── Legacy demo accounts ──────────────────────────────────────────────
        seedUser("superadmin1",  "Super Admin 1",  "ADMIN",       "Administrator",         "upcl@123");
        seedUser("admin1",       "Admin 1",        "VIEWER",      "Viewer Profile",        "upcl@123");
        seedUser("upclviewer1",  "UPCL Viewer 1",   "UPCL_VIEWER", "UPCL Client Viewer",    "upcl@123");

        // ── Update existing users in the database ─────────────────────────────
        // Commented out to avoid bulk update DB latency/locks
        /*
        String defaultHash = passwordEncoder.encode("upcl@123");
        userRepository.findAll().forEach(user -> {
            user.setPasswordHash(defaultHash);
            
            // Force the primary admin account and superadmin1 to ADMIN role
            if ("admin".equals(user.getUsername()) || "superadmin1".equals(user.getUsername())) {
                user.setRole("ADMIN");
            } else if ("SUPER_ADMIN".equals(user.getRole())) {
                user.setRole("ADMIN");
            } else if ("ADMIN".equals(user.getRole())) {
                user.setRole("VIEWER");
            }
            
            userRepository.save(user);
        });
        */

        System.out.println("Database users and modules successfully seeded and verified.");
    }
}
