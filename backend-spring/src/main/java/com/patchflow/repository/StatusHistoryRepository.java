package com.patchflow.repository;

import com.patchflow.entity.StatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface StatusHistoryRepository extends JpaRepository<StatusHistory, String>, JpaSpecificationExecutor<StatusHistory> {
    List<StatusHistory> findByTaskIdOrderByCreatedAtAsc(String taskId);
}
