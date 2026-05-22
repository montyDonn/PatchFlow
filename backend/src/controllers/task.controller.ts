import { Request, Response } from "express";
import { TaskService } from "../services/task.service";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { TaskStatus } from "../utils/constants";

export class TaskController {
  static async createTask(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        title,
        description,
        teamId,
        moduleId,
        plannedStartDate,
        plannedEndDate,
        clientId,
        managerId,
        managerIds,
        developerIds,
        verifierIds,
        dateGiven,
        lifecycleStatus,
        clientRequestId,
      } = req.body;
      const authorId = req.user?.userId;
      const missingFields = [
        !title && "title",
        !description && "description",
        !moduleId && "moduleId",
        (!managerId && (!managerIds || managerIds.length === 0)) && "managerId",
        lifecycleStatus === undefined && "lifecycleStatus",
        !authorId && "authorId",
      ].filter(Boolean);

      if (missingFields.length > 0) {
        return res.status(400).json({ error: `Missing required fields: ${missingFields.join(", ")}` });
      }

      const task = await TaskService.createTask({
        title: String(title).trim(),
        description: String(description).trim(),
        authorId: authorId as string,
        teamId,
        moduleId,
        clientId,
        managerId,
        managerIds,
        developerIds,
        verifierIds,
        dateGiven,
        lifecycleStatus: Number(lifecycleStatus),
        clientRequestId: clientRequestId !== undefined ? Number(clientRequestId) : undefined,
        plannedStartDate,
        plannedEndDate,
      });
      return res.status(201).json(task);
    } catch (error: any) {
      console.error("[TaskController.createTask]", error);
      if (
        error.message?.startsWith("Invalid") ||
        error.message?.startsWith("Missing") ||
        error.message?.includes("not found") ||
        error.message?.includes("selected module")
      ) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message?.startsWith("Only")) return res.status(403).json({ error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async getTasks(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const includeDeleted = req.query.includeDeleted === "true";
      const tasks = await TaskService.getTasks(req.user.role, req.user.userId, includeDeleted);
      return res.status(200).json(tasks);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async getTaskById(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const task = await TaskService.getTaskById(id);
      if (!task) return res.status(404).json({ error: "Task not found" });

      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      try {
        await TaskService.checkReadPermission(task, req.user.userId, req.user.role);
      } catch (err: any) {
        return res.status(403).json({ error: err.message });
      }

      return res.status(200).json(task);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async updateStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { status, reason } = req.body;
      const actorId = req.user?.userId;
      const taskId = req.params.id as string;
      if (!status || !actorId) return res.status(400).json({ error: "Missing required fields" });
      if (!Object.values(TaskStatus).includes(status)) return res.status(400).json({ error: "Invalid status" });
      const updatedTask = await TaskService.updateStatus(taskId, actorId, status as TaskStatus, reason);
      return res.status(200).json(updatedTask);
    } catch (error: any) {
      console.error(error);
      if (error.message === "Task not found") return res.status(404).json({ error: error.message });
      if (error.message?.startsWith("Forbidden")) return res.status(403).json({ error: error.message });
      if (error.message?.startsWith("Invalid") || error.message?.startsWith("Cannot")) return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async assignTask(req: AuthenticatedRequest, res: Response) {
    try {
      const { assigneeId } = req.body;
      const actorId = req.user?.userId;
      const taskId = req.params.id as string;
      if (!assigneeId || !actorId) return res.status(400).json({ error: "Missing required fields" });
      const updatedTask = await TaskService.assignTask(taskId, assigneeId, actorId);
      return res.status(200).json(updatedTask);
    } catch (error: any) {
      console.error(error);
      if (error.message === "Task not found") return res.status(404).json({ error: error.message });
      if (error.message?.startsWith("Forbidden")) return res.status(403).json({ error: error.message });
      if (error.message?.startsWith("Invalid") || error.message?.includes("module")) return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async softDeleteTask(req: AuthenticatedRequest, res: Response) {
    try {
      const actorId = req.user?.userId;
      const taskId = req.params.id as string;
      if (!actorId) return res.status(400).json({ error: "Missing required fields" });
      const task = await TaskService.softDeleteTask(taskId, actorId);
      return res.status(200).json(task);
    } catch (error: any) {
      console.error(error);
      if (error.message === "Task not found") return res.status(404).json({ error: error.message });
      if (error.message?.startsWith("Only")) return res.status(403).json({ error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async restoreTask(req: AuthenticatedRequest, res: Response) {
    try {
      const actorId = req.user?.userId;
      const taskId = req.params.id as string;
      if (!actorId) return res.status(400).json({ error: "Missing required fields" });
      const task = await TaskService.restoreTask(taskId, actorId);
      return res.status(200).json(task);
    } catch (error: any) {
      console.error(error);
      if (error.message === "Task not found") return res.status(404).json({ error: error.message });
      if (error.message?.startsWith("Only")) return res.status(403).json({ error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async addComment(req: AuthenticatedRequest, res: Response) {
    try {
      const actorId = req.user?.userId;
      const taskId = req.params.id as string;
      const { content, files } = req.body;
      if (!actorId || !content) return res.status(400).json({ error: "Missing required fields" });
      const task = await TaskService.addComment(taskId, actorId, String(content), files);
      return res.status(201).json(task);
    } catch (error: any) {
      console.error(error);
      if (error.message === "Task not found") return res.status(404).json({ error: error.message });
      if (error.message?.startsWith("Cannot") || error.message?.includes("required")) return res.status(400).json({ error: error.message });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async updateTaskDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const actorId = req.user?.userId;
      const taskId = req.params.id as string;
      const {
        title,
        description,
        plannedStartDate,
        plannedEndDate,
        clientId,
        clientRequestId,
        managerId,
        managerIds,
        developers,
        developerIds,
        verifiers,
        verifierIds,
        moduleId,
        dateGiven,
        dateStarted,
        dateEnded,
        status,
        reason
      } = req.body;
      if (!actorId) return res.status(400).json({ error: "Missing required fields" });
      const updated = await TaskService.updateTaskDetails(taskId, {
        title,
        description,
        plannedStartDate,
        plannedEndDate,
        clientId,
        clientRequestId: clientRequestId !== undefined ? Number(clientRequestId) : undefined,
        managerId,
        managerIds,
        developers,
        developerIds,
        verifiers,
        verifierIds,
        moduleId,
        dateGiven,
        dateStarted,
        dateEnded,
        status,
        reason
      }, actorId);
      return res.status(200).json(updated);
    } catch (error: any) {
      console.error(error);
      if (error.message?.startsWith("Forbidden")) {
        return res.status(403).json({ error: error.message });
      }
      if (
        error.message?.startsWith("Invalid") ||
        error.message?.startsWith("Missing") ||
        error.message?.includes("must belong") ||
        error.message?.includes("not found")
      ) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
