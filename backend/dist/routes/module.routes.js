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
const findOrCreateDefaultProject = async () => {
    let project = await prisma_1.default.project.findFirst();
    if (!project) {
        project = await prisma_1.default.project.create({
            data: {
                projectName: 'PatchFlow Default Project',
                description: 'Auto-created default project for module management',
            },
        });
    }
    return project;
};
const serializeModule = (module) => ({
    id: module.moduleId,
    name: module.moduleName,
    description: module.description || '',
    isActive: module.isActive,
    projectId: module.projectId,
    users: module.users ? module.users.map((user) => ({
        id: `${module.moduleId}-${user.userId}`,
        user: {
            id: user.userId,
            username: user.username,
            name: user.name,
            role: user.role,
        },
    })) : undefined,
});
// GET /api/modules
router.get("/", async (req, res) => {
    try {
        const includeUsers = req.query.includeUsers === 'true';
        const modules = await prisma_1.default.module.findMany({
            orderBy: { moduleName: "asc" },
            include: includeUsers ? { users: true } : undefined,
        });
        res.json(modules.map(serializeModule));
    }
    catch (e) {
        console.error('[module.routes] GET /api/modules failed', e);
        res.status(500).json({ error: "Internal server error" });
    }
});
// GET /api/modules/hierarchy
router.get('/hierarchy', (0, auth_middleware_1.authorize)(["SUPER_ADMIN", "ADMIN"]), async (_req, res) => {
    try {
        const modules = await prisma_1.default.module.findMany({
            orderBy: { moduleName: 'asc' },
            include: { users: true },
        });
        const hierarchy = modules.map((module) => {
            const assignments = module.users.map((user) => ({
                id: `${module.moduleId}-${user.userId}`,
                user: {
                    id: user.userId,
                    username: user.username,
                    name: user.name,
                    role: user.role,
                },
            }));
            const managers = assignments.filter((a) => ['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(a.user.role));
            const resources = assignments.filter((a) => ['DEVELOPER'].includes(a.user.role));
            const deployers = assignments.filter((a) => a.user.role === 'DEVELOPER');
            const verifiers = assignments.filter((a) => a.user.role === 'VERIFIER');
            return {
                id: module.moduleId,
                name: module.moduleName,
                description: module.description || '',
                isActive: module.isActive,
                counts: {
                    managers: managers.length,
                    resources: resources.length,
                    deployers: deployers.length,
                    verifiers: verifiers.length,
                    totalAssignments: assignments.length,
                },
                managers,
                resources,
                deployers,
                verifiers,
            };
        });
        res.json(hierarchy);
    }
    catch (e) {
        console.error('[module.routes] GET /api/modules/hierarchy failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/modules/:moduleId
router.get('/:moduleId', async (req, res) => {
    try {
        const moduleId = String(req.params.moduleId);
        const module = await prisma_1.default.module.findUnique({
            where: { moduleId },
            include: { users: true },
        });
        if (!module)
            return res.status(404).json({ error: 'Module not found' });
        return res.json(serializeModule(module));
    }
    catch (e) {
        console.error('[module.routes] GET /api/modules/:moduleId failed', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/modules
router.post('/', (0, auth_middleware_1.authorize)(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Module name is required' });
        }
        const project = await findOrCreateDefaultProject();
        const module = await prisma_1.default.module.create({
            data: {
                moduleName: name,
                description: description || '',
                projectId: project.projectId,
                isActive: true,
            },
        });
        return res.status(201).json(serializeModule(module));
    }
    catch (error) {
        console.error('[module.routes] POST /api/modules failed', error);
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Module name must be unique' });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// PATCH /api/modules/:moduleId
router.patch('/:moduleId', (0, auth_middleware_1.authorize)(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
    try {
        const moduleId = String(req.params.moduleId);
        const { name, description, isActive } = req.body;
        const data = {};
        if (name !== undefined)
            data.moduleName = name;
        if (description !== undefined)
            data.description = description;
        if (isActive !== undefined)
            data.isActive = isActive;
        const module = await prisma_1.default.module.update({
            where: { moduleId },
            data,
        });
        return res.status(200).json(serializeModule(module));
    }
    catch (error) {
        console.error('[module.routes] PATCH /api/modules/:moduleId failed', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Module not found' });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// DELETE /api/modules/:moduleId — SUPER_ADMIN only, blocked if tasks exist
router.delete('/:moduleId', (0, auth_middleware_1.authorize)(["SUPER_ADMIN"]), async (req, res) => {
    try {
        const moduleId = String(req.params.moduleId);
        const module = await prisma_1.default.module.findUnique({ where: { moduleId } });
        if (!module)
            return res.status(404).json({ error: 'Module not found' });
        // Guard: cannot delete if active tasks are linked to this module
        const taskCount = await prisma_1.default.task.count({
            where: { moduleId, lifecycleStatus: { lt: 100 } },
        });
        if (taskCount > 0) {
            return res.status(409).json({
                error: `Cannot delete module: ${taskCount} active patch(es) are linked to it. Deactivate the module instead.`,
            });
        }
        // Disconnect all users from module before deleting
        await prisma_1.default.module.update({
            where: { moduleId },
            data: { users: { set: [] } },
        });
        await prisma_1.default.module.delete({ where: { moduleId } });
        return res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('[module.routes] DELETE /api/modules/:moduleId failed', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
