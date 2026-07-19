package com.patchflow.service;

import com.patchflow.entity.Task;
import com.patchflow.entity.User;
import com.patchflow.repository.TaskRepository;
import com.patchflow.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeadlineReminderScheduler {

    private final TaskRepository taskRepository;
    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;

    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void checkAndSendDeadlineReminders() {
        log.info("Running deadline reminder background check...");
        Instant now = Instant.now();
        Instant fortyEightHoursFromNow = now.plus(48, ChronoUnit.HOURS);

        // Preload lazy collections to utilize first-level cache and avoid N+1 queries in loop
        taskRepository.findAllActiveWithDevelopers();
        taskRepository.findAllActiveWithVerifiers();

        // Fetch all active tasks
        List<Task> activeTasks = taskRepository.findAllActiveWithRelations();

        for (Task task : activeTasks) {
            Instant deadline = task.getPlannedEndDate();
            if (deadline == null) continue;

            // Skip terminal statuses
            if (List.of("COMPLETED", "REJECTED", "CANCELLED").contains(task.getStatus())) {
                continue;
            }

            boolean isOverdue = deadline.isBefore(now);
            boolean isApproaching = deadline.isAfter(now) && deadline.isBefore(fortyEightHoursFromNow);

            if (isOverdue || isApproaching) {
                // Eagerly trigger lazy loaders in the transactional context
                int devSize = task.getDevelopers().size();
                int verSize = task.getVerifiers().size();

                String messageKeyword = "[Task ID: " + task.getId() + "]";
                String message;
                if (isOverdue) {
                    message = "OVERDUE REMINDER: Task \"" + task.getTitle() + "\" has passed its deadline (" + 
                        java.time.format.DateTimeFormatter.ISO_LOCAL_DATE.withZone(java.time.ZoneOffset.UTC).format(deadline) + "). " + messageKeyword;
                } else {
                    message = "DEADLINE REMINDER: Task \"" + task.getTitle() + "\" is approaching its deadline on " + 
                        java.time.format.DateTimeFormatter.ISO_LOCAL_DATE.withZone(java.time.ZoneOffset.UTC).format(deadline) + ". " + messageKeyword;
                }

                // Notify managers
                for (User manager : task.getManagers()) {
                    sendReminderIfNotSentToday(manager.getUserId(), message, task.getId());
                }
                // Notify developers
                for (User dev : task.getDevelopers()) {
                    sendReminderIfNotSentToday(dev.getUserId(), message, task.getId());
                }
                // Notify verifiers
                for (User ver : task.getVerifiers()) {
                    sendReminderIfNotSentToday(ver.getUserId(), message, task.getId());
                }
                // Notify client
                if (task.getClientId() != null) {
                    sendReminderIfNotSentToday(task.getClientId(), message, task.getId());
                }
            }
        }
    }

    private void sendReminderIfNotSentToday(String userId, String message, String taskId) {
        Instant since = Instant.now().minus(23, ChronoUnit.HOURS);
        boolean exists = notificationRepository.existsByUserIdAndTypeAndMessageContainingAndCreatedAtAfter(
                userId, "DEADLINE_REMINDER", "[Task ID: " + taskId + "]", since);
        if (!exists) {
            notificationService.createNotification(userId, "DEADLINE_REMINDER", message);
            log.info("Sent deadline reminder for task {} to user {}", taskId, userId);
        }
    }
}
