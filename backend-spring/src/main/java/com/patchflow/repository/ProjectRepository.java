package com.patchflow.repository;

import com.patchflow.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, String> {
    Optional<Project> findFirstBy();
}
