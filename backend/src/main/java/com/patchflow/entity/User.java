package com.patchflow.entity;

import com.patchflow.config.UUIDStringConverter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "User")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {

    @Id
    @Column(name = "userId", length = 36, updatable = false, nullable = false)
    private String userId;

    @Column(name = "username", nullable = false, unique = true)
    private String username;

    @Column(name = "passwordHash", nullable = false)
    private String passwordHash;

    @Column(name = "salt", nullable = false)
    private String salt;

    @Column(name = "role", nullable = false)
    private String role = "DEVELOPER";

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "designation")
    private String designation;

    @Column(name = "previousDesignation")
    private String previousDesignation;

    @Column(name = "isActive", nullable = false)
    private boolean isActive = true;

    @Builder.Default
    @Column(name = "createdAt", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Builder.Default
    @Column(name = "updatedAt", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "createdBy", length = 36)
    private String createdBy;

    // ── Relations ────────────────────────────────────────────────────────────

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Session> sessions = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Notification> notifications = new ArrayList<>();

    @ManyToMany(mappedBy = "users")
    @Builder.Default
    private List<AppModule> modules = new ArrayList<>();

    @OneToMany(mappedBy = "author")  @Builder.Default private List<Task> authoredTasks  = new ArrayList<>();
    @OneToMany(mappedBy = "client")  @Builder.Default private List<Task> clientTasks     = new ArrayList<>();
    @OneToMany(mappedBy = "approver") @Builder.Default private List<Task> approvedTasks  = new ArrayList<>();
    @OneToMany(mappedBy = "deployer") @Builder.Default private List<Task> deployedTasks  = new ArrayList<>();
    @OneToMany(mappedBy = "verifier") @Builder.Default private List<Task> verifiedTasks  = new ArrayList<>();
    @OneToMany(mappedBy = "assignee") @Builder.Default private List<Task> assignedTasks  = new ArrayList<>();

    @ManyToMany(mappedBy = "managers")   @Builder.Default private List<Task> managedTasks    = new ArrayList<>();
    @ManyToMany(mappedBy = "developers") @Builder.Default private List<Task> developerTasks  = new ArrayList<>();
    @ManyToMany(mappedBy = "verifiers")  @Builder.Default private List<Task> verifierTasks   = new ArrayList<>();

    @OneToMany(mappedBy = "manager", cascade = CascadeType.ALL)
    @Builder.Default private List<UserManager> managerAssignments = new ArrayList<>();

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    @Builder.Default private List<UserManager> userAssignments    = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (this.userId == null) this.userId = java.util.UUID.randomUUID().toString();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() { this.updatedAt = Instant.now(); }
}
