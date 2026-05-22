"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
class AuthController {
    static async register(req, res) {
        try {
            const { username, password, name, role } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: "Username and password are required" });
            }
            if (!name) {
                return res.status(400).json({ error: "Name is required" });
            }
            const result = await auth_service_1.AuthService.register(username, password, name, role);
            return res.status(201).json(result);
        }
        catch (error) {
            // Log all details to help diagnose
            console.error('[AuthController.register] Error type:', error?.constructor?.name);
            console.error('[AuthController.register] Message:', error?.message);
            console.error('[AuthController.register] Code:', error?.code);
            if (error.message === "User already exists") {
                return res.status(409).json({ error: error.message });
            }
            if (error.message === "User limit of 50 reached.") {
                return res.status(400).json({ error: "User limit of 50 active accounts has been reached. Deactivate a user first." });
            }
            // Prisma unique constraint violation (P2002)
            if (error.code === 'P2002') {
                return res.status(409).json({ error: "Username already exists" });
            }
            return res.status(500).json({ error: error.message || "Internal server error" });
        }
    }
    static async login(req, res) {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: "Username and password are required" });
            }
            const result = await auth_service_1.AuthService.login(username, password);
            return res.status(200).json(result);
        }
        catch (error) {
            if (error.message === "Invalid credentials") {
                return res.status(401).json({ error: error.message });
            }
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    static async getUsers(req, res) {
        try {
            const users = await auth_service_1.AuthService.getUsers();
            return res.status(200).json(users);
        }
        catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    }
}
exports.AuthController = AuthController;
