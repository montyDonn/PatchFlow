import { Router } from "express";
import { authenticate, authorize, AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../utils/prisma";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";

const router = Router();
router.use(authenticate);

// GET /api/users  (optional ?role=RESOURCE filter, includeModules=true, includeInactive=true)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { role, includeModules, includeInactive } = req.query;
    const where: any = {};
    if (includeInactive !== 'true') where.isActive = true;
    if (role) where.role = role as string;
    
    const users = await prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      include: includeModules === 'true' ? {
        modules: true
      } : undefined,
    });

    res.json(users.map((user) => {
      const safeUser = user as any;
      return {
        id: user.userId,
        userId: user.userId,
        username: user.username,
        name: user.name,
        role: user.role,
        designation: user.designation,
        isActive: user.isActive,
        modules: includeModules === 'true' ? safeUser.modules.map((m: any) => ({
          id: m.moduleId,
          name: m.moduleName,
        })) : undefined,
      };
    }));
  } catch (e) {
    console.error('[user.routes] GET /api/users failed', e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:userId/modules
router.get('/:userId/modules', async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = String(req.params.userId);
    const userWithModules = await prisma.user.findUnique({
      where: { userId },
      include: { modules: { orderBy: { moduleName: 'asc' } } }
    });

    res.json((userWithModules?.modules || []).map((m: any) => ({
      id: `${userId}-${m.moduleId}`,
      module: {
        id: m.moduleId,
        name: m.moduleName,
      },
      assignedAt: new Date().toISOString(),
    })));
  } catch (e: any) {
    console.error('[user.routes] GET /api/users/:userId/modules failed', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update User Modules (max 5)
router.put("/:userId/modules", async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = String(req.params.userId);
    const { moduleIds, reason } = req.body;
    const callerId = (req as any).user?.userId;
    const role = (req as any).user?.role;

    if (role !== "ADMIN" && role !== "SUPER_ADMIN" && callerId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if ((role !== "ADMIN" && role !== "SUPER_ADMIN") && callerId === userId) {
      return res.status(403).json({ error: "Users cannot change their own modules" });
    }

    if (!Array.isArray(moduleIds) || moduleIds.length > 5) {
      return res.status(400).json({ error: "A user can be assigned to a maximum of 5 modules." });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { userId },
        data: {
          modules: {
            set: moduleIds.map((id: string) => ({ moduleId: id }))
          }
        }
      }),
      prisma.auditLog.create({
        data: {
          changedBy: callerId,
          targetUserId: userId as string,
          fieldChanged: "modules",
          newValue: moduleIds.join(","),
          reason: reason || "Admin updated user modules"
        }
      })
    ]);

    res.json({ success: true });
  } catch (e: any) {
    console.error('[user.routes] PUT /api/users/:userId/modules failed', e);
    res.status(500).json({ error: e.message });
  }
});

// Update User Managers (max 3)
router.put("/:userId/managers", async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    const { managerIds, reason } = req.body;
    const callerId = (req as any).user?.userId;
    const role = (req as any).user?.role;

    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Only admins can change managers" });
    }

    if (!Array.isArray(managerIds) || managerIds.length > 3) {
      return res.status(400).json({ error: "A user can be assigned to a maximum of 3 managers." });
    }

    await prisma.$transaction([
      prisma.userManager.deleteMany({ where: { userId: userId as string } }),
      prisma.userManager.createMany({
        data: managerIds.map((id: string) => ({
          userId: userId as string,
          managerId: id
        }))
      }),
      prisma.auditLog.create({
        data: {
          changedBy: callerId,
          targetUserId: userId as string,
          fieldChanged: "managers",
          newValue: managerIds.join(","),
          reason: reason || "Admin updated user managers"
        }
      })
    ]);

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Admin Reset Password
router.post("/:userId/reset-password", async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    const callerId = (req as any).user?.userId;
    const role = (req as any).user?.role;

    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const tempPassword = crypto.randomBytes(8).toString('hex');
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    await prisma.$transaction([
      prisma.user.update({
        where: { userId: userId as string },
        data: { passwordHash, salt }
      }),
      prisma.auditLog.create({
        data: {
          changedBy: callerId,
          targetUserId: userId as string,
          fieldChanged: "password",
          reason: "Admin reset user password"
        }
      }),
      prisma.session.deleteMany({ where: { userId: userId as string } })
    ]);

    res.json({ success: true, tempPassword });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Soft Delete User
router.delete("/:userId", async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    const callerId = (req as any).user?.userId;
    const role = (req as any).user?.role;

    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { userId: userId as string },
        data: { isActive: false }
      }),
      prisma.auditLog.create({
        data: {
          changedBy: callerId,
          targetUserId: userId as string,
          fieldChanged: "isActive",
          newValue: "false",
          reason: "Admin deactivated user"
        }
      }),
      prisma.session.deleteMany({ where: { userId: userId as string } })
    ]);

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Reactivate User
router.patch("/:userId/reactivate", async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    const callerId = (req as any).user?.userId;
    const role = (req as any).user?.role;

    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { userId: userId as string },
        data: { isActive: true }
      }),
      prisma.auditLog.create({
        data: {
          changedBy: callerId,
          targetUserId: userId as string,
          fieldChanged: "isActive",
          newValue: "true",
          reason: "Admin reactivated user"
        }
      }),
    ]);

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/:userId", async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId } = req.params;
    const { username, name, password, designation, role: newRole } = req.body;
    const callerId = (req as any).user?.userId;
    const role = (req as any).user?.role;

    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return res.status(403).json({ error: "Only admins can edit users" });
    }

    const existing = await prisma.user.findUnique({ where: { userId: userId as string } });
    if (!existing) return res.status(404).json({ error: "User not found" });

    const updates: any = {};
    const auditEntries: any[] = [];

    // Update username
    if (username && username !== existing.username) {
      const taken = await prisma.user.findUnique({ where: { username } });
      if (taken) return res.status(409).json({ error: "Username already taken" });
      updates.username = username;
      auditEntries.push({ fieldChanged: "username", oldValue: existing.username, newValue: username });
    }

    // Update name
    if (name && name !== existing.name) {
      updates.name = name;
      auditEntries.push({ fieldChanged: "name", oldValue: existing.name, newValue: name });
    }

    // Update password
    if (password) {
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);
      updates.passwordHash = passwordHash;
      updates.salt = salt;
      auditEntries.push({ fieldChanged: "password", oldValue: null, newValue: "updated" });
    }

    // Update designation
    if (designation !== undefined && designation !== existing.designation) {
      updates.designation = designation || null;
      auditEntries.push({ fieldChanged: "designation", oldValue: existing.designation, newValue: designation });
    }

    // Update role
    if (newRole && newRole !== existing.role) {
      updates.role = newRole;
      auditEntries.push({ fieldChanged: "role", oldValue: existing.role, newValue: newRole });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { userId: userId as string }, data: updates }),
      ...auditEntries.map((entry) =>
        prisma.auditLog.create({
          data: {
            changedBy: callerId,
            targetUserId: userId as string,
            fieldChanged: entry.fieldChanged,
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            reason: `Admin updated user ${entry.fieldChanged}`,
          },
        })
      ),
      // Invalidate sessions if username or password changed
      ...(updates.username || updates.passwordHash
        ? [prisma.session.deleteMany({ where: { userId: userId as string } })]
        : []),
    ]);

    const updatedUser = await prisma.user.findUnique({ where: { userId: userId as string } });
    return res.json({
      userId: updatedUser!.userId,
      username: updatedUser!.username,
      name: updatedUser!.name,
      role: updatedUser!.role,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/users — Admin creates a new user
router.post("/", authorize(["SUPER_ADMIN", "ADMIN"]), async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, password, name, role, designation } = req.body;
    const callerId = (req as any).user?.userId;

    if (!username || !password || !name) {
      return res.status(400).json({ error: "username, password, and name are required" });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          passwordHash,
          salt,
          name,
          role: role || "DEVELOPER",
          designation: designation || null,
          createdBy: callerId,
        },
      });

      await tx.auditLog.create({
        data: {
          changedBy: callerId,
          targetUserId: user.userId,
          fieldChanged: "account_created",
          newValue: username,
          reason: `Admin created new user account: ${username}`,
        },
      });

      return user;
    });

    return res.status(201).json({
      userId: newUser.userId,
      username: newUser.username,
      name: newUser.name,
      role: newUser.role,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
