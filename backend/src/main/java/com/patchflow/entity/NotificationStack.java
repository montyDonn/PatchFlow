package com.patchflow.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "change_req_NotificationStack")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationStack {

    @Id
    @Column(name = "id", length = 36, nullable = false)
    private String id;

    @Column(name = "recipientId", length = 36, nullable = false)
    private String recipientId;

    @Column(name = "channel", length = 20, nullable = false)
    private String channel; // 'EMAIL', 'SMS', 'WHATSAPP'

    @Column(name = "recipientInfo", length = 255, nullable = false)
    private String recipientInfo; // Email address or Phone number

    @Column(name = "subject", length = 255)
    private String subject;

    @Column(name = "messageText", nullable = false, columnDefinition = "text")
    private String messageText;

    @Builder.Default
    @Column(name = "status", length = 20, nullable = false)
    private String status = "PENDING"; // 'PENDING', 'SENT', 'FAILED'

    @Column(name = "errorMessage", columnDefinition = "text")
    private String errorMessage;

    @Builder.Default
    @Column(name = "retryCount", nullable = false)
    private int retryCount = 0;

    @Builder.Default
    @Column(name = "createdAt", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "processedAt")
    private Instant processedAt;

    @PrePersist
    protected void onCreate() {
        if (this.id == null) {
            this.id = java.util.UUID.randomUUID().toString();
        }
        if (this.createdAt == null) {
            this.createdAt = Instant.now();
        }
    }
}
