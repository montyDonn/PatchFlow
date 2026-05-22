package com.patchflow.entity;

import com.patchflow.config.UUIDStringConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "\"Notification\"")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Convert(converter = UUIDStringConverter.class)
    @Column(name = "\"userId\"", columnDefinition = "uuid", nullable = false)
    private String userId;

    @Column(name = "type", nullable = false)
    private String type;

    @Column(name = "message", nullable = false, columnDefinition = "text")
    private String message;

    @Column(name = "read", nullable = false)
    private boolean read = false;

    @Column(name = "\"createdAt\"", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"userId\"", insertable = false, updatable = false)
    private User user;

    @PrePersist
    protected void onCreate() {
        if (this.id == null) this.id = java.util.UUID.randomUUID().toString();
    }
}
