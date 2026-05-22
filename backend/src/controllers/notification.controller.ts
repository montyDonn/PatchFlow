import { Response } from "express";
import { NotificationService } from "../services/notification.service";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

export class NotificationController {
  static async getMyNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const notifications = await NotificationService.getUserNotifications(req.user.userId);
      return res.status(200).json(notifications);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  static async markAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const notificationId = req.params.id as string;
      const updated = await NotificationService.markAsRead(notificationId, req.user.userId);
      
      return res.status(200).json(updated);
    } catch (error: any) {
      if (error.message === "Notification not found") {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  }
}
