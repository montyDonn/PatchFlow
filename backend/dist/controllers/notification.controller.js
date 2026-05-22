"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const notification_service_1 = require("../services/notification.service");
class NotificationController {
    static async getMyNotifications(req, res) {
        try {
            if (!req.user)
                return res.status(401).json({ error: "Unauthorized" });
            const notifications = await notification_service_1.NotificationService.getUserNotifications(req.user.userId);
            return res.status(200).json(notifications);
        }
        catch (error) {
            console.error(error);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
    static async markAsRead(req, res) {
        try {
            if (!req.user)
                return res.status(401).json({ error: "Unauthorized" });
            const notificationId = req.params.id;
            const updated = await notification_service_1.NotificationService.markAsRead(notificationId, req.user.userId);
            return res.status(200).json(updated);
        }
        catch (error) {
            if (error.message === "Notification not found") {
                return res.status(404).json({ error: error.message });
            }
            return res.status(500).json({ error: "Internal server error" });
        }
    }
}
exports.NotificationController = NotificationController;
