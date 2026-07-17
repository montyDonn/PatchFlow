package com.patchflow.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
// @Table(name = "AuditLog")
@Table(name = "change_req_AuditLog")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @Column(name = "logId", length = 36, updatable = false, nullable = false)
    private String logId;

    @Column(name = "changedBy", length = 36)
    private String changedBy;

    @Column(name = "targetUserId", length = 36)
    private String targetUserId;

    @Column(name = "fieldChanged", nullable = false)
    private String fieldChanged;

    @Column(name = "oldValue")
    private String oldValue;

    @Column(name = "newValue")
    private String newValue;

    @Builder.Default
    @Column(name = "changedAt", nullable = false, updatable = false)
    private Instant changedAt = Instant.now();

    @Column(name = "reason", nullable = false)
    private String reason;

    @Column(name = "taskId")
    private String taskId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changedBy", insertable = false, updatable = false)
    private User actor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "targetUserId", insertable = false, updatable = false)
    private User targetUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "taskId", insertable = false, updatable = false)
    private Task task;

    @PrePersist
    protected void onCreate() {
        if (this.logId == null)
            this.logId = java.util.UUID.randomUUID().toString();
        if (this.changedAt == null)
            this.changedAt = Instant.now();
    }
}
