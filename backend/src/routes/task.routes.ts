import { Router } from "express";
import { TaskController } from "../controllers/task.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

router.post("/", authorize(["SUPER_ADMIN", "ADMIN", "CLIENT", "MANAGER", "DEVELOPER"]), TaskController.createTask);
router.get("/", TaskController.getTasks);
router.get("/:id", TaskController.getTaskById);
router.patch("/:id/status", TaskController.updateStatus);
router.post("/:id/comments", TaskController.addComment);
router.delete("/:id", TaskController.softDeleteTask);
router.post("/:id/restore", TaskController.restoreTask);
router.post("/:id/assign", TaskController.assignTask);
router.patch("/:id/details", TaskController.updateTaskDetails);

export default router;
