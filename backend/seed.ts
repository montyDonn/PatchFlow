import { AuthService } from "./src/services/auth.service";
import { TaskService } from "./src/services/task.service";
import prisma from "./src/utils/prisma";

async function main() {
  console.log("Seeding database...");

  // Create or get SUPER_ADMIN
  let admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!admin) {
    console.log("Creating Admin...");
    const adminRes = await AuthService.register("admin@patchflow.com", "password123", "Super", "Admin", "SUPER_ADMIN");
    admin = await prisma.user.findUnique({ where: { userId: adminRes.user.userId } });
  }

  // Create Manager
  console.log("Creating Manager...");
  let manager = await prisma.user.findUnique({ where: { username: "manager@patchflow.com" } });
  if (!manager) {
    const managerRes = await AuthService.register("manager@patchflow.com", "password123", "Alice", "Manager", "MANAGER");
    manager = await prisma.user.findUnique({ where: { userId: managerRes.user.userId } });
  }

  // Create Developer
  console.log("Creating Developer...");
  let dev1 = await prisma.user.findUnique({ where: { username: "dev1@patchflow.com" } });
  if (!dev1) {
    const dev1Res = await AuthService.register("dev1@patchflow.com", "password123", "Bob", "Developer", "DEVELOPER");
    dev1 = await prisma.user.findUnique({ where: { userId: dev1Res.user.userId } });
  }

  // Create Developer 2
  let dev2 = await prisma.user.findUnique({ where: { username: "dev2@patchflow.com" } });
  if (!dev2) {
    const dev2Res = await AuthService.register("dev2@patchflow.com", "password123", "Charlie", "Developer", "DEVELOPER");
    dev2 = await prisma.user.findUnique({ where: { userId: dev2Res.user.userId } });
  }

  // Create Tasks if they don't exist
  const tasksCount = await prisma.task.count();
  if (tasksCount < 2 && admin && manager && dev1) {
    console.log("Creating Tasks...");
    await TaskService.createTask({
      title: "Fix Navigation Bar Layout",
      description: "The navigation bar is misaligned on mobile devices.",
      authorId: admin.id
    });

    const task2 = await TaskService.createTask({
      title: "Optimize Database Queries",
      description: "The dashboard is loading too slowly. Please optimize the Task fetching query.",
      authorId: manager.id
    });

    // Assign one task
    if (dev1) {
      console.log("Assigning task...");
      await TaskService.assignTask(task2.id, dev1.id, manager.id);
    }
  }

  console.log("Seeding complete! You can view this on the Dashboard or Neon DB console.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
