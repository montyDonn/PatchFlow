"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
class NotificationService {
    static async createNotification(userId, type, message) {
        return prisma_1.default.notification.create({
            data: {
                userId,
                type,
                message,
            },
        });
    }
    static async getUserNotifications(userId) {
        return prisma_1.default.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
    }
    static async markAsRead(notificationId, userId) {
        const notification = await prisma_1.default.notification.findUnique({
            where: { id: notificationId },
        });
        if (!notification || notification.userId !== userId) {
            throw new Error("Notification not found");
        }
        return prisma_1.default.notification.update({
            where: { id: notificationId },
            data: { read: true },
        });
    }
}
exports.NotificationService = NotificationService;
