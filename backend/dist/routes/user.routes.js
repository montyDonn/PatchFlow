"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const prisma_1 = __importDefault(require("../utils/prisma"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// GET /api/users  (optional ?role=RESOURCE filter, includeModules=true, includeInactive=true)
router.get("/", async (req, res) => {
    try {
        const { role, includeModules, includeInactive } = req.query;
        const where = {};
        if (includeInactive !== 'true')
            where.isActive = true;
        if (role)
            where.role = role;
        const users = await prisma_1.default.user.findMany({
            where,
            orderBy: { name: "asc" },
            include: includeModules === 'true' ? {
                modules: true
            } : undefined,
        });
        res.json(users.map((user) => {
            const safeUser = user;
            return {
                id: user.userId,
                userId: user.userId,
                username: user.username,
                name: user.name,
                role: user.role,
                designation: user.designation,
                isActive: user.isActive,
                modules: includeModules === 'true' ? safeUser.modules.map((m) => ({
                    id: m.moduleId,
                    name: m.moduleName,
                })) : undefined,
            };
        }));
    }
    catch (e) {
        console.error('[user.routes] GET /api/users failed', e);
        res.status(500).json({ error: "Internal server error" });
    }
});
// GET /api/users/:userId/modules
router.get('/:userId/modules', async (req, res) => {
    try {
        const userId = String(req.params.userId);
        const userWithModules = await prisma_1.default.user.findUnique({
            where: { userId },
            include: { modules: { orderBy: { moduleName: 'asc' } } }
        });
        res.json((userWithModules?.modules || []).map((m) => ({
            id: `${userId}-${m.moduleId}`,
            module: {
                id: m.moduleId,
                name: m.moduleName,
            },
            assignedAt: new Date().toISOString(),
        })));
    }
    catch (e) {
        console.error('[user.routes] GET /api/users/:userId/modules failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update User Modules (max 5)
router.put("/:userId/modules", async (req, res) => {
    try {
        const userId = String(req.params.userId);
        const { moduleIds, reason } = req.body;
        const callerId = req.user?.userId;
        const role = req.user?.role;
        if (role !== "ADMIN" && role !== "SUPER_ADMIN" && callerId !== userId) {
            return res.status(403).json({ error: "Forbidden" });
        }
        if ((role !== "ADMIN" && role !== "SUPER_ADMIN") && callerId === userId) {
            return res.status(403).json({ error: "Users cannot change their own modules" });
        }
        if (!Array.isArray(moduleIds) || moduleIds.length > 5) {
            return res.status(400).json({ error: "A user can be assigned to a maximum of 5 modules." });
        }
        await prisma_1.default.$transaction([
            prisma_1.default.user.update({
                where: { userId },
                data: {
                    modules: {
                        set: moduleIds.map((id) => ({ moduleId: id }))
                    }
                }
            }),
            prisma_1.default.auditLog.create({
                data: {
                    changedBy: callerId,
                    targetUserId: userId,
                    fieldChanged: "modules",
                    newValue: moduleIds.join(","),
                    reason: reason || "Admin updated user modules"
                }
            })
        ]);
        res.json({ success: true });
    }
    catch (e) {
        console.error('[user.routes] PUT /api/users/:userId/modules failed', e);
        res.status(500).json({ error: e.message });
    }
});
// Update User Managers (max 3)
router.put("/:userId/managers", async (req, res) => {
    try {
        const { userId } = req.params;
        const { managerIds, reason } = req.body;
        const callerId = req.user?.userId;
        const role = req.user?.role;
        if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
            return res.status(403).json({ error: "Only admins can change managers" });
        }
        if (!Array.isArray(managerIds) || managerIds.length > 3) {
            return res.status(400).json({ error: "A user can be assigned to a maximum of 3 managers." });
        }
        await prisma_1.default.$transaction([
            prisma_1.default.userManager.deleteMany({ where: { userId: userId } }),
            prisma_1.default.userManager.createMany({
                data: managerIds.map((id) => ({
                    userId: userId,
                    managerId: id
                }))
            }),
            prisma_1.default.auditLog.create({
                data: {
                    changedBy: callerId,
                    targetUserId: userId,
                    fieldChanged: "managers",
                    newValue: managerIds.join(","),
                    reason: reason || "Admin updated user managers"
                }
            })
        ]);
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Admin Reset Password
router.post("/:userId/reset-password", async (req, res) => {
    try {
        const { userId } = req.params;
        const callerId = req.user?.userId;
        const role = req.user?.role;
        if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
            return res.status(403).json({ error: "Forbidden" });
        }
        const tempPassword = crypto_1.default.randomBytes(8).toString('hex');
        const salt = await bcrypt_1.default.genSalt(12);
        const passwordHash = await bcrypt_1.default.hash(tempPassword, salt);
        await prisma_1.default.$transaction([
            prisma_1.default.user.update({
                where: { userId: userId },
                data: { passwordHash, salt }
            }),
            prisma_1.default.auditLog.create({
                data: {
                    changedBy: callerId,
                    targetUserId: userId,
                    fieldChanged: "password",
                    reason: "Admin reset user password"
                }
            }),
            prisma_1.default.session.deleteMany({ where: { userId: userId } })
        ]);
        res.json({ success: true, tempPassword });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Soft Delete User
router.delete("/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const callerId = req.user?.userId;
        const role = req.user?.role;
        if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
            return res.status(403).json({ error: "Forbidden" });
        }
        await prisma_1.default.$transaction([
            prisma_1.default.user.update({
                where: { userId: userId },
                data: { isActive: false }
            }),
            prisma_1.default.auditLog.create({
                data: {
                    changedBy: callerId,
                    targetUserId: userId,
                    fieldChanged: "isActive",
                    newValue: "false",
                    reason: "Admin deactivated user"
                }
            }),
            prisma_1.default.session.deleteMany({ where: { userId: userId } })
        ]);
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Reactivate User
router.patch("/:userId/reactivate", async (req, res) => {
    try {
        const { userId } = req.params;
        const callerId = req.user?.userId;
        const role = req.user?.role;
        if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
            return res.status(403).json({ error: "Forbidden" });
        }
        await prisma_1.default.$transaction([
            prisma_1.default.user.update({
                where: { userId: userId },
                data: { isActive: true }
            }),
            prisma_1.default.auditLog.create({
                data: {
                    changedBy: callerId,
                    targetUserId: userId,
                    fieldChanged: "isActive",
                    newValue: "true",
                    reason: "Admin reactivated user"
                }
            }),
        ]);
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.patch("/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const { username, name, password, designation, role: newRole } = req.body;
        const callerId = req.user?.userId;
        const role = req.user?.role;
        if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
            return res.status(403).json({ error: "Only admins can edit users" });
        }
        const existing = await prisma_1.default.user.findUnique({ where: { userId: userId } });
        if (!existing)
            return res.status(404).json({ error: "User not found" });
        const updates = {};
        const auditEntries = [];
        // Update username
        if (username && username !== existing.username) {
            const taken = await prisma_1.default.user.findUnique({ where: { username } });
            if (taken)
                return res.status(409).json({ error: "Username already taken" });
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
            const salt = await bcrypt_1.default.genSalt(12);
            const passwordHash = await bcrypt_1.default.hash(password, salt);
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
        await prisma_1.default.$transaction([
            prisma_1.default.user.update({ where: { userId: userId }, data: updates }),
            ...auditEntries.map((entry) => prisma_1.default.auditLog.create({
                data: {
                    changedBy: callerId,
                    targetUserId: userId,
                    fieldChanged: entry.fieldChanged,
                    oldValue: entry.oldValue,
                    newValue: entry.newValue,
                    reason: `Admin updated user ${entry.fieldChanged}`,
                },
            })),
            // Invalidate sessions if username or password changed
            ...(updates.username || updates.passwordHash
                ? [prisma_1.default.session.deleteMany({ where: { userId: userId } })]
                : []),
        ]);
        const updatedUser = await prisma_1.default.user.findUnique({ where: { userId: userId } });
        return res.json({
            userId: updatedUser.userId,
            username: updatedUser.username,
            name: updatedUser.name,
            role: updatedUser.role,
        });
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
// POST /api/users — Admin creates a new user
router.post("/", (0, auth_middleware_1.authorize)(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
    try {
        const { username, password, name, role, designation } = req.body;
        const callerId = req.user?.userId;
        if (!username || !password || !name) {
            return res.status(400).json({ error: "username, password, and name are required" });
        }
        const existing = await prisma_1.default.user.findUnique({ where: { username } });
        if (existing) {
            return res.status(409).json({ error: "Username already exists" });
        }
        const salt = await bcrypt_1.default.genSalt(12);
        const passwordHash = await bcrypt_1.default.hash(password, salt);
        const newUser = await prisma_1.default.$transaction(async (tx) => {
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
    }
    catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
exports.default = router;
