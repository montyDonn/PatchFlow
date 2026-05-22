package com.patchflow.entity;

import com.patchflow.config.UUIDStringConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "\"Task\"")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Task {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "\"clientRequestId\"", nullable = false)
    private int clientRequestId = 0;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description", nullable = false, columnDefinition = "text")
    private String description;

    @Column(name = "status", nullable = false)
    private String status = "DRAFT";

    @Convert(converter = UUIDStringConverter.class)
    @Column(name = "\"authorId\"", columnDefinition = "uuid", nullable = false)
    private String authorId;

    @Convert(converter = UUIDStringConverter.class)
    @Column(name = "\"assigneeId\"", columnDefinition = "uuid")
    private String assigneeId;

    @Convert(converter = UUIDStringConverter.class)
    @Column(name = "\"approverId\"", columnDefinition = "uuid")
    private String approverId;

    @Convert(converter = UUIDStringConverter.class)
    @Column(name = "\"deployerId\"", columnDefinition = "uuid")
    private String deployerId;

    @Convert(converter = UUIDStringConverter.class)
    @Column(name = "\"verifierId\"", columnDefinition = "uuid")
    private String verifierId;

    @Column(name = "\"teamId\"")
    private String teamId;

    @Convert(converter = UUIDStringConverter.class)
    @Column(name = "\"moduleId\"", columnDefinition = "uuid")
    private String moduleId;

    @Column(name = "\"assignedAt\"")
    private Instant assignedAt;

    @Column(name = "\"plannedStartDate\"")
    private Instant plannedStartDate;

    @Column(name = "\"plannedEndDate\"")
    private Instant plannedEndDate;

    @Column(name = "\"completedAt\"")
    private Instant completedAt;

    @Column(name = "\"createdAt\"", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "\"lifecycleStatus\"", nullable = false)
    private int lifecycleStatus = 0;

    @Convert(converter = UUIDStringConverter.class)
    @Column(name = "\"clientId\"", columnDefinition = "uuid")
    private String clientId;

    @Column(name = "\"dateGiven\"")
    private Instant dateGiven;

    @Column(name = "\"dateStarted\"")
    private Instant dateStarted;

    @Column(name = "\"dateEnded\"")
    private Instant dateEnded;

    // ── Singular relations ───────────────────────────────────────────────────

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"authorId\"", insertable = false, updatable = false)
    private User author;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"clientId\"", insertable = false, updatable = false)
    private User client;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"approverId\"", insertable = false, updatable = false)
    private User approver;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"deployerId\"", insertable = false, updatable = false)
    private User deployer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"verifierId\"", insertable = false, updatable = false)
    private User verifier;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"assigneeId\"", insertable = false, updatable = false)
    private User assignee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"moduleId\"", insertable = false, updatable = false)
    private AppModule module;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"teamId\"", insertable = false, updatable = false)
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
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() { this.updatedAt = Instant.now(); }
}
