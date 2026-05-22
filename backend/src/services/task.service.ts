import prisma from "../utils/prisma";
import { TaskStatus, Role } from "../utils/constants";
import { NotificationService } from "./notification.service";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.ADMIN];
const RESOURCE_ROLES = [Role.DEVELOPER];
const APPROVER_ROLES = [Role.MANAGER, Role.ADMIN];

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.DRAFT]: [TaskStatus.ASSIGNED],
  [TaskStatus.ASSIGNED]: [TaskStatus.PENDING_APPROVAL],
  [TaskStatus.PENDING_APPROVAL]: [TaskStatus.IN_DEVELOPMENT],
  [TaskStatus.IN_DEVELOPMENT]: [TaskStatus.VERIFYING],
  [TaskStatus.VERIFYING]: [
    TaskStatus.COMPLETED,
    TaskStatus.RETURNED_TO_DEVELOPER,
    TaskStatus.REJECTED,
    TaskStatus.DELAYED,
    TaskStatus.ON_HOLD,
    TaskStatus.CANCELLED
  ],
  [TaskStatus.RETURNED_TO_DEVELOPER]: [TaskStatus.IN_DEVELOPMENT],
  [TaskStatus.DELAYED]: [TaskStatus.IN_DEVELOPMENT],
  [TaskStatus.ON_HOLD]: [TaskStatus.IN_DEVELOPMENT],
  [TaskStatus.COMPLETED]: [],
  [TaskStatus.REJECTED]: [],
  [TaskStatus.CANCELLED]: [],
};

export class TaskService {
  private static async getActor(actorId: string) {
    const actor = await prisma.user.findUnique({ where: { userId: actorId } });
    if (!actor || !actor.isActive) throw new Error("Actor not found");
    return actor;
  }

  private static isAdmin(role: string) {
    return ADMIN_ROLES.includes(role as Role);
  }

  private static async validateStatusTransition(task: any, actor: any, newStatus: TaskStatus) {
    const previousStatus = task.status as TaskStatus;
    if (previousStatus === newStatus) return;

    const allowedTargets = ALLOWED_TRANSITIONS[previousStatus] || [];
    if (!allowedTargets.includes(newStatus)) {
      throw new Error(`Invalid workflow transition: ${previousStatus} -> ${newStatus}`);
    }

    if (this.isAdmin(actor.role)) return;

    let isAuthorized = false;
    const actorId = actor.userId;

    const managerIds = task.managers?.map((m: any) => m.userId || m.id) || [];
    const isTaskManager = managerIds.includes(actorId);

    if (newStatus === TaskStatus.ASSIGNED) {
      isAuthorized = (
        (actor.role === Role.CLIENT && (task.clientId === actorId || task.authorId === actorId)) ||
        (task.clientId === null && (task.authorId === actorId || isTaskManager))
      ) && previousStatus === TaskStatus.DRAFT;
    } else if (newStatus === TaskStatus.PENDING_APPROVAL) {
      if (actor.role === Role.MANAGER) {
        const managedUserRelations = await prisma.userManager.findMany({
          where: { managerId: actorId },
          select: { userId: true }
        });
        const teamUserIds = managedUserRelations.map(r => r.userId);
        const devIds = task.developers?.map((d: any) => d.userId || d.id) || [];
        const verIds = task.verifiers?.map((v: any) => v.userId || v.id) || [];
        const isTeamManager = devIds.some((id: string) => teamUserIds.includes(id)) || verIds.some((id: string) => teamUserIds.includes(id));
        
        isAuthorized = (isTaskManager || isTeamManager) && previousStatus === TaskStatus.ASSIGNED;
      }
    } else if (newStatus === TaskStatus.IN_DEVELOPMENT) {
      if (previousStatus === TaskStatus.PENDING_APPROVAL) {
        if (actor.role === Role.MANAGER) {
          const managedUserRelations = await prisma.userManager.findMany({
            where: { managerId: actorId },
            select: { userId: true }
          });
          const teamUserIds = managedUserRelations.map(r => r.userId);
          const devIds = task.developers?.map((d: any) => d.userId || d.id) || [];
          const verIds = task.verifiers?.map((v: any) => v.userId || v.id) || [];
          const isTeamManager = devIds.some((id: string) => teamUserIds.includes(id)) || verIds.some((id: string) => teamUserIds.includes(id));

          isAuthorized = (isTaskManager || isTeamManager);
        }
      } else if ([TaskStatus.RETURNED_TO_DEVELOPER, TaskStatus.DELAYED, TaskStatus.ON_HOLD].includes(previousStatus)) {
        const devIds = task.developers?.map((d: any) => d.userId || d.id) || [];
        const isDev = actor.role === Role.DEVELOPER && devIds.includes(actorId);
        
        let isTeamManager = false;
        if (actor.role === Role.MANAGER) {
          const managedUserRelations = await prisma.userManager.findMany({
            where: { managerId: actorId },
            select: { userId: true }
          });
          const teamUserIds = managedUserRelations.map(r => r.userId);
          const verIds = task.verifiers?.map((v: any) => v.userId || v.id) || [];
          isTeamManager = devIds.some((id: string) => teamUserIds.includes(id)) || verIds.some((id: string) => teamUserIds.includes(id));
        }
        const isMgr = actor.role === Role.MANAGER && (isTaskManager || isTeamManager);
        isAuthorized = isDev || isMgr;
      }
    } else if (newStatus === TaskStatus.VERIFYING) {
      const devIds = task.developers?.map((d: any) => d.userId || d.id) || [];
      isAuthorized = actor.role === Role.DEVELOPER && devIds.includes(actorId) && previousStatus === TaskStatus.IN_DEVELOPMENT;
    } else if ([
      TaskStatus.COMPLETED,
      TaskStatus.RETURNED_TO_DEVELOPER,
      TaskStatus.REJECTED,
      TaskStatus.DELAYED,
      TaskStatus.ON_HOLD,
      TaskStatus.CANCELLED
    ].includes(newStatus)) {
      const verIds = task.verifiers?.map((v: any) => v.userId || v.id) || [];
      isAuthorized = actor.role === Role.VERIFIER && verIds.includes(actorId) && previousStatus === TaskStatus.VERIFYING;
    }

    if (!isAuthorized) {
      throw new Error("Forbidden: You are not authorized to move this patch to that stage");
    }
  }

  private static async assertActiveUser(userId: string | undefined, field: string) {
    if (!userId) throw new Error(`Missing required field: ${field}`);
    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user || !user.isActive) throw new Error(`${field} not found or inactive`);
  }

  private static async assertModule(moduleId: string | undefined) {
    if (!moduleId) throw new Error("Missing required field: moduleId");

    const module = await prisma.module.findUnique({ where: { moduleId } });
    if (!module || !module.isActive) throw new Error("moduleId not found");
  }

  static normalizeUser(user: any) {
    if (!user) return null;
    return {
      id: user.userId,
      userId: user.userId,
      username: user.username,
      name: user.name,
      role: user.role,
      designation: user.designation,
      isActive: user.isActive,
    };
  }

  static normalizeTask(task: any) {
    if (!task) return task;

    return {
      ...task,
      author: this.normalizeUser(task.author),
      client: this.normalizeUser(task.client),
      managers: task.managers?.map((m: any) => this.normalizeUser(m)) || [],
      manager: this.normalizeUser(task.manager) || (task.managers?.[0] ? this.normalizeUser(task.managers[0]) : null),
      developers: task.developers?.map((d: any) => this.normalizeUser(d)) || [],
      verifiers: task.verifiers?.map((v: any) => this.normalizeUser(v)) || [],
      // Backwards compatibility fallbacks
      assignee: this.normalizeUser(task.assignee) || (task.developers?.[0] ? this.normalizeUser(task.developers[0]) : null),
      verifier: this.normalizeUser(task.verifier) || (task.verifiers?.[0] ? this.normalizeUser(task.verifiers[0]) : null),
      approver: this.normalizeUser(task.approver) || this.normalizeUser(task.manager) || (task.managers?.[0] ? this.normalizeUser(task.managers[0]) : null),
      comments: task.comments?.map((comment: any) => ({
        ...comment,
        user: this.normalizeUser(comment.user),
      })),
      module: task.module ? { id: task.module.moduleId, name: task.module.moduleName } : null,
    };
  }

  static async checkReadPermission(task: any, actorId: string, role: string) {
    if (this.isAdmin(role)) return;

    if (role === Role.CLIENT) {
      if (task.clientId === actorId || task.authorId === actorId) return;
    } else if (role === Role.DEVELOPER) {
      const devIds = task.developers?.map((d: any) => d.userId || d.id) || [];
      if (devIds.includes(actorId)) return;
    } else if (role === Role.VERIFIER) {
      const verIds = task.verifiers?.map((v: any) => v.userId || v.id) || [];
      if (verIds.includes(actorId)) return;
    } else if (role === Role.MANAGER) {
      const managerIds = task.managers?.map((m: any) => m.userId || m.id) || [];
      if (managerIds.includes(actorId) || task.authorId === actorId) return;
      // Check team membership
      const managedUserRelations = await prisma.userManager.findMany({
        where: { managerId: actorId },
        select: { userId: true }
      });
      const teamUserIds = managedUserRelations.map(r => r.userId);
      const devIds = task.developers?.map((d: any) => d.userId || d.id) || [];
      const verIds = task.verifiers?.map((v: any) => v.userId || v.id) || [];
      if (devIds.some((id: string) => teamUserIds.includes(id)) || verIds.some((id: string) => teamUserIds.includes(id))) {
        return;
      }
    }

    throw new Error("Forbidden: You do not have permission to view this patch");
  }

  static async createTask(data: {
    title: string;
    description: string;
    authorId: string;
    teamId?: string;
    moduleId?: string;
    clientId?: string;
    clientRequestId?: number;
    managerId?: string;
    managerIds?: string[];
    developerIds?: string[];
    verifierIds?: string[];
    dateGiven?: string;
    lifecycleStatus: number;
    plannedStartDate?: string;
    plannedEndDate?: string;
  }) {
    const actor = await this.getActor(data.authorId);
    if (!this.isAdmin(actor.role) && actor.role !== Role.CLIENT && actor.role !== Role.MANAGER && actor.role !== Role.DEVELOPER) {
      throw new Error("Only SUPER_ADMIN, ADMIN, CLIENT, MANAGER, and DEVELOPER can create patches");
    }
    if (!data.title.trim()) throw new Error("Missing required field: title");
    if (!data.description.trim()) throw new Error("Missing required field: description");
    if (!Number.isInteger(data.lifecycleStatus)) throw new Error("Invalid lifecycleStatus");

    await this.assertModule(data.moduleId);

    const resolvedClientId = actor.role === Role.CLIENT ? actor.userId : (data.clientId || null);
    if (resolvedClientId) {
      await this.assertActiveUser(resolvedClientId, "clientId");
    }

    const finalManagerIds = data.managerIds && data.managerIds.length > 0
      ? data.managerIds
      : (data.managerId ? [data.managerId] : []);

    if (finalManagerIds.length === 0) {
      throw new Error("Missing required field: managerId or managerIds");
    }

    for (const mId of finalManagerIds) {
      await this.assertActiveUser(mId, "managerId");
    }

    const finalDeveloperIds = data.developerIds || [];
    const finalVerifierIds = data.verifierIds || [];

    for (const dId of finalDeveloperIds) {
      await this.assertActiveUser(dId, "developerId");
    }
    for (const vId of finalVerifierIds) {
      await this.assertActiveUser(vId, "verifierId");
    }

    const initialStatus = (finalManagerIds.length > 0 && finalDeveloperIds.length > 0 && finalVerifierIds.length > 0)
      ? TaskStatus.ASSIGNED
      : TaskStatus.DRAFT;

    const task = await prisma.$transaction(async (tx) => {
      const createdTask = await tx.task.create({
        data: {
          title: data.title,
          description: data.description,
          authorId: data.authorId,
          teamId: data.teamId,
          moduleId: data.moduleId,
          clientId: resolvedClientId,
          clientRequestId: resolvedClientId ? (data.clientRequestId ?? 0) : 0,
          managers: {
            connect: finalManagerIds.map(userId => ({ userId }))
          },
          developers: {
            connect: finalDeveloperIds.map(userId => ({ userId }))
          },
          verifiers: {
            connect: finalVerifierIds.map(userId => ({ userId }))
          },
          dateGiven: data.dateGiven ? new Date(data.dateGiven) : new Date(),
          plannedStartDate: data.plannedStartDate ? new Date(data.plannedStartDate) : null,
          plannedEndDate: data.plannedEndDate ? new Date(data.plannedEndDate) : null,
          status: initialStatus,
          lifecycleStatus: data.lifecycleStatus,
        },
      });

      await tx.statusHistory.create({
        data: {
          taskId: createdTask.id,
          previousStatus: TaskStatus.DRAFT,
          newStatus: initialStatus,
          changedById: data.authorId,
          changedByName: actor.name,
          changedByUsername: actor.username,
          changedByRole: actor.role,
          reason: initialStatus === TaskStatus.ASSIGNED ? "Task created and automatically assigned" : "Task created",
        },
      });

      await tx.auditLog.create({
        data: {
          taskId: createdTask.id,
          changedBy: data.authorId,
          fieldChanged: "Task Created",
          newValue: JSON.stringify({ id: createdTask.id, title: createdTask.title, status: initialStatus }),
          reason: "Task created by author",
        },
      });

      return createdTask;
    }, { maxWait: 10000, timeout: 15000 });

    return this.getTaskById(task.id);
  }

  static async updateTaskDates(
    taskId: string,
    dates: { plannedStartDate?: string; plannedEndDate?: string; completedAt?: string }
  ) {
    return prisma.task.update({
      where: { id: taskId },
      data: {
        plannedStartDate: dates.plannedStartDate ? new Date(dates.plannedStartDate) : undefined,
        plannedEndDate:   dates.plannedEndDate   ? new Date(dates.plannedEndDate)   : undefined,
        completedAt:      dates.completedAt      ? new Date(dates.completedAt)      : undefined,
      },
    });
  }



  static async resolveTasksActors(normalizedTasks: any[], originalTasks: any[]) {
    const allChangedByIds = new Set<string>();
    for (const t of originalTasks) {
      if (t.statusHistory) {
        for (const h of t.statusHistory) {
          if (h.changedById) allChangedByIds.add(h.changedById);
        }
      }
    }

    if (allChangedByIds.size === 0) return normalizedTasks;

    const users = await prisma.user.findMany({
      where: { userId: { in: Array.from(allChangedByIds) } },
    });
    const userMap = new Map(users.map(u => [u.userId, u]));

    for (let i = 0; i < normalizedTasks.length; i++) {
      const orig = originalTasks[i];
      const norm = normalizedTasks[i];
      if (orig.statusHistory) {
        norm.statusHistory = orig.statusHistory.map((h: any) => ({
          ...h,
          actor: h.changedById ? this.normalizeUser(userMap.get(h.changedById)) : null
        }));
      }
    }

    return normalizedTasks;
  }

  static async getTasks(role: string, userId: string, includeDeleted = false) {
    let whereClause: any = {
      lifecycleStatus: includeDeleted && this.isAdmin(role) ? { in: [0, 100] } : { lt: 100 },
    };

    if (role === Role.CLIENT) {
      whereClause = {
        ...whereClause,
        OR: [{ authorId: userId }, { clientId: userId }],
      };
    } else if (role === Role.DEVELOPER) {
      whereClause = {
        ...whereClause,
        developers: { some: { userId } },
      };
    } else if (role === Role.MANAGER) {
      const managedUserRelations = await prisma.userManager.findMany({
        where: { managerId: userId },
        select: { userId: true }
      });
      const teamUserIds = managedUserRelations.map(r => r.userId);
      whereClause = {
        ...whereClause,
        OR: [
          { authorId: userId },
          { managers: { some: { userId } } },
          { developers: { some: { userId: { in: teamUserIds } } } },
          { verifiers: { some: { userId: { in: teamUserIds } } } }
        ],
      };
    } else if (role === Role.VERIFIER) {
      whereClause = {
        ...whereClause,
        verifiers: { some: { userId } },
      };
    }
    // SUPER_ADMIN and ADMIN see all active tasks.

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

    const normalized = tasks.map(t => this.normalizeTask(t));
    return this.resolveTasksActors(normalized, tasks);
  }

  static async getTaskById(id: string) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        author: true,
        client: true,
        managers: true,
        developers: true,
        verifiers: true,
        team: true,
        module: true,
        comments: { include: { user: true } },
        statusHistory: { orderBy: { createdAt: "asc" } },
        auditLogs: { include: { actor: true }, orderBy: { changedAt: "asc" } },
        attachments: true,
      },
    });

    if (!task) return null;

    const normalized = this.normalizeTask(task);
    const resolved = await this.resolveTasksActors([normalized], [task]);
    const finalTask = resolved[0];

    finalTask.auditLogs = task.auditLogs?.map(l => ({
      ...l,
      actor: this.normalizeUser(l.actor)
    })) || [];

    return finalTask;
  }

  static async updateStatus(
    taskId: string,
    actorId: string,
    newStatus: TaskStatus,
    reason?: string
  ) {
    const [task, actor] = await Promise.all([
      prisma.task.findUnique({
        where: { id: taskId },
        include: { managers: true, developers: true, verifiers: true }
      }),
      this.getActor(actorId),
    ]);
    if (!task) throw new Error("Task not found");
    if (task.lifecycleStatus >= 100) throw new Error("Cannot update a soft deleted patch");

    const previousStatus = task.status as TaskStatus;
    
    // Validate state transition & permissions using unified helper
    await this.validateStatusTransition(task, actor, newStatus);

    const updateData: any = {
      status: newStatus,
      dateStarted: newStatus === TaskStatus.IN_DEVELOPMENT && !task.dateStarted ? new Date() : undefined,
      dateEnded: [TaskStatus.COMPLETED, TaskStatus.REJECTED, TaskStatus.CANCELLED].includes(newStatus) ? new Date() : null,
    };

    const updatedTask = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId },
        data: updateData,
      });

      await tx.statusHistory.create({
        data: {
          taskId,
          previousStatus,
          newStatus,
          changedById: actorId,
          changedByName: actor.name,
          changedByUsername: actor.username,
          changedByRole: actor.role,
          reason: reason || `Status changed to ${newStatus}`,
        },
      });

      await tx.auditLog.create({
        data: {
          taskId,
          changedBy: actorId,
          fieldChanged: "Task Status",
          oldValue: previousStatus,
          newValue: newStatus,
          reason: reason ?? `Status changed from ${previousStatus} to ${newStatus}`,
        },
      });

      return updated;
    });

    // Notifications
    if (newStatus === TaskStatus.ASSIGNED && task.managers && task.managers.length > 0) {
      for (const m of task.managers) {
        await NotificationService.createNotification(m.userId, "TASK_ASSIGNED", `Task "${task.title}" has been assigned to you by Client.`);
      }
    } else if (newStatus === TaskStatus.PENDING_APPROVAL && task.managers && task.managers.length > 0) {
      for (const m of task.managers) {
        await NotificationService.createNotification(m.userId, "TASK_PENDING_APPROVAL", `Task "${task.title}" assignments ready for approval.`);
      }
    } else if (newStatus === TaskStatus.IN_DEVELOPMENT) {
      for (const dev of task.developers) {
        await NotificationService.createNotification(dev.userId, "TASK_IN_DEVELOPMENT", `Work has started on your task: "${task.title}".`);
      }
    } else if (newStatus === TaskStatus.VERIFYING) {
      for (const ver of task.verifiers) {
        await NotificationService.createNotification(ver.userId, "TASK_PENDING_VERIFICATION", `Task "${task.title}" is ready for verification.`);
      }
    } else if (newStatus === TaskStatus.RETURNED_TO_DEVELOPER) {
      for (const dev of task.developers) {
        await NotificationService.createNotification(
          dev.userId, "TASK_RETURNED",
          `Task "${task.title}" failed verification and has been returned to you for rework.`
        );
      }
    } else if (task.clientId && [
      TaskStatus.COMPLETED, TaskStatus.REJECTED, TaskStatus.CANCELLED, TaskStatus.DELAYED, TaskStatus.ON_HOLD
    ].includes(newStatus)) {
      await NotificationService.createNotification(
        task.clientId, "TASK_FINALIZED", `Your patch request "${task.title}" status has been updated to ${newStatus}.`
      );
    }

    return this.getTaskById(updatedTask.id);
  }

  static async assignTask(taskId: string, assigneeId: string, actorId: string) {
    const [task, actor] = await Promise.all([
      prisma.task.findUnique({
        where: { id: taskId },
        include: { managers: true }
      }),
      this.getActor(actorId),
    ]);
    if (!task) throw new Error("Task not found");
    const managerIds = task.managers?.map((m: any) => m.userId) || [];
    if (!this.isAdmin(actor.role) && !managerIds.includes(actorId)) throw new Error("Forbidden");

    const assignee = await prisma.user.findUnique({ where: { userId: assigneeId } });
    if (!assignee || !RESOURCE_ROLES.includes(assignee.role as Role)) {
      throw new Error("Tasks can only be assigned to Developers");
    }
    await this.assertActiveUser(assigneeId, "assigneeId");

    const updatedTask = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          developers: {
            connect: { userId: assigneeId }
          }
        },
      });

      await tx.auditLog.create({
        data: {
          taskId,
          changedBy: actorId,
          fieldChanged: "Task Developers",
          newValue: assigneeId,
          reason: "Added developer assignee",
        },
      });

      return updated;
    });

    await NotificationService.createNotification(
      assigneeId, "TASK_ASSIGNED", `You've been assigned as developer to: "${task.title}"`
    );

    return this.getTaskById(updatedTask.id);
  }

  static async softDeleteTask(taskId: string, actorId: string) {
    const actor = await this.getActor(actorId);
    if (!this.isAdmin(actor.role)) throw new Error("Only SUPER_ADMIN and ADMIN can delete patches");

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new Error("Task not found");

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.task.update({
        where: { id: taskId },
        data: { lifecycleStatus: 100 },
      });
      await tx.statusHistory.create({
        data: {
          taskId,
          previousStatus: task.status,
          newStatus: task.status,
          changedById: actorId,
          changedByName: actor.name,
          changedByUsername: actor.username,
          changedByRole: actor.role,
          reason: "Patch soft deleted",
        },
      });
      await tx.auditLog.create({
        data: {
          taskId,
          changedBy: actorId,
          fieldChanged: "Task Lifecycle",
          oldValue: String(task.lifecycleStatus),
          newValue: "100",
          reason: "Patch soft deleted",
        },
      });
      return result;
    });

    return this.getTaskById(updated.id);
  }

  static async restoreTask(taskId: string, actorId: string) {
    const actor = await this.getActor(actorId);
    if (!this.isAdmin(actor.role)) throw new Error("Only SUPER_ADMIN and ADMIN can restore patches");

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new Error("Task not found");

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.task.update({
        where: { id: taskId },
        data: { lifecycleStatus: 0 },
      });
      await tx.statusHistory.create({
        data: {
          taskId,
          previousStatus: task.status,
          newStatus: task.status,
          changedById: actorId,
          changedByName: actor.name,
          changedByUsername: actor.username,
          changedByRole: actor.role,
          reason: "Patch restored",
        },
      });
      await tx.auditLog.create({
        data: {
          taskId,
          changedBy: actorId,
          fieldChanged: "Task Lifecycle",
          oldValue: String(task.lifecycleStatus),
          newValue: "0",
          reason: "Patch restored",
        },
      });
      return result;
    });

    return this.getTaskById(updated.id);
  }

  static async addComment(taskId: string, actorId: string, content: string, files?: any[]) {
    if (!content.trim()) throw new Error("Comment content is required");
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { managers: true, developers: true, verifiers: true }
    });
    if (!task) throw new Error("Task not found");
    if (task.lifecycleStatus >= 100) throw new Error("Cannot comment on a soft deleted patch");

    const actor = await this.getActor(actorId);
    await this.checkReadPermission(task, actorId, actor.role);

    await prisma.$transaction(async (tx) => {
      await tx.taskComment.create({
        data: {
          taskId,
          userId: actorId,
          content: content.trim(),
          authorName: actor.name,
          authorRole: actor.role,
          files: files || [],
        },
      });
      await tx.statusHistory.create({
        data: {
          taskId,
          previousStatus: task.status,
          newStatus: task.status,
          changedById: actorId,
          changedByName: actor.name,
          changedByUsername: actor.username,
          changedByRole: actor.role,
          reason: "Comment added",
        },
      });
      await tx.auditLog.create({
        data: {
          taskId,
          changedBy: actorId,
          fieldChanged: "Task Comment",
          newValue: content.trim(),
          reason: "Comment added",
        },
      });
    });

    return this.getTaskById(taskId);
  }

  static async updateTaskDetails(
    taskId: string,
    data: Partial<{
      title: string;
      description: string;
      plannedStartDate: string;
      plannedEndDate: string;
      clientId: string;
      clientRequestId: number;
      managerId: string;
      managerIds: string[];
      developers: string[];
      developerIds: string[];
      verifiers: string[];
      verifierIds: string[];
      moduleId: string;
      dateGiven: string;
      dateStarted: string;
      dateEnded: string;
      status: string;
      reason: string;
    }>,
    actorId?: string
  ) {
    if (!actorId) throw new Error("Actor required");
    const actor = await this.getActor(actorId);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { managers: true, developers: true, verifiers: true }
    });
    if (!task) throw new Error("Task not found");

    // CLIENT: Can edit only their own patches, only when in DRAFT status
    if (actor.role === Role.CLIENT) {
      if (task.clientId !== actorId && task.authorId !== actorId) {
        throw new Error("Forbidden: You do not own this patch");
      }
      if (task.status !== TaskStatus.DRAFT) {
        throw new Error("Forbidden: Cannot edit patches after submission");
      }
    }

    // DEVELOPER / VERIFIER: Can update only patches assigned to them, cannot change ownership fields
    if (actor.role === Role.DEVELOPER || actor.role === Role.VERIFIER) {
      const assignedDevIds = task.developers.map(d => d.userId);
      const assignedVerIds = task.verifiers.map(v => v.userId);
      
      const isAssigned = actor.role === Role.DEVELOPER 
        ? assignedDevIds.includes(actorId)
        : assignedVerIds.includes(actorId);

      if (!isAssigned) {
        throw new Error("Forbidden: You are not assigned to this patch");
      }

      const hasOwnershipFieldChanges = 
        (data.clientId !== undefined && data.clientId !== task.clientId) ||
        (data.managerId !== undefined && !task.managers.some(m => m.userId === data.managerId)) ||
        (data.managerIds !== undefined && JSON.stringify(data.managerIds.sort()) !== JSON.stringify(task.managers.map(m => m.userId).sort())) ||
        (data.developers !== undefined && JSON.stringify(data.developers.sort()) !== JSON.stringify(assignedDevIds.sort())) ||
        (data.developerIds !== undefined && JSON.stringify(data.developerIds.sort()) !== JSON.stringify(assignedDevIds.sort())) ||
        (data.verifiers !== undefined && JSON.stringify(data.verifiers.sort()) !== JSON.stringify(assignedVerIds.sort())) ||
        (data.verifierIds !== undefined && JSON.stringify(data.verifierIds.sort()) !== JSON.stringify(assignedVerIds.sort()));

      if (hasOwnershipFieldChanges) {
        throw new Error("Forbidden: You are not allowed to change ownership fields");
      }
    }

    // MANAGER: Can edit only patches assigned to them or their team
    if (actor.role === Role.MANAGER) {
      const managedUserRelations = await prisma.userManager.findMany({
        where: { managerId: actorId },
        select: { userId: true }
      });
      const teamUserIds = managedUserRelations.map(r => r.userId);

      const assignedDevIds = task.developers.map(d => d.userId);
      const assignedVerIds = task.verifiers.map(v => v.userId);
      const managerIds = task.managers.map(m => m.userId);

      const isTeamPatch = 
        managerIds.includes(actorId) ||
        task.authorId === actorId ||
        assignedDevIds.some(id => teamUserIds.includes(id)) ||
        assignedVerIds.some(id => teamUserIds.includes(id));

      if (!isTeamPatch) {
        throw new Error("Forbidden: You can only edit patches assigned to you or your team");
      }
    }

    const moduleId = data.moduleId !== undefined ? data.moduleId : task.moduleId;

    if (moduleId !== undefined && moduleId !== null) {
      await this.assertModule(moduleId);
    }

    // Resolve final manager, developers, and verifiers that will be on the task
    const finalClientId = data.clientId !== undefined ? (data.clientId || null) : task.clientId;
    const finalClientRequestId = finalClientId ? (data.clientRequestId !== undefined ? data.clientRequestId : task.clientRequestId) : 0;

    const finalManagerIds = data.managerIds !== undefined
      ? data.managerIds
      : (data.managerId !== undefined ? [data.managerId] : (task.managers || []).map((m: any) => m.userId));

    const finalDeveloperIds = data.developerIds !== undefined
      ? data.developerIds
      : (data.developers !== undefined ? data.developers : (task.developers || []).map((d: any) => d.userId));

    const finalVerifierIds = data.verifierIds !== undefined
      ? data.verifierIds
      : (data.verifiers !== undefined ? data.verifiers : (task.verifiers || []).map((v: any) => v.userId));

    // Validate CLIENT
    if (finalClientId) {
      await this.assertActiveUser(finalClientId, "clientId");
    }

    // Validate Managers
    if (finalManagerIds && finalManagerIds.length > 0) {
      for (const mId of finalManagerIds) {
        await this.assertActiveUser(mId, "managerId");
      }
    }

    // Validate Developers
    if (finalDeveloperIds && finalDeveloperIds.length > 0) {
      for (const devId of finalDeveloperIds) {
        await this.assertActiveUser(devId, "developerId");
      }
    }

    // Validate Verifiers
    if (finalVerifierIds && finalVerifierIds.length > 0) {
      for (const verId of finalVerifierIds) {
        await this.assertActiveUser(verId, "verifierId");
      }
    }

    const oldStatus = task.status;
    let newStatus = data.status;
    let autoAssigned = false;

    if (task.status === TaskStatus.DRAFT && newStatus !== TaskStatus.ASSIGNED) {
      if (finalManagerIds.length > 0 && finalDeveloperIds.length > 0 && finalVerifierIds.length > 0) {
        newStatus = TaskStatus.ASSIGNED;
        autoAssigned = true;
      }
    }

    if (newStatus !== undefined && newStatus !== null && newStatus !== oldStatus) {
      await this.validateStatusTransition(task, actor, newStatus as TaskStatus);
    }

    const updatePayload: any = {
      title: data.title,
      description: data.description,
      plannedStartDate: data.plannedStartDate ? new Date(data.plannedStartDate) : undefined,
      plannedEndDate:   data.plannedEndDate   ? new Date(data.plannedEndDate)   : undefined,
      clientId: finalClientId,
      clientRequestId: finalClientRequestId,
      moduleId: data.moduleId,
      dateGiven: data.dateGiven ? new Date(data.dateGiven) : undefined,
      dateStarted: data.dateStarted !== undefined ? (data.dateStarted ? new Date(data.dateStarted) : null) : undefined,
      dateEnded: data.dateEnded !== undefined ? (data.dateEnded ? new Date(data.dateEnded) : null) : undefined,
      status: newStatus,
    };

    if (data.managerIds !== undefined || data.managerId !== undefined) {
      updatePayload.managers = {
        set: finalManagerIds.map(userId => ({ userId }))
      };
    }
    if (data.developerIds !== undefined || data.developers !== undefined) {
      updatePayload.developers = {
        set: finalDeveloperIds.map(userId => ({ userId }))
      };
    }
    if (data.verifierIds !== undefined || data.verifiers !== undefined) {
      updatePayload.verifiers = {
        set: finalVerifierIds.map(userId => ({ userId }))
      };
    }

    const updatedTask = await prisma.$transaction(async (tx) => {
      const res = await tx.task.update({
        where: { id: taskId },
        data: updatePayload,
        include: {
          author: true,
          client: true,
          managers: true,
          developers: true,
          verifiers: true,
          team: true,
          module: true,
        }
      });

      if (newStatus && newStatus !== oldStatus && actorId) {
        await tx.statusHistory.create({
          data: {
            taskId,
            previousStatus: oldStatus,
            newStatus,
            changedById: actorId,
            changedByName: actor.name,
            changedByUsername: actor.username,
            changedByRole: actor.role,
            reason: autoAssigned ? "Automatically moved to ASSIGNED after resources were assigned" : (data.reason || "Status changed via details update"),
          },
        });

        await tx.auditLog.create({
          data: {
            taskId,
            changedBy: actorId,
            fieldChanged: "Task Status",
            oldValue: oldStatus,
            newValue: newStatus,
            reason: autoAssigned ? "Automatically moved to ASSIGNED after resources were assigned" : (data.reason || `Status changed from ${oldStatus} to ${newStatus} in task details edit`),
          },
        });
      }

      const oldManagerIds = (task.managers || []).map((m: any) => m.userId);
      if (JSON.stringify(finalManagerIds.sort()) !== JSON.stringify(oldManagerIds.sort())) {
        await tx.auditLog.create({
          data: {
            taskId,
            changedBy: actorId,
            fieldChanged: "Managers",
            oldValue: oldManagerIds.join(", ") || "None",
            newValue: finalManagerIds.join(", ") || "None",
            reason: "Managers list updated in task details edit",
          },
        });
      }

      const oldDevIds = (task.developers || []).map((d: any) => d.userId);
      if (JSON.stringify(finalDeveloperIds.sort()) !== JSON.stringify(oldDevIds.sort())) {
        await tx.auditLog.create({
          data: {
            taskId,
            changedBy: actorId,
            fieldChanged: "Developers",
            oldValue: oldDevIds.join(", ") || "None",
            newValue: finalDeveloperIds.join(", ") || "None",
            reason: "Developers list updated in task details edit",
          },
        });
      }

      const oldVerIds = (task.verifiers || []).map((v: any) => v.userId);
      if (JSON.stringify(finalVerifierIds.sort()) !== JSON.stringify(oldVerIds.sort())) {
        await tx.auditLog.create({
          data: {
            taskId,
            changedBy: actorId,
            fieldChanged: "Verifiers",
            oldValue: oldVerIds.join(", ") || "None",
            newValue: finalVerifierIds.join(", ") || "None",
            reason: "Verifiers list updated in task details edit",
          },
        });
      }

      return res;
    }, { maxWait: 15000, timeout: 20000 });

    return updatedTask;
  }
}
