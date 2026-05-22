import { PrismaClient } from "@prisma/client";
import { Role } from "../src/utils/constants";
import { AuthService } from "../src/services/auth.service";
import { TaskService } from "../src/services/task.service";
import "dotenv/config";

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log("Clearing existing data...");
  await prisma.notification.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.statusHistory.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.user.deleteMany({});
}

async function main() {
  console.log("Connecting to Neon Database...");
  
  await clearDatabase();

  console.log("1. Creating Users Hierarchy...");

  // Create 1 Admin
  const adminRes = await AuthService.register("admin", "password123", "Chief Executive");
  await prisma.user.update({ where: { userId: adminRes.user.userId }, data: { role: Role.SUPER_ADMIN } });
  
  // Create 2 Managers
  const manager1Res = await AuthService.register("manager1@patchflow.com", "password123", "Alice Manager");
  await prisma.user.update({ where: { userId: manager1Res.user.userId }, data: { role: Role.MANAGER } });
  
  const manager2Res = await AuthService.register("manager2@patchflow.com", "password123", "Bob Manager");
  await prisma.user.update({ where: { userId: manager2Res.user.userId }, data: { role: Role.MANAGER } });

  // Create 3 Developers
  const devARes = await AuthService.register("devA@patchflow.com", "password123", "Charlie Developer", "DEVELOPER");
  const devBRes = await AuthService.register("devB@patchflow.com", "password123", "Dave Developer", "DEVELOPER");
  const devCRes = await AuthService.register("devC@patchflow.com", "password123", "Eve Developer", "DEVELOPER");

  console.log("Users created successfully!");

  console.log("2. Managers assigning tasks to developers...");

  // Manager 1 creates a task
  const task1 = await TaskService.createTask({
    title: "Update Login Page CSS",
    description: "The login page needs to use the new glassmorphism CSS classes we defined.",
    authorId: manager1Res.user.userId,
  });

  // Manager 1 assigns task1 to Developer A
  await TaskService.assignTask(task1.id, devARes.user.userId, manager1Res.user.userId);
  console.log(`Assigned '${task1.title}' to Developer A`);

  // Manager 1 creates another task
  const task2 = await TaskService.createTask({
    title: "Fix Database Bug",
    description: "Neon database is dropping connections during high load. Investigate pooling.",
    authorId: manager1Res.user.userId,
  });

  // Manager 1 assigns task2 to Developer B
  await TaskService.assignTask(task2.id, devBRes.user.userId, manager1Res.user.userId);
  console.log(`Assigned '${task2.title}' to Developer B`);

  // Manager 2 creates a task
  const task3 = await TaskService.createTask({
    title: "Write API Documentation",
    description: "We need comprehensive markdown files detailing our API routes.",
    authorId: manager2Res.user.userId,
  });

  // Manager 2 assigns task3 to Developer C
  await TaskService.assignTask(task3.id, devCRes.user.userId, manager2Res.user.userId);
  console.log(`Assigned '${task3.title}' to Developer C`);

  console.log("=========================================");
  console.log("Database successfully populated! Check your Neon dashboard.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
