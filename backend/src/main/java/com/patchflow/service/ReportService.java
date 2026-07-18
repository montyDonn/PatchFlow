package com.patchflow.service;

import com.patchflow.entity.Task;
import com.patchflow.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ReportService {

    private final TaskRepository taskRepository;

    public ReportService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> computeSummary(String startDate, String endDate, String moduleId,
                                             String clientId, String managerId, String developerId,
                                             String verifierId, String userId, String role) {
        // Fetch all active tasks with necessary relations
        List<Task> tasks = taskRepository.findAllActiveWithRelations();

        // Apply optional filters (simple Java filtering for now)
        if (startDate != null && !startDate.isEmpty()) {
            Instant start = Instant.parse(startDate + "T00:00:00Z");
            tasks = tasks.stream().filter(t -> t.getDateGiven() != null && !t.getDateGiven().isBefore(start)).collect(Collectors.toList());
        }
        if (endDate != null && !endDate.isEmpty()) {
            Instant end = Instant.parse(endDate + "T23:59:59Z");
            tasks = tasks.stream().filter(t -> t.getDateGiven() != null && !t.getDateGiven().isAfter(end)).collect(Collectors.toList());
        }
        if (moduleId != null && !moduleId.isEmpty()) {
            tasks = tasks.stream().filter(t -> moduleId.equals(t.getModuleId())).collect(Collectors.toList());
        }
        if (clientId != null && !clientId.isEmpty()) {
            tasks = tasks.stream().filter(t -> clientId.equals(t.getClientId())).collect(Collectors.toList());
        }
        // Role based ownership filters could be added similarly if needed.

        // Stage‑wise ageing (average days per status)
        Map<String, Double> stageAging = tasks.stream()
                .filter(t -> t.getDateGiven() != null)
                .collect(Collectors.groupingBy(Task::getStatus,
                        Collectors.averagingDouble(t -> {
                            Instant end = t.getDateEnded() != null ? t.getDateEnded() : Instant.now();
                            return Duration.between(t.getDateGiven(), end).toDays();
                        })));

        // Turnaround Time – average days from given to ended for completed tasks
        double turnaround = tasks.stream()
                .filter(t -> "COMPLETED".equals(t.getStatus()) && t.getDateGiven() != null && t.getDateEnded() != null)
                .mapToLong(t -> Duration.between(t.getDateGiven(), t.getDateEnded()).toDays())
                .average()
                .orElse(0.0);

        // Deployment Success Rate – percent of tasks that reached DEPLOYED status
        long total = tasks.size();
        long deployed = tasks.stream().filter(t -> "DEPLOYED".equals(t.getStatus())).count();
        double deploymentSuccess = total > 0 ? (deployed * 100.0 / total) : 0.0;

        // Team workload – count of tasks per role (managers, developers, verifiers)
        Map<String, Integer> workload = new HashMap<>();
        workload.put("MANAGERS", (int) tasks.stream().filter(t -> t.getManagers() != null && !t.getManagers().isEmpty()).count());
        workload.put("DEVELOPERS", (int) tasks.stream().filter(t -> t.getDevelopers() != null && !t.getDevelopers().isEmpty()).count());
        workload.put("VERIFIERS", (int) tasks.stream().filter(t -> t.getVerifiers() != null && !t.getVerifiers().isEmpty()).count());
        workload.put("TESTERS", (int) tasks.stream().filter(t -> t.getTesters() != null && !t.getTesters().isEmpty()).count());
        workload.put("DEPLOYERS", (int) tasks.stream().filter(t -> t.getDeployers() != null && !t.getDeployers().isEmpty()).count());

        Map<String, Object> summary = new HashMap<>();
        summary.put("stageAging", stageAging);
        summary.put("turnaroundTimeDays", turnaround);
        summary.put("deploymentSuccessRate", deploymentSuccess);
        summary.put("teamWorkload", workload);
        summary.put("totalTasks", total);
        return summary;
    }
}
