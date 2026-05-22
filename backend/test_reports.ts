import prisma from './src/utils/prisma';
import { TaskService } from './src/services/task.service';
import { ReportController } from './src/controllers/report.controller';
import { Role, TaskStatus } from './src/utils/constants';

async function runTests() {
  console.log("==================================================");
  console.log("STARTING PATCHFLOW REPORTS INTEGRATION TESTS");
  console.log("==================================================");

  // 1. Setup / find users & modules
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, isActive: true }
  });
  if (!admin) throw new Error("No active admin or super_admin found in DB.");

  const manager = await prisma.user.findFirst({
    where: { role: 'MANAGER', isActive: true }
  });
  if (!manager) throw new Error("No active manager found in DB.");

  const developer = await prisma.user.findFirst({
    where: { role: 'DEVELOPER', isActive: true }
  });
  if (!developer) throw new Error("No active developer found in DB.");

  const verifier = await prisma.user.findFirst({
    where: { role: 'VERIFIER', isActive: true }
  });
  if (!verifier) throw new Error("No active verifier found in DB.");

  console.log("\n[Setup] Creating test project, module, and users...");
  const project = await prisma.project.create({
    data: {
      projectName: "Reports Test Project",
      description: "Temp project for reports testing"
    }
  });

  const module = await prisma.module.create({
    data: {
      moduleName: `Reports_Module_${Date.now()}`,
      projectId: project.projectId
    }
  });

  // Client 1 (for testing client-scoping)
  const client1 = await prisma.user.create({
    data: {
      username: `test_client1_${Date.now()}`,
      name: "Client One",
      passwordHash: admin.passwordHash,
      salt: admin.salt,
      role: 'CLIENT',
      isActive: true,
      modules: { connect: { moduleId: module.moduleId } }
    }
  });

  // Client 2 (should NOT see Client 1's reports)
  const client2 = await prisma.user.create({
    data: {
      username: `test_client2_${Date.now()}`,
      name: "Client Two",
      passwordHash: admin.passwordHash,
      salt: admin.salt,
      role: 'CLIENT',
      isActive: true,
      modules: { connect: { moduleId: module.moduleId } }
    }
  });

  // Add them to the modules for seed integrity
  for (const u of [admin, manager, developer, verifier]) {
    await prisma.user.update({
      where: { userId: u.userId },
      data: { modules: { connect: { moduleId: module.moduleId } } }
    });
  }

  // ==================================================
  // TEST 1: Immediate Listing in Reports
  // ==================================================
  console.log("\n--- TEST 1: Immediate Listing in Reports ---");
  
  // Create patch for Client 1
  console.log("Creating a patch request under Client 1...");
  const task = await TaskService.createTask({
    title: "Reports Testing Patch",
    description: "Verification of reports columns, filter, and exports",
    authorId: client1.userId,
    moduleId: module.moduleId,
    managerId: manager.userId,
    clientId: client1.userId,
    lifecycleStatus: 0,
  });

  // Call ReportController.getReportData directly with Admin role
  console.log("Querying report data as Admin...");
  let reportResult: any = null;
  const mockRes = {
    status: (code: number) => ({
      json: (data: any) => {
        reportResult = data;
      }
    })
  } as any;

  await ReportController.getReportData({
    user: admin,
    query: { moduleId: module.moduleId }
  } as any, mockRes);

  if (!reportResult || !reportResult.success) {
    throw new Error(`Report query failed: ${JSON.stringify(reportResult)}`);
  }

  const reportsList = reportResult.data;
  const reportItem = reportsList.find((t: any) => t.id === task.id);
  if (!reportItem) {
    throw new Error("Test 1 Failed: The newly created patch did not appear in reports immediately.");
  }

  console.log(`Success! Created patch appeared in reports immediately. ID: ${reportItem.id}, Title: "${reportItem.title}"`);
  console.log("TEST 1 PASSED!");

  // ==================================================
  // TEST 2: Status Changes and Automatically Updated Timestamps
  // ==================================================
  console.log("\n--- TEST 2: Status Changes Auto-tracking (dateStarted & dateEnded) ---");

  // A. Transition status to IN_DEVELOPMENT
  console.log("Transitioning status to IN_DEVELOPMENT...");
  // Let's assign developer
  await TaskService.updateTaskDetails(task.id, { developers: [developer.userId] }, admin.userId);
  await TaskService.updateStatus(task.id, admin.userId, TaskStatus.IN_DEVELOPMENT, "Starting development work");

  // Fetch report data and verify dateStarted is set
  let reportResultAfterStart: any = null;
  await ReportController.getReportData({
    user: admin,
    query: { moduleId: module.moduleId }
  } as any, {
    status: (code: number) => ({
      json: (data: any) => {
        reportResultAfterStart = data;
      }
    })
  } as any);

  const taskAfterStart = reportResultAfterStart.data.find((t: any) => t.id === task.id);
  if (!taskAfterStart.dateStarted) {
    throw new Error("Test 2 Failed: dateStarted is null after transitioning to IN_DEVELOPMENT.");
  }
  console.log(`Confirmed: dateStarted is set automatically: ${taskAfterStart.dateStarted}`);

  // B. Transition status to COMPLETED
  console.log("Transitioning status to COMPLETED...");
  // Let's assign verifier and complete verification
  await TaskService.updateTaskDetails(task.id, { verifiers: [verifier.userId] }, admin.userId);
  await TaskService.updateStatus(task.id, admin.userId, TaskStatus.VERIFYING, "Submitting for verification");
  await TaskService.updateStatus(task.id, admin.userId, TaskStatus.COMPLETED, "Verification passed");

  // Fetch report data and verify dateEnded is set
  let reportResultAfterEnd: any = null;
  await ReportController.getReportData({
    user: admin,
    query: { moduleId: module.moduleId }
  } as any, {
    status: (code: number) => ({
      json: (data: any) => {
        reportResultAfterEnd = data;
      }
    })
  } as any);

  const taskAfterEnd = reportResultAfterEnd.data.find((t: any) => t.id === task.id);
  if (!taskAfterEnd.dateEnded) {
    throw new Error("Test 2 Failed: dateEnded is null after transitioning to COMPLETED.");
  }
  console.log(`Confirmed: dateEnded is set automatically: ${taskAfterEnd.dateEnded}`);
  console.log("TEST 2 PASSED!");

  // ==================================================
  // TEST 3: CLIENT Scoping (View only their own reports)
  // ==================================================
  console.log("\n--- TEST 3: CLIENT Scoping ---");

  // Query reports as Client 1 (who belongs to the task)
  console.log("Querying report data as Client 1...");
  let client1Reports: any = null;
  await ReportController.getReportData({
    user: client1,
    query: { moduleId: module.moduleId }
  } as any, {
    status: (code: number) => ({
      json: (data: any) => {
        client1Reports = data;
      }
    })
  } as any);

  const client1HasTask = client1Reports.data.some((t: any) => t.id === task.id);
  if (!client1HasTask) {
    throw new Error("Test 3 Failed: Client 1 cannot see their own reports!");
  }
  console.log("Confirmed: Client 1 can see their own patch report.");

  // Query reports as Client 2 (who does NOT belong to the task)
  console.log("Querying report data as Client 2...");
  let client2Reports: any = null;
  await ReportController.getReportData({
    user: client2,
    query: { moduleId: module.moduleId }
  } as any, {
    status: (code: number) => ({
      json: (data: any) => {
        client2Reports = data;
      }
    })
  } as any);

  const client2HasTask = client2Reports.data.some((t: any) => t.id === task.id);
  if (client2HasTask) {
    throw new Error("Test 3 Failed: Client 2 can see Client 1's report! Client scoping is bypassed!");
  }
  console.log("Confirmed: Client 2 CANNOT see Client 1's patch report. Complete tenant isolation verified.");
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
        in: [client1.userId, client2.userId]
      }
    }
  });
  await prisma.module.deleteMany({ where: { moduleId: module.moduleId } });
  await prisma.project.deleteMany({ where: { projectId: project.projectId } });
  console.log("Cleanup complete!");

  console.log("\n==================================================");
  console.log("ALL REPORTS TESTS COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests()
  .catch(async (e) => {
    console.error("\n❌ REPORTS TESTS FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
