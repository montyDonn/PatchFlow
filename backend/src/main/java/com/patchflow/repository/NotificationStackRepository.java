package com.patchflow.repository;

import com.patchflow.entity.NotificationStack;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NotificationStackRepository extends JpaRepository<NotificationStack, String> {
    List<NotificationStack> findByStatusAndRetryCountLessThan(String status, int maxRetries);
}
