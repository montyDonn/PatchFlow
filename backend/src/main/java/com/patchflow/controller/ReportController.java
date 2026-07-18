package com.patchflow.controller;

import com.patchflow.config.Auth;
import com.patchflow.entity.User;
import com.patchflow.service.ReportService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String moduleId,
            @RequestParam(required = false) String clientId,
            @RequestParam(required = false) String managerId,
            @RequestParam(required = false) String developerId,
            @RequestParam(required = false) String verifierId,
            HttpServletRequest req) {
        // Ensure request is authenticated
        User user = Auth.require(req);
        Map<String, Object> summary = reportService.computeSummary(startDate, endDate, moduleId,
                clientId, managerId, developerId, verifierId, user.getUserId(), user.getRole());
        return ResponseEntity.ok(summary);
    }
}
