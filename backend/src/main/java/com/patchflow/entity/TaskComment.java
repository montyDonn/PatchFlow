package com.patchflow.entity;

import com.patchflow.config.UUIDStringConverter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;

@Entity
// @Table(name = "TaskComment")
@Table(name = "change_req_TaskComment")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TaskComment {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "taskId", nullable = false)
    private String taskId;

    @Column(name = "userId", length = 36, nullable = false)
    private String userId;

    @Column(name = "content", nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "authorName")
    private String authorName;

    @Column(name = "authorRole")
    private String authorRole;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "files", columnDefinition = "json")
    private List<String> files;

    @Builder.Default
    @Column(name = "createdAt", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "taskId", insertable = false, updatable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "userId", insertable = false, updatable = false)
    private User user;

    @PrePersist
    protected void onCreate() {
        if (this.id == null)
            this.id = java.util.UUID.randomUUID().toString();
        if (this.createdAt == null)
            this.createdAt = Instant.now();
    }
}
