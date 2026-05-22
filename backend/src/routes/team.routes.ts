import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import prisma from "../utils/prisma";
import { Request, Response } from "express";

const router = Router();
router.use(authenticate);

// GET /api/teams
router.get("/", async (_req: Request, res: Response) => {
  try {
    const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });
    res.json(teams);
  } catch (e) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
