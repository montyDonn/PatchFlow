package com.patchflow.entity;

import com.patchflow.config.UUIDStringConverter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "AuditLog")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuditLog {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "logId", columnDefinition = "uuid", updatable = false, nullable = false)
    private String logId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "changedBy", columnDefinition = "uuid")
    private String changedBy;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "targetUserId", columnDefinition = "uuid")
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
        if (this.logId == null) this.logId = java.util.UUID.randomUUID().toString();
        if (this.changedAt == null) this.changedAt = Instant.now();
    }
}
