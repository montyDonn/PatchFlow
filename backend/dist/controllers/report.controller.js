"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
const client_1 = require("@prisma/client");
const constants_1 = require("../utils/constants");
const task_service_1 = require("../services/task.service");
const prisma = new client_1.PrismaClient();
exports.ReportController = {
    getHistory: async (req, res) => {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            // We'll fetch StatusHistory with its related Task and User objects
            // to provide a rich report
            let historyQuery = {
                include: {
                    user: { select: { userId: true, name: true, username: true, role: true } },
                    task: {
                        include: {
                            assignee: { select: { userId: true, name: true, username: true, role: true } },
                            author: { select: { userId: true, name: true, username: true } },
                            module: { select: { moduleName: true } },
                            team: { select: { name: true } }
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            };
            // RBAC filtering logic
            if (user.role === constants_1.Role.SUPER_ADMIN || user.role === constants_1.Role.ADMIN) {
                // Admins see everything. No extra where clause needed.
            }
            else if (user.role === constants_1.Role.MANAGER) {
                // Managers see tasks authored by them, assigned to them, or assigned to their subordinates
                const subordinates = await prisma.user.findMany({
                    where: { userAssignments: { some: { managerId: user.userId } } },
                    select: { userId: true }
                });
                const subordinateIds = subordinates.map(sub => sub.userId);
                const allowedUserIds = [user.userId, ...subordinateIds];
                historyQuery.where = {
                    OR: [
                        { changedById: { in: allowedUserIds } },
                        { task: { assigneeId: { in: allowedUserIds } } },
                        { task: { authorId: { in: allowedUserIds } } }
                    ]
                };
            }
            else {
                // Resources/Developers/Deployment see ONLY their own history
                historyQuery.where = {
                    OR: [
                        { changedById: user.userId },
                        { task: { assigneeId: user.userId } },
                        { task: { authorId: user.userId } }
                    ]
                };
            }
            // Execute query
            const statusHistory = await prisma.statusHistory.findMany(historyQuery);
            const auditLogQuery = {
                include: {
                    actor: { select: { userId: true, name: true, username: true, role: true } },
                    task: {
                        select: {
                            id: true,
                            title: true,
                            status: true,
                            lifecycleStatus: true,
                            module: { select: { moduleName: true } },
                        },
                    },
                },
                orderBy: {
                    changedAt: 'desc'
                }
            };
            if (user.role === constants_1.Role.SUPER_ADMIN || user.role === constants_1.Role.ADMIN) {
                // all
            }
            else if (user.role === constants_1.Role.MANAGER) {
                const subordinates = await prisma.user.findMany({
                    where: { userAssignments: { some: { managerId: user.userId } } },
                    select: { userId: true }
                });
                const allowedUserIds = [user.userId, ...subordinates.map(s => s.userId)];
                auditLogQuery.where = { changedBy: { in: allowedUserIds } };
            }
            else {
                auditLogQuery.where = { changedBy: user.userId };
            }
            const auditLogs = await prisma.auditLog.findMany(auditLogQuery);
            res.status(200).json({
                success: true,
                data: {
                    statusHistory,
                    auditLogs
                }
            });
        }
        catch (error) {
            console.error("Error fetching report history:", error);
            res.status(500).json({ error: error.message });
        }
    },
    getReportData: async (req, res) => {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            if (user.role === constants_1.Role.DEVELOPER || user.role === constants_1.Role.VERIFIER) {
                res.status(403).json({ error: 'Forbidden: You do not have access to reports.' });
                return;
            }
            const { view, startDate, endDate, moduleId, clientId, managerId, developerId, verifierId, status } = req.query;
            // Base query scoped by role
            let whereClause = {
                lifecycleStatus: { lt: 100 }, // exclude soft-deleted
            };
            if (user.role === constants_1.Role.CLIENT) {
                whereClause = {
                    ...whereClause,
                    OR: [{ authorId: user.userId }, { clientId: user.userId }],
                };
            }
            else if (user.role === constants_1.Role.MANAGER) {
                const managedUserRelations = await prisma.userManager.findMany({
                    where: { managerId: user.userId },
                    select: { userId: true }
                });
                const teamUserIds = managedUserRelations.map(r => r.userId);
                whereClause = {
                    ...whereClause,
                    OR: [
                        { authorId: user.userId },
                        { managers: { some: { userId: user.userId } } },
                        { developers: { some: { userId: { in: teamUserIds } } } },
                        { verifiers: { some: { userId: { in: teamUserIds } } } }
                    ],
                };
            }
            // Preset / custom date bounds on createdAt
            if (view === 'weekly') {
                const last7Days = new Date();
                last7Days.setDate(last7Days.getDate() - 7);
                whereClause.createdAt = { gte: last7Days };
            }
            else if (view === 'monthly') {
                const last30Days = new Date();
                last30Days.setDate(last30Days.getDate() - 30);
                whereClause.createdAt = { gte: last30Days };
            }
            else if (view === 'custom' && startDate && endDate) {
                whereClause.createdAt = {
                    gte: new Date(startDate),
                    lte: new Date(endDate),
                };
            }
            // Query filters
            if (moduleId) {
                whereClause.moduleId = moduleId;
            }
            if (clientId) {
                whereClause.clientId = clientId;
            }
            if (managerId) {
                whereClause.managers = { some: { userId: managerId } };
            }
            if (developerId) {
                whereClause.developers = { some: { userId: developerId } };
            }
            if (verifierId) {
                whereClause.verifiers = { some: { userId: verifierId } };
            }
            if (status) {
                whereClause.status = status;
            }
            // Execute query including all relations
            const tasks = await prisma.task.findMany({
                where: whereClause,
                include: {
                    author: true,
                    client: true,
                    managers: true,
                    developers: true,
                    verifiers: true,
                    team: true,
                    module: true,
                    statusHistory: { orderBy: { createdAt: "asc" } },
                    comments: { include: { user: true } },
                    attachments: true,
                },
                orderBy: { createdAt: "desc" },
            });
            // Resolve TaskService actor normalization to populate history acting users
            const normalized = tasks.map(t => task_service_1.TaskService.normalizeTask(t));
            const resolvedTasks = await task_service_1.TaskService.resolveTasksActors(normalized, tasks);
            res.status(200).json({
                success: true,
                data: resolvedTasks,
            });
        }
        catch (error) {
            console.error("Error fetching report data:", error);
            res.status(500).json({ error: error.message });
        }
    }
};
