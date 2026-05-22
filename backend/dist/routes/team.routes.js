"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const prisma_1 = __importDefault(require("../utils/prisma"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// GET /api/teams
router.get("/", async (_req, res) => {
    try {
        const teams = await prisma_1.default.team.findMany({ orderBy: { name: "asc" } });
        res.json(teams);
    }
    catch (e) {
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
