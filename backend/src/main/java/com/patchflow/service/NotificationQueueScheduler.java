package com.patchflow.service;

import com.patchflow.entity.NotificationStack;
import com.patchflow.entity.User;
import com.patchflow.repository.NotificationStackRepository;
import com.patchflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationQueueScheduler {

    private final NotificationStackRepository notificationStackRepository;
    private final UserRepository userRepository;
    private final SmsSenderService smsSenderService;
    private final EmailSenderService emailSenderService;
    private final WhatsAppSenderService whatsAppSenderService;

    @Scheduled(fixedDelay = 10000) // Runs every 10 seconds
    public void processQueue() {
        List<NotificationStack> pendingItems = notificationStackRepository.findByStatusAndRetryCountLessThan("PENDING", 3);
        if (pendingItems.isEmpty()) {
            return;
        }

        log.info("Found {} pending external notifications to process", pendingItems.size());

        // Batch fetch users to prevent N+1 queries in the loop
        List<String> userIds = pendingItems.stream()
                .filter(item -> "SMS".equalsIgnoreCase(item.getChannel()))
                .map(NotificationStack::getRecipientId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();

        java.util.Map<String, User> userMap = new java.util.HashMap<>();
        if (!userIds.isEmpty()) {
            userRepository.findAllById(userIds).forEach(u -> userMap.put(u.getUserId(), u));
        }

        for (NotificationStack item : pendingItems) {
            try {
                log.debug("Processing notification ID: {}, Channel: {}, Recipient: {}", 
                        item.getId(), item.getChannel(), item.getRecipientInfo());

                switch (item.getChannel().toUpperCase()) {
                    case "EMAIL" -> {
                        String subject = item.getSubject() != null ? item.getSubject() : "PatchFlow Notification";
                        emailSenderService.sendEmail(item.getRecipientInfo(), subject, item.getMessageText());
                    }
                    case "SMS" -> {
                        User user = userMap.get(item.getRecipientId());
                        String name = user != null ? user.getName() : "User";
                        smsSenderService.sendSms(item.getRecipientInfo(), item.getMessageText(), name);
                    }
                    case "WHATSAPP" -> {
                        whatsAppSenderService.sendWhatsAppMessage(item.getRecipientInfo(), item.getMessageText());
                    }
                    default -> log.warn("Unsupported channel type: {}", item.getChannel());
                }

                item.setStatus("SENT");
                item.setProcessedAt(Instant.now());
                log.info("Successfully sent notification ID: {} via {}", item.getId(), item.getChannel());

            } catch (Exception e) {
                log.error("Failed to process notification ID: {} via {}", item.getId(), item.getChannel(), e);
                item.setRetryCount(item.getRetryCount() + 1);
                item.setErrorMessage(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
                if (item.getRetryCount() >= 3) {
                    item.setStatus("FAILED");
                    log.warn("Notification ID: {} has exceeded max retries and is marked as FAILED", item.getId());
                }
            } finally {
                try {
                    notificationStackRepository.save(item);
                } catch (Exception dbEx) {
                    log.error("Failed to update notification status in database for ID: {}", item.getId(), dbEx);
                }
            }
        }
    }
}
