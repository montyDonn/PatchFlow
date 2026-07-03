package com.patchflow.service;

import com.patchflow.entity.Notification;
import com.patchflow.repository.NotificationRepository;
import com.patchflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final UPCLNotificationService upclNotificationService;

    public Notification createNotification(String userId, String type, String message) {
        Notification n = Notification.builder()
                .userId(userId)
                .type(type)
                .message(message)
                .read(false)
                .build();
        Notification saved = notificationRepository.save(n);

        try {
            userRepository.findById(userId).ifPresent(user -> {
                upclNotificationService.queueNotification(user, type, message);
            });
        } catch (Exception e) {
            log.error("Failed to queue external notification for user: {}", userId, e);
        }

        return saved;
    }

    public List<Notification> getUserNotifications(String userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public Notification markAsRead(String notificationId, String userId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
        if (!n.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found");
        }
        n.setRead(true);
        return notificationRepository.save(n);
    }
}
