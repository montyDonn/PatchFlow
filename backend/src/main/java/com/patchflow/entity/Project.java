package com.patchflow.entity;

import com.patchflow.config.UUIDStringConverter;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "Project")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Project {

    @Id
    @Column(name = "projectId", length = 36, updatable = false, nullable = false)
    private String projectId;

    @Column(name = "projectName", nullable = false)
    private String projectName;

    @Column(name = "description")
    private String description;

    @Column(name = "isActive", nullable = false)
    private boolean isActive = true;

    @Builder.Default
    @Column(name = "createdAt", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL)
    @Builder.Default
    private List<AppModule> modules = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (this.projectId == null) this.projectId = java.util.UUID.randomUUID().toString();
        if (this.createdAt == null) this.createdAt = Instant.now();
    }
}
