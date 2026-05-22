import { Router, Response } from "express";
import crypto from "crypto";
import prisma from "../utils/prisma";
import { AuthController } from "../controllers/auth.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", authenticate, authorize(["SUPER_ADMIN", "ADMIN"]), AuthController.register);
router.post("/login", AuthController.login);

// Example of a protected route
router.get("/me", authenticate, (req, res) => {
  res.json({ user: (req as any).user });
});

router.get("/users", authenticate, AuthController.getUsers);

router.post("/logout", authenticate, async (req: any, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    if (token) {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await prisma.session.deleteMany({ where: { tokenHash } });
    }
    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
