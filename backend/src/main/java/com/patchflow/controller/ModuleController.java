package com.patchflow.controller;

import com.patchflow.config.Auth;
import com.patchflow.entity.AppModule;
import com.patchflow.entity.Project;
import com.patchflow.entity.User;
import com.patchflow.repository.AppModuleRepository;
import com.patchflow.repository.ProjectRepository;
import com.patchflow.repository.TaskRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;


import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/modules")
@RequiredArgsConstructor
public class ModuleController {



    private final AppModuleRepository moduleRepository;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;

    private Project findOrCreateDefaultProject() {
        return projectRepository.findFirstBy().orElseGet(() ->
            projectRepository.save(Project.builder()
                    .projectName("PatchFlow Default Project")
                    .description("Auto-created default project for module management")
                    .build()));
    }

    private Map<String, Object> serialize(AppModule m) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", m.getModuleId());
        map.put("name", m.getModuleName());
        map.put("description", m.getDescription() != null ? m.getDescription() : "");
        map.put("isActive", m.isActive());
        map.put("projectId", m.getProjectId());
        if (m.getUsers() != null) {
            map.put("users", m.getUsers().stream().map(u -> {
                Map<String, Object> um = new LinkedHashMap<>();
                um.put("id", m.getModuleId() + "-" + u.getUserId());
                um.put("user", Map.of("id", u.getUserId(), "username", u.getUsername(), "name", u.getName(), "role", u.getRole()));
                return um;
            }).collect(Collectors.toList()));
        }
        return map;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> getModules(@RequestParam(defaultValue = "false") boolean includeUsers, HttpServletRequest req) {

        Auth.require(req);
        List<AppModule> modules = moduleRepository.findAllByOrderByModuleNameAsc();
        return ResponseEntity.ok(modules.stream().map(this::serialize).collect(Collectors.toList()));
    }

    @GetMapping("/hierarchy")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getHierarchy(HttpServletRequest req) {
        Auth.requireRole(req, "SUPER_ADMIN");
        List<AppModule> modules = moduleRepository.findAllByOrderByModuleNameAsc();
        List<Map<String, Object>> result = modules.stream().map(m -> {
            List<Map<String, Object>> assignments = m.getUsers().stream().map(u ->
                    Map.<String, Object>of("id", m.getModuleId() + "-" + u.getUserId(),
                            "user", Map.of("id", u.getUserId(), "username", u.getUsername(), "name", u.getName(), "role", u.getRole()))
            ).collect(Collectors.toList());
            List<Map<String, Object>> managers   = assignments.stream().filter(a -> List.of("MANAGER","ADMIN").contains(((Map<?,?>)a.get("user")).get("role"))).collect(Collectors.toList());
            List<Map<String, Object>> resources  = assignments.stream().filter(a -> "DEVELOPER".equals(((Map<?,?>)a.get("user")).get("role"))).collect(Collectors.toList());
            List<Map<String, Object>> deployers  = resources;
            List<Map<String, Object>> verifiers  = assignments.stream().filter(a -> "VERIFIER".equals(((Map<?,?>)a.get("user")).get("role"))).collect(Collectors.toList());
            Map<String, Object> h = new LinkedHashMap<>();
            h.put("id", m.getModuleId()); h.put("name", m.getModuleName());
            h.put("description", m.getDescription() != null ? m.getDescription() : ""); h.put("isActive", m.isActive());
            h.put("counts", Map.of("managers", managers.size(), "resources", resources.size(), "deployers", deployers.size(), "verifiers", verifiers.size(), "totalAssignments", assignments.size()));
            h.put("managers", managers); h.put("resources", resources); h.put("deployers", deployers); h.put("verifiers", verifiers);
            return h;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{moduleId}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getModule(@PathVariable String moduleId, HttpServletRequest req) {
        Auth.require(req);
        return moduleRepository.findById(moduleId)
                .map(m -> ResponseEntity.ok(serialize(m)))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).body(null));
    }

    @PostMapping
    public ResponseEntity<?> createModule(@RequestBody Map<String, String> body, HttpServletRequest req) {
        Auth.requireRole(req, "SUPER_ADMIN");
        String name = body.get("name");
        if (name == null || name.isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "Module name is required"));
        if (moduleRepository.existsByModuleName(name)) return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Module name must be unique"));
        Project project = findOrCreateDefaultProject();
        AppModule m = AppModule.builder()
                .moduleName(name).description(body.getOrDefault("description", ""))
                .projectId(project.getProjectId()).isActive(true).build();
        return ResponseEntity.status(HttpStatus.CREATED).body(serialize(moduleRepository.save(m)));
    }

    @PatchMapping("/{moduleId}")
    public ResponseEntity<?> updateModule(@PathVariable String moduleId, @RequestBody Map<String, Object> body, HttpServletRequest req) {
        Auth.requireRole(req, "SUPER_ADMIN");
        AppModule m = moduleRepository.findById(moduleId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found"));
        if (body.containsKey("name") && body.get("name") != null) m.setModuleName((String) body.get("name"));
        if (body.containsKey("description")) m.setDescription((String) body.get("description"));
        if (body.containsKey("isActive")) m.setActive((Boolean) body.get("isActive"));
        return ResponseEntity.ok(serialize(moduleRepository.save(m)));
    }

    @DeleteMapping("/{moduleId}")
    public ResponseEntity<?> deleteModule(@PathVariable String moduleId, HttpServletRequest req) {
        Auth.requireRole(req, "SUPER_ADMIN");
        AppModule m = moduleRepository.findById(moduleId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND, "Module not found"));
        long taskCount = taskRepository.countByModuleIdAndLifecycleStatusLessThan(moduleId, 100);
        if (taskCount > 0) return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "Cannot delete module: " + taskCount + " active patch(es) are linked to it. Deactivate the module instead."));
        m.setActive(false);
        moduleRepository.save(m);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
