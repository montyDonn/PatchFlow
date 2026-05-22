import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { username, password, name, role } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const result = await AuthService.register(username, password, name, role);
      return res.status(201).json(result);
    } catch (error: any) {
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

  static async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const result = await AuthService.login(username, password);
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.message === "Invalid credentials") {
        return res.status(401).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async getUsers(req: Request, res: Response) {
    try {
      const users = await AuthService.getUsers();
      return res.status(200).json(users);
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
