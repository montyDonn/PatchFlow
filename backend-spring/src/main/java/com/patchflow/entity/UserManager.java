package com.patchflow.entity;

import com.patchflow.config.UUIDStringConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "UserManager")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserManager {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "userId", columnDefinition = "uuid", nullable = false)
    private String userId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "managerId", columnDefinition = "uuid", nullable = false)
    private String managerId;

    @Column(name = "assignedAt", nullable = false, updatable = false)
    private Instant assignedAt = Instant.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "managerId", insertable = false, updatable = false)
    private User manager;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "userId", insertable = false, updatable = false)
    private User user;

    @PrePersist
    protected void onCreate() {
        if (this.id == null) this.id = java.util.UUID.randomUUID().toString();
    }
}
