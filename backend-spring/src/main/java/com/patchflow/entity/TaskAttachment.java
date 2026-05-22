package com.patchflow.entity;

import com.patchflow.config.UUIDStringConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "\"TaskAttachment\"")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TaskAttachment {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "\"taskId\"", nullable = false)
    private String taskId;

    @Convert(converter = UUIDStringConverter.class)
    @Column(name = "\"uploaderId\"", columnDefinition = "uuid", nullable = false)
    private String uploaderId;

    @Column(name = "\"fileUrl\"", nullable = false)
    private String fileUrl;

    @Column(name = "\"fileName\"", nullable = false)
    private String fileName;

    @Column(name = "\"fileType\"", nullable = false)
    private String fileType;

    @Column(name = "size", nullable = false)
    private int size;

    @Column(name = "\"createdAt\"", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"taskId\"", insertable = false, updatable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"uploaderId\"", insertable = false, updatable = false)
    private User uploader;

    @PrePersist
    protected void onCreate() {
        if (this.id == null) this.id = java.util.UUID.randomUUID().toString();
    }
}
