package com.patchflow.repository;

import com.patchflow.entity.AccountRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AccountRequestRepository extends JpaRepository<AccountRequest, String> {

    /** Find all requests with a given status (PENDING / APPROVED / REJECTED). */
    List<AccountRequest> findByStatusOrderByCreatedAtDesc(String status);

    /** Find all requests regardless of status, newest first. */
    List<AccountRequest> findAllByOrderByCreatedAtDesc();

    /** Check if a username is already claimed in the requests table. */
    boolean existsByUsername(String username);
}
