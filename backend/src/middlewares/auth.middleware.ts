import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import prisma from "../utils/prisma";

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; role: string; username: string };
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing token" });
    }

    const token = authHeader.split(" ")[1];
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const session = await prisma.session.findFirst({
      where: { tokenHash },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date() || !session.user.isActive) {
      return res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
    }

    // Opportunistically clean up other expired sessions for this user
    // Fire and forget — don't await, don't let it block the request
    prisma.session.deleteMany({
      where: {
        userId: session.userId,
        expiresAt: { lt: new Date() },
      },
    }).catch(() => {});

    req.user = { userId: session.user.userId, role: session.user.role, username: session.user.username };
    next();
  } catch (error) {
    return res.status(500).json({ error: "Internal server error in authentication" });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
    }
    next();
  };
};
