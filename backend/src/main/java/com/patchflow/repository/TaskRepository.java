package com.patchflow.repository;

import com.patchflow.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    // ── List view ────────────────────────────────────────────────────────────
    // IMPORTANT: Only ONE *-to-many bag per JOIN FETCH to avoid MultipleBagFetchException.
    // We fetch managers here (needed for access-control hasReadAccess checks).
    // developers & verifiers are loaded lazily but in batch via batch_fetch_size.
    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN FETCH t.author " +
           "LEFT JOIN FETCH t.client " +
           "LEFT JOIN FETCH t.managers " +
           "LEFT JOIN FETCH t.module " +
           "LEFT JOIN FETCH t.team " +
           "WHERE t.lifecycleStatus < 100 " +
           "ORDER BY t.createdAt DESC")
    List<Task> findAllActiveWithRelations();

    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN FETCH t.author " +
           "LEFT JOIN FETCH t.client " +
           "LEFT JOIN FETCH t.managers " +
           "LEFT JOIN FETCH t.module " +
           "LEFT JOIN FETCH t.team " +
           "ORDER BY t.createdAt DESC")
    List<Task> findAllWithRelations();

    // ── Detail view: three focused queries each fetching exactly one bag ────
    // Call these sequentially in getTaskById — Hibernate caches within the session.

    /** Fetch task + managers + module (no bags besides managers). */
    @Query("SELECT DISTINCT t FROM Task t " +
           "LEFT JOIN FETCH t.author " +
           "LEFT JOIN FETCH t.client " +
           "LEFT JOIN FETCH t.managers " +
           "LEFT JOIN FETCH t.module " +
           "LEFT JOIN FETCH t.team " +
           "WHERE t.id = :id")
    Optional<Task> findByIdWithManagers(@Param("id") String id);

    /** Fetch task + developers only. */
    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.developers WHERE t.id = :id")
    Optional<Task> findByIdWithDevelopers(@Param("id") String id);

    /** Fetch task + verifiers only. */
    @Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.verifiers WHERE t.id = :id")
    Optional<Task> findByIdWithVerifiers(@Param("id") String id);

    long countByModuleIdAndLifecycleStatusLessThan(String moduleId, int lifecycleStatus);

    @Query("SELECT MAX(t.id) FROM Task t WHERE t.id LIKE :prefix")
    String findMaxIdWithPrefix(@Param("prefix") String prefix);

    @Modifying
    @Query(value = "UPDATE change_req_TaskManagers SET is_active = false WHERE A = :taskId", nativeQuery = true)
    void deactivateManagersByTaskId(@Param("taskId") String taskId);

    @Modifying
    @Query(value = "INSERT INTO change_req_TaskManagers (A, B, is_active) VALUES (:taskId, :managerId, true) " +
                   "ON DUPLICATE KEY UPDATE is_active = true", nativeQuery = true)
    void upsertManager(@Param("taskId") String taskId, @Param("managerId") String managerId);

    @Modifying
    @Query(value = "UPDATE change_req_TaskDevelopers SET is_active = false WHERE A = :taskId", nativeQuery = true)
    void deactivateDevelopersByTaskId(@Param("taskId") String taskId);

    @Modifying
    @Query(value = "INSERT INTO change_req_TaskDevelopers (A, B, is_active) VALUES (:taskId, :developerId, true) " +
                   "ON DUPLICATE KEY UPDATE is_active = true", nativeQuery = true)
    void upsertDeveloper(@Param("taskId") String taskId, @Param("developerId") String developerId);

    @Modifying
    @Query(value = "UPDATE change_req_TaskVerifiers SET is_active = false WHERE A = :taskId", nativeQuery = true)
    void deactivateVerifiersByTaskId(@Param("taskId") String taskId);

    @Modifying
    @Query(value = "INSERT INTO change_req_TaskVerifiers (A, B, is_active) VALUES (:taskId, :verifierId, true) " +
                   "ON DUPLICATE KEY UPDATE is_active = true", nativeQuery = true)
    void upsertVerifier(@Param("taskId") String taskId, @Param("verifierId") String verifierId);
}
