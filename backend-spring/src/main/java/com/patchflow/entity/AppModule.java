package com.patchflow.entity;

import com.patchflow.config.UUIDStringConverter;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "\"Module\"")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AppModule {

    @Id
    @Convert(converter = UUIDStringConverter.class)
    @Column(name = "\"moduleId\"", columnDefinition = "uuid", updatable = false, nullable = false)
    private String moduleId;

    @Convert(converter = UUIDStringConverter.class)
    @Column(name = "\"projectId\"", columnDefinition = "uuid", nullable = false)
    private String projectId;

    @Column(name = "\"moduleName\"", nullable = false, unique = true)
    private String moduleName;

    @Column(name = "description")
    private String description;

    @Column(name = "\"isActive\"", nullable = false)
    private boolean isActive = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "\"projectId\"", insertable = false, updatable = false)
    private Project project;

    @OneToMany(mappedBy = "module")
    @Builder.Default
    private List<Task> tasks = new ArrayList<>();

    @ManyToMany
    @JoinTable(
        name = "_ModuleToUser",
        joinColumns = @JoinColumn(name = "A"),
        inverseJoinColumns = @JoinColumn(name = "B")
    )
    @Builder.Default
    private List<User> users = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (this.moduleId == null) this.moduleId = java.util.UUID.randomUUID().toString();
    }
}
