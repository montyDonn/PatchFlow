package com.patchflow.controller;

import com.patchflow.config.Auth;
import com.patchflow.entity.Team;
import com.patchflow.repository.TeamRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamController {

    private final TeamRepository teamRepository;

    @GetMapping
    public ResponseEntity<?> getTeams(HttpServletRequest req) {
        Auth.require(req);
        return ResponseEntity.ok(teamRepository.findAllByOrderByNameAsc());
    }
}
