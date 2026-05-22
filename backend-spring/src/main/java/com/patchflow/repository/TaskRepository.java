package com.patchflow.repository;

import com.patchflow.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, String> {

    @Query("SELECT t FROM Task t LEFT JOIN FETCH t.author LEFT JOIN FETCH t.client " +
           "LEFT JOIN FETCH t.module LEFT JOIN FETCH t.team " +
           "WHERE t.lifecycleStatus < 100 ORDER BY t.createdAt DESC")
    List<Task> findAllActive();

    @Query("SELECT t FROM Task t WHERE t.id = :id")
    Optional<Task> findByIdBasic(@Param("id") String id);

    long countByModuleIdAndLifecycleStatusLessThan(String moduleId, int lifecycleStatus);

    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN FETCH t.author LEFT JOIN FETCH t.client " +
           "LEFT JOIN FETCH t.managers LEFT JOIN FETCH t.developers " +
           "LEFT JOIN FETCH t.verifiers LEFT JOIN FETCH t.module " +
           "LEFT JOIN FETCH t.team " +
           "WHERE t.lifecycleStatus < 100 ORDER BY t.createdAt DESC")
    List<Task> findAllActiveWithRelations();
}
