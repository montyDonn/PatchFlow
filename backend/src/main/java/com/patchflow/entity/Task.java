package com.patchflow.entity;

import com.patchflow.config.UUIDStringConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "Task")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Task {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "clientRequestId", nullable = false)
    private int clientRequestId = 0;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description", nullable = false, columnDefinition = "text")
    private String description;

    @Column(name = "status", nullable = false)
    private String status = "DRAFT";

    @Column(name = "authorId", length = 36, nullable = false)
    private String authorId;

    @Column(name = "assigneeId", length = 36)
    private String assigneeId;

    @Column(name = "approverId", length = 36)
    private String approverId;

    @Column(name = "deployerId", length = 36)
    private String deployerId;

    @Column(name = "verifierId", length = 36)
    private String verifierId;

    @Column(name = "teamId")
    private String teamId;

    @Column(name = "moduleId", length = 36)
    private String moduleId;

    @Column(name = "assignedAt")
    private Instant assignedAt;

    @Column(name = "plannedStartDate")
    private Instant plannedStartDate;

    @Column(name = "plannedEndDate")
    private Instant plannedEndDate;

    @Column(name = "completedAt")
    private Instant completedAt;

    @Builder.Default
    @Column(name = "createdAt", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Builder.Default
    @Column(name = "updatedAt", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "lifecycleStatus", nullable = false)
    private int lifecycleStatus = 0;

    @Column(name = "clientId", length = 36)
    private String clientId;

    @Builder.Default
    @Column(name = "isInternal", nullable = false)
    private Boolean isInternal = false;

    @Column(name = "dateGiven")
    private Instant dateGiven;

    @Column(name = "dateStarted")
    private Instant dateStarted;

    @Column(name = "dateEnded")
    private Instant dateEnded;

    // ── Singular relations ───────────────────────────────────────────────────

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "authorId", insertable = false, updatable = false)
    private User author;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clientId", insertable = false, updatable = false)
    private User client;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approverId", insertable = false, updatable = false)
    private User approver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deployerId", insertable = false, updatable = false)
    private User deployer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "verifierId", insertable = false, updatable = false)
    private User verifier;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigneeId", insertable = false, updatable = false)
    private User assignee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "moduleId", insertable = false, updatable = false)
    private AppModule module;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teamId", insertable = false, updatable = false)
    private Team team;

    // ── Many-to-many ─────────────────────────────────────────────────────────

    @ManyToMany
    @JoinTable(
        name = "_TaskManagers",
        joinColumns = @JoinColumn(name = "A"),
        inverseJoinColumns = @JoinColumn(name = "B")
    )
    @Builder.Default
    private List<User> managers = new ArrayList<>();

    @ManyToMany
    @JoinTable(
        name = "_TaskDevelopers",
        joinColumns = @JoinColumn(name = "A"),
        inverseJoinColumns = @JoinColumn(name = "B")
    )
    @Builder.Default
    private List<User> developers = new ArrayList<>();

    @ManyToMany
    @JoinTable(
        name = "_TaskVerifiers",
        joinColumns = @JoinColumn(name = "A"),
        inverseJoinColumns = @JoinColumn(name = "B")
    )
    @Builder.Default
    private List<User> verifiers = new ArrayList<>();

    // ── Collections ──────────────────────────────────────────────────────────

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TaskComment> comments = new ArrayList<>();

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TaskAttachment> attachments = new ArrayList<>();

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    @Builder.Default
    private List<StatusHistory> statusHistory = new ArrayList<>();

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL)
    @OrderBy("changedAt ASC")
    @Builder.Default
    private List<AuditLog> auditLogs = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (this.id == null) this.id = java.util.UUID.randomUUID().toString();
        if (this.createdAt == null) this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() { this.updatedAt = Instant.now(); }
}
