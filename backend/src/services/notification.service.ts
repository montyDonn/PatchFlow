import prisma from "../utils/prisma";

export class NotificationService {
  static async createNotification(userId: string, type: string, message: string) {
    return prisma.notification.create({
      data: {
        userId,
        type,
        message,
      },
    });
  }

  static async getUserNotifications(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  static async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new Error("Notification not found");
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }
}
