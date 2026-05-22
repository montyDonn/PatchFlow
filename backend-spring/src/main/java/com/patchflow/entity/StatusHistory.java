package com.patchflow.entity;

import com.patchflow.config.UUIDStringConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "\"StatusHistory\"")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StatusHistory {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "\"taskId\"", nullable = false)
    private String taskId;

    @Column(name = "\"previousStatus\"", nullable = false)
    private String previousStatus;

    @Column(name = "\"newStatus\"", nullable = false)
    private String newStatus;

    @Convert(converter = UUIDStringConverter.class)
    @Column(name = "\"changedById\"", columnDefinition = "uuid")
    private String changedById;

    @Column(name = "\"changedByName\"")
    private String changedByName;

    @Column(name = "\"changedByUsername\"")
    private String changedByUsername;

    @Column(name = "\"changedByRole\"")
    private String changedByRole;

    @Column(name = "reason")
    private String reason;

    @Column(name = "\"createdAt\"", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"taskId\"", insertable = false, updatable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"changedById\"", insertable = false, updatable = false)
    private User user;

    @PrePersist
    protected void onCreate() {
        if (this.id == null) this.id = java.util.UUID.randomUUID().toString();
    }
}
