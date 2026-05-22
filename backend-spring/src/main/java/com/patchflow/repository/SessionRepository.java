package com.patchflow.repository;

import com.patchflow.entity.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface SessionRepository extends JpaRepository<Session, String> {

    @Query(value = "SELECT * FROM \"Session\" s WHERE s.\"tokenHash\" = :tokenHash LIMIT 1", nativeQuery = true)
    Optional<Session> findByTokenHash(@Param("tokenHash") String tokenHash);

    @Modifying
    @Query(value = "DELETE FROM \"Session\" WHERE \"userId\" = CAST(:userId AS uuid) AND \"expiresAt\" < :now", nativeQuery = true)
    void deleteExpiredByUserId(@Param("userId") String userId, @Param("now") Instant now);

    @Modifying
    @Query(value = "DELETE FROM \"Session\" WHERE \"tokenHash\" = :tokenHash", nativeQuery = true)
    void deleteByTokenHash(@Param("tokenHash") String tokenHash);

    @Modifying
    @Query(value = "DELETE FROM \"Session\" WHERE \"userId\" = CAST(:userId AS uuid)", nativeQuery = true)
    void deleteAllByUserId(@Param("userId") String userId);
}
