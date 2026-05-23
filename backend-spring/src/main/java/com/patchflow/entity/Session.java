package com.patchflow.entity;

import com.patchflow.config.UUIDStringConverter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "Session")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Session {

    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "sessionId", columnDefinition = "uuid", updatable = false, nullable = false)
    private String sessionId;

    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "userId", columnDefinition = "uuid", nullable = false)
    private String userId;

    @Column(name = "tokenHash", nullable = false, unique = true)
    private String tokenHash;

    @Column(name = "expiresAt", nullable = false)
    private Instant expiresAt;

    @Builder.Default
    @Column(name = "createdAt", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "userId", insertable = false, updatable = false)
    private User user;

    @PrePersist
    protected void onCreate() {
        if (this.sessionId == null) this.sessionId = java.util.UUID.randomUUID().toString();
    }
}
