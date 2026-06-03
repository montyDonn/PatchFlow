package com.patchflow.repository;

import com.patchflow.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, String> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);
    boolean existsByUserIdAndTypeAndMessageContainingAndCreatedAtAfter(String userId, String type, String messageKeyword, Instant since);
}
