package com.patchflow.entity;

import com.patchflow.config.UUIDStringConverter;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.*;

import java.time.Instant;

@Entity
// @Table(name = "UserManager")
@Table(name = "change_req_UserManager")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserManager {

    @Id
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "userId", length = 36, nullable = false)
    private String userId;

    @Column(name = "managerId", length = 36, nullable = false)
    private String managerId;

    @Builder.Default
    @Column(name = "assignedAt", nullable = false, updatable = false)
    private Instant assignedAt = Instant.now();

    @Builder.Default
    // @Column(name = "isActive", nullable = false)
    // private boolean isActive = true;
    @Column(name = "isactive", nullable = false)
    private boolean isActive = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "managerId", insertable = false, updatable = false)
    private User manager;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "userId", insertable = false, updatable = false)
    private User user;

    @PrePersist
    protected void onCreate() {
        if (this.id == null)
            this.id = java.util.UUID.randomUUID().toString();
        if (this.assignedAt == null)
            this.assignedAt = Instant.now();
    }
}
