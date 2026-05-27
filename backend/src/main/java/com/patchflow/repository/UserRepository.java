package com.patchflow.repository;

import com.patchflow.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByUsername(String username);
    boolean existsByUsername(String username);
    List<User> findByIsActiveTrueOrderByNameAsc();
    List<User> findAllByOrderByNameAsc();
    List<User> findByRoleAndIsActiveTrueOrderByNameAsc(String role);

    @Query("SELECT u FROM User u WHERE u.isActive = true ORDER BY u.name ASC")
    List<User> findAllActiveOrderByName();

    @Query("SELECT COUNT(u) FROM User u WHERE u.isActive = true")
    long countActiveUsers();
}
