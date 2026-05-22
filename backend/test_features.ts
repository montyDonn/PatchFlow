import prisma from './src/utils/prisma';
import { TaskService } from './src/services/task.service';
import { Role, TaskStatus } from './src/utils/constants';

async function runTests() {
  console.log("==================================================");
  console.log("STARTING PATCHFLOW INTEGRATION TESTS");
  console.log("==================================================");

  // 1. Setup / find users & module for testing
  // Find a Super Admin or Admin user
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, isActive: true }
  });
  if (!admin) throw new Error("No active admin or super_admin found in DB.");

  // Find a Developer user
  const dev = await prisma.user.findFirst({
    where: { role: 'DEVELOPER', isActive: true }
  });
  if (!dev) throw new Error("No active developer found in DB.");

  // Find a Manager user
  const manager = await prisma.user.findFirst({
    where: { role: 'MANAGER', isActive: true }
  });
  if (!manager) throw new Error("No active manager found in DB.");

  // Find a Verifier user
  const verifier = await prisma.user.findFirst({
    where: { role: 'VERIFIER', isActive: true }
  });
  if (!verifier) throw new Error("No active verifier found in DB.");

  // Let's create a temporary project and module for clean validation testing
  console.log("\n[Setup] Creating temporary test project, modules, and users...");
  const project = await prisma.project.create({
    data: {
      projectName: "Test Project",
      description: "Temp project for integration testing"
    }
  });

  const moduleA = await prisma.module.create({
    data: {
      moduleName: `Test_Module_A_${Date.now()}`,
      projectId: project.projectId
    }
  });

  const moduleB = await prisma.module.create({
    data: {
      moduleName: `Test_Module_B_${Date.now()}`,
      projectId: project.projectId
    }
  });

  // Create users assigned to specific modules
  // Manager A belongs to Module A
  const managerA = await prisma.user.create({
    data: {
      username: `test_manager_a_${Date.now()}`,
      name: "Manager Module A",
      passwordHash: admin.passwordHash,
      salt: admin.salt,
      role: 'MANAGER',
      isActive: true,
      modules: { connect: { moduleId: moduleA.moduleId } }
    }
  });

  // Dev A belongs to Module A
  const devA = await prisma.user.create({
    data: {
      username: `test_dev_a_${Date.now()}`,
      name: "Developer Module A",
      passwordHash: admin.passwordHash,
      salt: admin.salt,
      role: 'DEVELOPER',
      isActive: true,
      modules: { connect: { moduleId: moduleA.moduleId } }
    }
  });

  // Verifier A belongs to Module A
  const verifierA = await prisma.user.create({
    data: {
      username: `test_verifier_a_${Date.now()}`,
      name: "Verifier Module A",
      passwordHash: admin.passwordHash,
      salt: admin.salt,
      role: 'VERIFIER',
      isActive: true,
      modules: { connect: { moduleId: moduleA.moduleId } }
    }
  });

  // Dev B belongs to Module B (does NOT belong to Module A)
  const devB = await prisma.user.create({
    data: {
      username: `test_dev_b_${Date.now()}`,
      name: "Developer Module B",
      passwordHash: admin.passwordHash,
      salt: admin.salt,
      role: 'DEVELOPER',
      isActive: true,
      modules: { connect: { moduleId: moduleB.moduleId } }
    }
  });

  // Manager B belongs to Module B (does NOT belong to Module A)
  const managerB = await prisma.user.create({
    data: {
      username: `test_manager_b_${Date.now()}`,
      name: "Manager Module B",
      passwordHash: admin.passwordHash,
      salt: admin.salt,
      role: 'MANAGER',
      isActive: true,
      modules: { connect: { moduleId: moduleB.moduleId } }
    }
  });

  // Create a base task in Module A
  console.log("[Setup] Creating test patch in Module A...");
  const task = await TaskService.createTask({
    title: "Integration Test Patch",
    description: "Patch for automated verification of soft delete and module validation",
    authorId: admin.userId,
    moduleId: moduleA.moduleId,
    managerId: managerA.userId,
    lifecycleStatus: 0,
  });

  console.log(`Created Task ID: ${task.id}, Title: "${task.title}"`);

  // ==================================================
  // TEST 1: Add a comment and verify persistence
  // ==================================================
  console.log("\n--- TEST 1: Comment Persistence ---");
  const commentContent = `Test comment posted at ${new Date().toISOString()}`;
  
  // Call service method to add comment
  console.log(`Adding comment: "${commentContent}"`);
  const updatedTaskWithComment = await TaskService.addComment(task.id, admin.userId, commentContent);
  
  // Verify it exists in the returned task object
  const comment = updatedTaskWithComment.comments?.find((c: any) => c.content === commentContent);
  if (!comment) {
    throw new Error("Test 1 Failed: Comment not found in updated task object.");
  }
  
  // Verify it exists in database directly
  const dbComment = await prisma.taskComment.findFirst({
    where: { taskId: task.id, content: commentContent }
  });
  if (!dbComment) {
    throw new Error("Test 1 Failed: Comment not persisted in the database.");
  }
  
  console.log(`Comment persisted successfully in DB. ID: ${dbComment.id}, Author: ${comment.user?.name}, CreatedAt: ${comment.createdAt}`);
  console.log("TEST 1 PASSED!");

  // ==================================================
  // TEST 2: Soft delete and restore a patch
  // ==================================================
  console.log("\n--- TEST 2: Soft Delete and Restore ---");
  
  // Soft Delete task
  console.log("Soft deleting the patch...");
  const softDeletedTask = await TaskService.softDeleteTask(task.id, admin.userId);
  if (softDeletedTask.lifecycleStatus !== 100) {
    throw new Error(`Test 2 Failed: expected lifecycleStatus = 100, got ${softDeletedTask.lifecycleStatus}`);
  }

  // Verify hidden from normal views (getTasks)
  // Admin fetches tasks (which should only return lt: 100 by default)
  console.log("Verifying hidden from normal views...");
  const normalTasks = await TaskService.getTasks(admin.role, admin.userId, false);
  const taskInNormalView = normalTasks.find(t => t.id === task.id);
  if (taskInNormalView) {
    throw new Error("Test 2 Failed: Soft deleted patch is visible in normal views!");
  }
  console.log("Confirmed: Patch is hidden from normal views.");

  // Restore task
  console.log("Restoring the patch...");
  const restoredTask = await TaskService.restoreTask(task.id, admin.userId);
  if (restoredTask.lifecycleStatus !== 0) {
    throw new Error(`Test 2 Failed: expected restored lifecycleStatus = 0, got ${restoredTask.lifecycleStatus}`);
  }

  // Verify visible in normal views (getTasks)
  const activeTasksAfterRestore = await TaskService.getTasks(admin.role, admin.userId, false);
  const taskInNormalViewAfterRestore = activeTasksAfterRestore.find(t => t.id === task.id);
  if (!taskInNormalViewAfterRestore) {
    throw new Error("Test 2 Failed: Restored patch is not visible in normal views!");
  }
  console.log("Confirmed: Restored patch is visible in normal views.");
  console.log("TEST 2 PASSED!");

  // ==================================================
  // TEST 3: Try assigning a user outside the module and confirm validation fails
  // ==================================================
  console.log("\n--- TEST 3: Module Validation ---");

  // A. Assign Developer outside the module (Dev B belongs to Module B, Task belongs to Module A)
  console.log("Attempting to assign Dev B (Module B) to Task (Module A)...");
  try {
    await TaskService.updateTaskDetails(task.id, {
      developers: [devB.userId]
    }, admin.userId);
    throw new Error("Test 3 Failed: Assigned developer outside of module without error!");
  } catch (err: any) {
    if (err.message?.includes("must belong to the selected module")) {
      console.log(`Expected validation error caught: "${err.message}"`);
    } else {
      throw err;
    }
  }

  // B. Assign Verifier outside the module
  console.log("Attempting to assign Verifier B (does not exist/not in module A) to Task (Module A)...");
  // Let's assign Dev A (valid) but Verifier B (which is Verifier from default seed who isn't in Module A)
  // Let's create Verifier B who belongs to Module B
  const verifierB = await prisma.user.create({
    data: {
      username: `test_verifier_b_${Date.now()}`,
      name: "Verifier Module B",
      passwordHash: admin.passwordHash,
      salt: admin.salt,
      role: 'VERIFIER',
      isActive: true,
      modules: { connect: { moduleId: moduleB.moduleId } }
    }
  });

  try {
    await TaskService.updateTaskDetails(task.id, {
      verifiers: [verifierB.userId]
    }, admin.userId);
    throw new Error("Test 3 Failed: Assigned verifier outside of module without error!");
  } catch (err: any) {
    if (err.message?.includes("must belong to the selected module")) {
      console.log(`Expected validation error caught: "${err.message}"`);
    } else {
      throw err;
    }
  }

  // C. Assign Manager outside the module
  console.log("Attempting to assign Manager B (Module B) to Task (Module A)...");
  try {
    await TaskService.updateTaskDetails(task.id, {
      managerId: managerB.userId
    }, admin.userId);
    throw new Error("Test 3 Failed: Assigned manager outside of module without error!");
  } catch (err: any) {
    if (err.message?.includes("must belong to the selected module")) {
      console.log(`Expected validation error caught: "${err.message}"`);
    } else {
      throw err;
    }
  }

  // D. Change task module to Module B, while current assigned manager/dev/verifier (Manager A, Dev A, Verifier A) belong to Module A
  // This should fail because Manager A, Dev A, Verifier A do not belong to Module B
  console.log("First, assigning valid Manager A, Dev A, and Verifier A to the task...");
  await TaskService.updateTaskDetails(task.id, {
    developers: [devA.userId],
    verifiers: [verifierA.userId]
  }, admin.userId);
  console.log("Successfully assigned Manager A, Dev A, and Verifier A.");

  console.log("Now attempting to change task module to Module B (where Manager A, Dev A, Verifier A do not belong)...");
  try {
    await TaskService.updateTaskDetails(task.id, {
      moduleId: moduleB.moduleId
    }, admin.userId);
    throw new Error("Test 3 Failed: Changed task module to Module B without validating existing assignments!");
  } catch (err: any) {
    if (err.message?.includes("must belong to the selected module")) {
      console.log(`Expected validation error caught: "${err.message}"`);
    } else {
      throw err;
    }
  }

  console.log("TEST 3 PASSED!");

  // ==================================================
  // CLEANUP
  // ==================================================
  console.log("\n[Cleanup] Deleting temporary test data...");
  await prisma.statusHistory.deleteMany({ where: { taskId: task.id } });
  await prisma.auditLog.deleteMany({ where: { taskId: task.id } });
  await prisma.taskComment.deleteMany({ where: { taskId: task.id } });
  await prisma.task.deleteMany({ where: { id: task.id } });
  await prisma.user.deleteMany({
    where: {
      userId: {
        in: [managerA.userId, managerB.userId, devA.userId, devB.userId, verifierA.userId, verifierB.userId]
      }
    }
  });
  await prisma.module.deleteMany({ where: { moduleId: { in: [moduleA.moduleId, moduleB.moduleId] } } });
  await prisma.project.deleteMany({ where: { projectId: project.projectId } });
  console.log("Cleanup complete!");

  console.log("\n==================================================");
  console.log("ALL TESTS COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests()
  .catch(async (e) => {
    console.error("\n❌ TESTS FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
