"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const prisma_1 = __importDefault(require("./utils/prisma"));
const constants_1 = require("./utils/constants");
const PORT = 5001;
let server;
// Helper to make API requests
async function apiRequest(method, path, token, body) {
    const headers = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(`http://localhost:${PORT}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    let data;
    try {
        data = await response.json();
    }
    catch {
        data = null;
    }
    return { status: response.status, data };
}
// Helper to login and get token
async function login(username) {
    const { status, data } = await apiRequest("POST", "/api/auth/login", undefined, {
        username,
        password: "Admin@123",
    });
    if (status !== 200) {
        throw new Error(`Login failed for ${username}: ${JSON.stringify(data)}`);
    }
    return data.token;
}
async function runTests() {
    console.log("Starting Workflow Verification...");
    // 1. Get seeded users & modules
    const superadminUser = await prisma_1.default.user.findFirst({ where: { role: "SUPER_ADMIN" } });
    const clientUser = await prisma_1.default.user.findFirst({ where: { role: "CLIENT" } });
    const managerUser = await prisma_1.default.user.findFirst({ where: { role: "MANAGER" } });
    const developerUser = await prisma_1.default.user.findFirst({ where: { role: "DEVELOPER" } });
    const verifierUser = await prisma_1.default.user.findFirst({ where: { role: "VERIFIER" } });
    const testModule = await prisma_1.default.module.findFirst();
    if (!superadminUser || !clientUser || !managerUser || !developerUser || !verifierUser || !testModule) {
        throw new Error("Missing seeded test data. Please run db seed first.");
    }
    console.log(`Using users:
  - Superadmin: ${superadminUser.username}
  - Client: ${clientUser.username}
  - Manager: ${managerUser.username}
  - Developer: ${developerUser.username}
  - Verifier: ${verifierUser.username}
  - Module: ${testModule.moduleName}`);
    // Connect all our test users to the test module to satisfy validation
    await Promise.all([
        prisma_1.default.user.update({
            where: { userId: clientUser.userId },
            data: { modules: { connect: { moduleId: testModule.moduleId } } }
        }),
        prisma_1.default.user.update({
            where: { userId: managerUser.userId },
            data: { modules: { connect: { moduleId: testModule.moduleId } } }
        }),
        prisma_1.default.user.update({
            where: { userId: developerUser.userId },
            data: { modules: { connect: { moduleId: testModule.moduleId } } }
        }),
        prisma_1.default.user.update({
            where: { userId: verifierUser.userId },
            data: { modules: { connect: { moduleId: testModule.moduleId } } }
        }),
    ]);
    // Connect developer and verifier to manager
    const checkDev = await prisma_1.default.userManager.findFirst({
        where: { userId: developerUser.userId, managerId: managerUser.userId }
    });
    if (!checkDev) {
        await prisma_1.default.userManager.create({
            data: { userId: developerUser.userId, managerId: managerUser.userId }
        });
    }
    const checkVer = await prisma_1.default.userManager.findFirst({
        where: { userId: verifierUser.userId, managerId: managerUser.userId }
    });
    if (!checkVer) {
        await prisma_1.default.userManager.create({
            data: { userId: verifierUser.userId, managerId: managerUser.userId }
        });
    }
    // Get tokens
    const superToken = await login(superadminUser.username);
    const clientToken = await login(clientUser.username);
    const managerToken = await login(managerUser.username);
    const devToken = await login(developerUser.username);
    const verToken = await login(verifierUser.username);
    // -------------------------------------------------------------
    // WORKFLOW 1: Client Request Pipeline
    // -------------------------------------------------------------
    console.log("\n--- Testing Workflow 1: Client Request Pipeline ---");
    // Client creates a patch request
    console.log("1. Client creates patch...");
    const createClientTaskRes = await apiRequest("POST", "/api/tasks", clientToken, {
        title: "Client Request cl1",
        description: "Workflow 1 test patch client request",
        moduleId: testModule.moduleId,
        managerId: managerUser.userId,
        lifecycleStatus: 0,
    });
    if (createClientTaskRes.status !== 201) {
        throw new Error(`Client task creation failed: ${JSON.stringify(createClientTaskRes.data)}`);
    }
    const clientTaskId = createClientTaskRes.data.id;
    console.log(`   Task created successfully: ID = ${clientTaskId}, clientId = ${createClientTaskRes.data.client?.id}`);
    if (createClientTaskRes.data.client?.id !== clientUser.userId) {
        throw new Error("Client ID was not set automatically to creator client's ID!");
    }
    // Manager assigns developer and verifier
    console.log("2. Manager assigns developer and verifier...");
    const assignRes = await apiRequest("PATCH", `/api/tasks/${clientTaskId}/details`, managerToken, {
        developers: [developerUser.userId],
        verifiers: [verifierUser.userId],
    });
    if (assignRes.status !== 200) {
        throw new Error(`Manager assignment failed: ${JSON.stringify(assignRes.data)}`);
    }
    console.log("   Developer and Verifier assigned successfully.");
    // Client transitions patch to ASSIGNED
    console.log("3. Client transitions patch to ASSIGNED...");
    const clientAssignRes = await apiRequest("PATCH", `/api/tasks/${clientTaskId}/status`, clientToken, {
        status: constants_1.TaskStatus.ASSIGNED,
        reason: "Client submitted request to assigned manager",
    });
    if (clientAssignRes.status !== 200) {
        throw new Error(`Client ASSIGNED transition failed: ${JSON.stringify(clientAssignRes.data)}`);
    }
    // Manager transitions patch to PENDING_APPROVAL
    console.log("4. Manager transitions patch to PENDING_APPROVAL...");
    const managerPendingRes = await apiRequest("PATCH", `/api/tasks/${clientTaskId}/status`, managerToken, {
        status: constants_1.TaskStatus.PENDING_APPROVAL,
        reason: "Manager approved resource allocation",
    });
    if (managerPendingRes.status !== 200) {
        throw new Error(`Manager PENDING_APPROVAL transition failed: ${JSON.stringify(managerPendingRes.data)}`);
    }
    // Manager transitions patch to IN_DEVELOPMENT
    console.log("5. Manager transitions patch to IN_DEVELOPMENT...");
    const managerInDevRes = await apiRequest("PATCH", `/api/tasks/${clientTaskId}/status`, managerToken, {
        status: constants_1.TaskStatus.IN_DEVELOPMENT,
        reason: "Approved for development",
    });
    if (managerInDevRes.status !== 200) {
        throw new Error(`Manager IN_DEVELOPMENT transition failed: ${JSON.stringify(managerInDevRes.data)}`);
    }
    // Developer transitions patch to VERIFYING
    console.log("6. Developer transitions patch to VERIFYING...");
    const devVerifyingRes = await apiRequest("PATCH", `/api/tasks/${clientTaskId}/status`, devToken, {
        status: constants_1.TaskStatus.VERIFYING,
        reason: "Development finished, ready for verification",
    });
    if (devVerifyingRes.status !== 200) {
        throw new Error(`Developer VERIFYING transition failed: ${JSON.stringify(devVerifyingRes.data)}`);
    }
    // Verifier transitions patch to COMPLETED
    console.log("7. Verifier transitions patch to COMPLETED...");
    const verifierCompRes = await apiRequest("PATCH", `/api/tasks/${clientTaskId}/status`, verToken, {
        status: constants_1.TaskStatus.COMPLETED,
        reason: "Verification passed successfully",
    });
    if (verifierCompRes.status !== 200) {
        throw new Error(`Verifier COMPLETED transition failed: ${JSON.stringify(verifierCompRes.data)}`);
    }
    console.log("   Workflow 1 Client Request verification completed successfully!");
    // -------------------------------------------------------------
    // WORKFLOW 2: Internal Request Pipeline (clientId is null)
    // -------------------------------------------------------------
    console.log("\n--- Testing Workflow 2: Internal Request Pipeline ---");
    // Developer creates an internal patch directly
    console.log("1. Developer creates internal patch directly (clientId = null)...");
    const createInternalTaskRes = await apiRequest("POST", "/api/tasks", devToken, {
        title: "Internal Request int1",
        description: "Workflow 2 test patch internal request",
        moduleId: testModule.moduleId,
        managerId: managerUser.userId,
        lifecycleStatus: 0,
    });
    if (createInternalTaskRes.status !== 201) {
        throw new Error(`Internal task creation failed: ${JSON.stringify(createInternalTaskRes.data)}`);
    }
    const internalTaskId = createInternalTaskRes.data.id;
    console.log(`   Task created successfully: ID = ${internalTaskId}, client = ${JSON.stringify(createInternalTaskRes.data.client)}`);
    if (createInternalTaskRes.data.client !== null) {
        throw new Error("Client ID was populated for internal request created by Developer!");
    }
    // Manager assigns developers and verifiers
    console.log("2. Manager assigns developer and verifier...");
    const internalAssignRes = await apiRequest("PATCH", `/api/tasks/${internalTaskId}/details`, managerToken, {
        developers: [developerUser.userId],
        verifiers: [verifierUser.userId],
    });
    if (internalAssignRes.status !== 200) {
        throw new Error(`Manager assignment failed: ${JSON.stringify(internalAssignRes.data)}`);
    }
    // Developer transitions patch to ASSIGNED
    console.log("3. Developer transitions patch to ASSIGNED...");
    const devAssignRes = await apiRequest("PATCH", `/api/tasks/${internalTaskId}/status`, devToken, {
        status: constants_1.TaskStatus.ASSIGNED,
        reason: "Developer submitted internal request",
    });
    if (devAssignRes.status !== 200) {
        throw new Error(`Developer ASSIGNED transition failed: ${JSON.stringify(devAssignRes.data)}`);
    }
    // Manager transitions patch to PENDING_APPROVAL
    console.log("4. Manager transitions patch to PENDING_APPROVAL...");
    const managerPendingRes2 = await apiRequest("PATCH", `/api/tasks/${internalTaskId}/status`, managerToken, {
        status: constants_1.TaskStatus.PENDING_APPROVAL,
        reason: "Manager approved resource allocation",
    });
    if (managerPendingRes2.status !== 200) {
        throw new Error(`Manager PENDING_APPROVAL transition failed: ${JSON.stringify(managerPendingRes2.data)}`);
    }
    // Manager transitions patch to IN_DEVELOPMENT
    console.log("5. Manager transitions patch to IN_DEVELOPMENT...");
    const managerInDevRes2 = await apiRequest("PATCH", `/api/tasks/${internalTaskId}/status`, managerToken, {
        status: constants_1.TaskStatus.IN_DEVELOPMENT,
        reason: "Approved for development",
    });
    if (managerInDevRes2.status !== 200) {
        throw new Error(`Manager IN_DEVELOPMENT transition failed: ${JSON.stringify(managerInDevRes2.data)}`);
    }
    // Developer transitions patch to VERIFYING
    console.log("6. Developer transitions patch to VERIFYING...");
    const devVerifyingRes2 = await apiRequest("PATCH", `/api/tasks/${internalTaskId}/status`, devToken, {
        status: constants_1.TaskStatus.VERIFYING,
        reason: "Development finished, ready for verification",
    });
    if (devVerifyingRes2.status !== 200) {
        throw new Error(`Developer VERIFYING transition failed: ${JSON.stringify(devVerifyingRes2.data)}`);
    }
    // Verifier transitions patch to one of the new final statuses: REJECTED
    console.log("7. Verifier transitions patch to REJECTED...");
    const verifierRejRes = await apiRequest("PATCH", `/api/tasks/${internalTaskId}/status`, verToken, {
        status: constants_1.TaskStatus.REJECTED,
        reason: "Verification failed, rejected",
    });
    if (verifierRejRes.status !== 200) {
        throw new Error(`Verifier REJECTED transition failed: ${JSON.stringify(verifierRejRes.data)}`);
    }
    console.log("   Workflow 2 Internal Request verification completed successfully!");
    // Verify Audit Logs & Notifications
    console.log("\n--- Checking Audit Logs & Notifications ---");
    const auditLogs = await prisma_1.default.auditLog.findMany({
        where: { taskId: internalTaskId },
        orderBy: { changedAt: "desc" },
    });
    console.log(`   Audit logs count for Internal Task: ${auditLogs.length}`);
    if (auditLogs.length === 0) {
        throw new Error("No audit logs were recorded!");
    }
    const notifications = await prisma_1.default.notification.findMany({
        where: { userId: verifierUser.userId },
    });
    console.log(`   Verifier notifications count: ${notifications.length}`);
    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! BOTH WORKFLOWS FULLY VERIFIED!");
}
// Start Server
server = app_1.default.listen(PORT, async () => {
    console.log(`Verification server listening on port ${PORT}`);
    try {
        await runTests();
        server.close(() => {
            process.exit(0);
        });
    }
    catch (error) {
        console.error("Test failed: ", error);
        server.close(() => {
            process.exit(1);
        });
    }
});
