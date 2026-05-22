package com.patchflow.entity;

import com.patchflow.config.UUIDStringConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "\"Session\"")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Session {

    @Id
    @Convert(converter = UUIDStringConverter.class)
    @Column(name = "\"sessionId\"", columnDefinition = "uuid", updatable = false, nullable = false)
    private String sessionId;

    @Convert(converter = UUIDStringConverter.class)
    @Column(name = "\"userId\"", columnDefinition = "uuid", nullable = false)
    private String userId;

    @Column(name = "\"tokenHash\"", nullable = false, unique = true)
    private String tokenHash;

    @Column(name = "\"expiresAt\"", nullable = false)
    private Instant expiresAt;

    @Column(name = "\"createdAt\"", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"userId\"", insertable = false, updatable = false)
    private User user;

    @PrePersist
    protected void onCreate() {
        if (this.sessionId == null) this.sessionId = java.util.UUID.randomUUID().toString();
    }
}
