"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const report_controller_1 = require("../controllers/report.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get('/history', auth_middleware_1.authenticate, report_controller_1.ReportController.getHistory);
router.get('/data', auth_middleware_1.authenticate, report_controller_1.ReportController.getReportData);
exports.default = router;
