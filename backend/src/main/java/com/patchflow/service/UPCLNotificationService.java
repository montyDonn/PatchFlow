package com.patchflow.service;

import com.patchflow.entity.NotificationStack;
import com.patchflow.entity.User;
import com.patchflow.repository.NotificationStackRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class UPCLNotificationService {

    private final NotificationStackRepository notificationStackRepository;

    @Transactional
    public void queueNotification(User recipient, String type, String message) {
        if (recipient == null) {
            return;
        }

        log.info("Queueing external notifications for user: {} (Role: {}), event type: {}", 
                recipient.getUserId(), recipient.getRole(), type);

        // 1. Email Channel
        if (recipient.isNotifyEmail() && recipient.getEmail() != null && !recipient.getEmail().trim().isEmpty()) {
            try {
                String subject = "PatchFlow Notification: " + type.replace("TASK_", "");
                NotificationStack emailStack = NotificationStack.builder()
                        .id(UUID.randomUUID().toString())
                        .recipientId(recipient.getUserId())
                        .channel("EMAIL")
                        .recipientInfo(recipient.getEmail().trim())
                        .subject(subject)
                        .messageText(message)
                        .status("PENDING")
                        .retryCount(0)
                        .createdAt(Instant.now())
                        .build();
                notificationStackRepository.save(emailStack);
                log.debug("Queued Email notification for user: {}", recipient.getUserId());
            } catch (Exception e) {
                log.error("Failed to queue Email notification for user: {}", recipient.getUserId(), e);
            }
        }

        // 2. SMS Channel
        if (recipient.isNotifySms() && recipient.getPhone() != null && !recipient.getPhone().trim().isEmpty()) {
            try {
                NotificationStack smsStack = NotificationStack.builder()
                        .id(UUID.randomUUID().toString())
                        .recipientId(recipient.getUserId())
                        .channel("SMS")
                        .recipientInfo(recipient.getPhone().trim())
                        .messageText(message)
                        .status("PENDING")
                        .retryCount(0)
                        .createdAt(Instant.now())
                        .build();
                notificationStackRepository.save(smsStack);
                log.debug("Queued SMS notification for user: {}", recipient.getUserId());
            } catch (Exception e) {
                log.error("Failed to queue SMS notification for user: {}", recipient.getUserId(), e);
            }
        }

        // 3. WhatsApp Channel
        if (recipient.isNotifyWhatsapp() && recipient.getPhone() != null && !recipient.getPhone().trim().isEmpty()) {
            try {
                NotificationStack whatsappStack = NotificationStack.builder()
                        .id(UUID.randomUUID().toString())
                        .recipientId(recipient.getUserId())
                        .channel("WHATSAPP")
                        .recipientInfo(recipient.getPhone().trim())
                        .messageText(message)
                        .status("PENDING")
                        .retryCount(0)
                        .createdAt(Instant.now())
                        .build();
                notificationStackRepository.save(whatsappStack);
                log.debug("Queued WhatsApp notification for user: {}", recipient.getUserId());
            } catch (Exception e) {
                log.error("Failed to queue WhatsApp notification for user: {}", recipient.getUserId(), e);
            }
        }
    }
}
