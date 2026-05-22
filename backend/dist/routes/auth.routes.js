"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.post("/register", auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)(["SUPER_ADMIN", "ADMIN"]), auth_controller_1.AuthController.register);
router.post("/login", auth_controller_1.AuthController.login);
// Example of a protected route
router.get("/me", auth_middleware_1.authenticate, (req, res) => {
    res.json({ user: req.user });
});
router.get("/users", auth_middleware_1.authenticate, auth_controller_1.AuthController.getUsers);
router.post("/logout", auth_middleware_1.authenticate, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(" ")[1];
        if (token) {
            const tokenHash = crypto_1.default.createHash("sha256").update(token).digest("hex");
            await prisma_1.default.session.deleteMany({ where: { tokenHash } });
        }
        return res.status(200).json({ success: true, message: "Logged out successfully" });
    }
    catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
