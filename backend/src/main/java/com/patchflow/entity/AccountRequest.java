package com.patchflow.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Stores self-registration requests submitted from the public login page.
 * Only CLIENT and VIEWER roles are allowed.
 * An admin must approve or reject before a real User account is created.
 */
@Entity
@Table(name = "AccountRequest")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AccountRequest {

    @Id
    @Column(name = "id", length = 36, updatable = false, nullable = false)
    private String id;

    @Column(name = "username", nullable = false, unique = true)
    private String username;

    @Column(name = "passwordHash", nullable = false)
    private String passwordHash;

    @Column(name = "salt", nullable = false)
    private String salt;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "phone", length = 20)
    private String phone;

    /** Only CLIENT or VIEWER allowed via public signup. */
    @Column(name = "role", nullable = false)
    private String role;

    /** PENDING | APPROVED | REJECTED */
    @Column(name = "status", nullable = false)
    private String status;

    /** UserId of the admin who reviewed this request. */
    @Column(name = "reviewedBy", length = 36)
    private String reviewedBy;

    /** Optional note from admin (used on rejection). */
    @Column(name = "reviewNote", columnDefinition = "TEXT")
    private String reviewNote;

    @Builder.Default
    @Column(name = "createdAt", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "reviewedAt")
    private Instant reviewedAt;

    @PrePersist
    protected void onCreate() {
        if (this.id == null) this.id = java.util.UUID.randomUUID().toString();
        if (this.status == null) this.status = "PENDING";
        if (this.salt == null) this.salt = "BCrypt";
    }
}
