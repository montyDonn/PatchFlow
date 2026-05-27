package com.patchflow.repository;

import com.patchflow.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TeamRepository extends JpaRepository<Team, String> {
    List<Team> findAllByOrderByNameAsc();
}
