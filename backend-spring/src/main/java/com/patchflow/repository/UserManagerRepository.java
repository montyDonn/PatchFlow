package com.patchflow.repository;

import com.patchflow.entity.UserManager;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserManagerRepository extends JpaRepository<UserManager, String> {

    @Query(value = "SELECT * FROM \"UserManager\" WHERE \"managerId\" = CAST(:managerId AS uuid)", nativeQuery = true)
    List<UserManager> findByManagerId(@Param("managerId") String managerId);

    @Query(value = "SELECT * FROM \"UserManager\" WHERE \"userId\" = CAST(:userId AS uuid)", nativeQuery = true)
    List<UserManager> findByUserId(@Param("userId") String userId);

    @Modifying
    @Query(value = "DELETE FROM \"UserManager\" WHERE \"userId\" = CAST(:userId AS uuid)", nativeQuery = true)
    void deleteByUserId(@Param("userId") String userId);
}
