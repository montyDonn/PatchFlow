package com.patchflow.repository;

import com.patchflow.entity.AppModule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AppModuleRepository extends JpaRepository<AppModule, String> {
    List<AppModule> findAllByOrderByModuleNameAsc();
    List<AppModule> findByIsActiveTrueOrderByModuleNameAsc();
    Optional<AppModule> findByModuleName(String moduleName);
    boolean existsByModuleName(String moduleName);
}
