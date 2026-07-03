package com.patchflow.repository;

import com.patchflow.entity.UserManager;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserManagerRepository extends JpaRepository<UserManager, String> {

    @Query(value = "SELECT * FROM \"UserManager\" WHERE \"managerId\" = :managerId AND \"isActive\" = true", nativeQuery = true)
    List<UserManager> findByManagerId(@Param("managerId") String managerId);

    @Query(value = "SELECT * FROM \"UserManager\" WHERE \"userId\" = :userId AND \"isActive\" = true", nativeQuery = true)
    List<UserManager> findByUserId(@Param("userId") String userId);

    @Modifying
    @Query(value = "UPDATE \"UserManager\" SET \"isActive\" = false WHERE \"userId\" = :userId", nativeQuery = true)
    void deleteByUserId(@Param("userId") String userId);

    Optional<UserManager> findByUserIdAndManagerId(String userId, String managerId);
}
