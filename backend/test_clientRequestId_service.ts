import prisma from "./src/utils/prisma";
import { TaskService } from "./src/services/task.service";
import { Role } from "./src/utils/constants";

async function main() {
  console.log("=== STARTING SERVICE-LEVEL TESTS ===");

  // Find or create test users
  let admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        username: "testadmin",
        passwordHash: "hash",
        name: "Test Admin",
        role: Role.ADMIN,
        isActive: true,
      }
    });
  }

  let manager = await prisma.user.findFirst({ where: { role: Role.MANAGER } });
  if (!manager) {
    manager = await prisma.user.create({
      data: {
        username: "testmanager",
        passwordHash: "hash",
        name: "Test Manager",
        role: Role.MANAGER,
        isActive: true,
      }
    });
  }

  let client = await prisma.user.findFirst({ where: { role: Role.CLIENT } });
  if (!client) {
    client = await prisma.user.create({
      data: {
        username: "testclient",
        passwordHash: "hash",
        name: "Test Client",
        role: Role.CLIENT,
        isActive: true,
      }
    });
  }

  // Create a new module specifically for this test
  // Do NOT add the client user to this module's members to ensure we test membership exemption
  const testModule = await prisma.module.create({
    data: {
      moduleName: "Validation Exemption Module",
      isActive: true,
    }
  });

  // Assign the manager user to this module so they can manage it
  await prisma.moduleMember.create({
    data: {
      moduleId: testModule.moduleId,
      userId: manager.userId,
    }
  });

  console.log("Seeded test environment. Module ID:", testModule.moduleId);

  const createdTasks: string[] = [];

  try {
    // 1. Create first CLIENT request (Client Request ID = 555)
    // Client is NOT a member of this module, but it should pass validation!
    console.log("\nTesting Client request creation (Validation Exemption)...");
    const task1 = await TaskService.createTask({
      title: "Client Task 1",
      description: "Testing Client Request ID",
      moduleId: testModule.moduleId,
      clientId: client.userId,
      clientRequestId: 555,
      managerId: manager.userId,
      lifecycleStatus: 0,
    }, { userId: admin.userId, role: Role.ADMIN });

    createdTasks.push(task1.id);
    console.log("Successfully created Task 1. ID:", task1.id, "clientId:", task1.clientId, "clientRequestId:", task1.clientRequestId);

    if (task1.clientId !== client.userId || task1.clientRequestId !== 555) {
      throw new Error("Task 1 fields did not match expected values");
    }

    // 2. Create second CLIENT request with DUPLICATE Client Request ID (555)
    console.log("\nTesting duplicate Client Request ID creation...");
    const task2 = await TaskService.createTask({
      title: "Client Task 2",
      description: "Testing Duplicate Client Request ID",
      moduleId: testModule.moduleId,
      clientId: client.userId,
      clientRequestId: 555,
      managerId: manager.userId,
      lifecycleStatus: 0,
    }, { userId: admin.userId, role: Role.ADMIN });

    createdTasks.push(task2.id);
    console.log("Successfully created Task 2. ID:", task2.id, "clientId:", task2.clientId, "clientRequestId:", task2.clientRequestId);

    if (task2.clientId !== client.userId || task2.clientRequestId !== 555) {
      throw new Error("Task 2 fields did not match expected values");
    }

    // 3. Create INTERNAL request with clientId = undefined/null
    // Verify clientRequestId is forced to 0
    console.log("\nTesting Internal Request (clientId = null, clientRequestId forced to 0)...");
    const task3 = await TaskService.createTask({
      title: "Internal Task",
      description: "Testing Internal Request",
      moduleId: testModule.moduleId,
      clientRequestId: 555, // Should be coerced to 0 because clientId is not provided
      managerId: manager.userId,
      lifecycleStatus: 0,
    }, { userId: admin.userId, role: Role.ADMIN });

    createdTasks.push(task3.id);
    console.log("Successfully created Task 3. ID:", task3.id, "clientId:", task3.clientId, "clientRequestId:", task3.clientRequestId);

    if (task3.clientId !== null || task3.clientRequestId !== 0) {
      throw new Error("Task 3 fields did not match expected values (clientId should be null, clientRequestId should be 0)");
    }

    // 4. Test updating internal request to client request
    console.log("\nTesting update internal request to client request...");
    const updatedTask = await TaskService.updateTaskDetails(task3.id, {
      clientId: client.userId,
      clientRequestId: 777,
    }, { userId: admin.userId, role: Role.ADMIN } as any);

    console.log("Successfully updated Task 3. ID:", updatedTask.id, "clientId:", updatedTask.clientId, "clientRequestId:", updatedTask.clientRequestId);

    if (updatedTask.clientId !== client.userId || updatedTask.clientRequestId !== 777) {
      throw new Error("Task 3 update fields did not match expected values");
    }

    // 5. Test updating client request to internal request (forces clientRequestId back to 0)
    console.log("\nTesting update client request back to internal request...");
    const revertedTask = await TaskService.updateTaskDetails(task3.id, {
      clientId: null as any,
    }, { userId: admin.userId, role: Role.ADMIN } as any);

    console.log("Successfully reverted Task 3. ID:", revertedTask.id, "clientId:", revertedTask.clientId, "clientRequestId:", revertedTask.clientRequestId);

    if (revertedTask.clientId !== null || revertedTask.clientRequestId !== 0) {
      throw new Error("Task 3 revert fields did not match expected values (should be null / 0)");
    }

    console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");

  } finally {
    console.log("\nCleaning up test resources...");
    if (createdTasks.length > 0) {
      await prisma.task.deleteMany({
        where: { id: { in: createdTasks } }
      });
    }
    await prisma.moduleMember.deleteMany({
      where: { moduleId: testModule.moduleId }
    });
    await prisma.module.delete({
      where: { moduleId: testModule.moduleId }
    });
    console.log("Cleanup completed.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
