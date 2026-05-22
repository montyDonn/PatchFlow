"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const PORT = 5002;
const BASE_URL = `http://localhost:${PORT}/api`;
async function runTests() {
    console.log("Starting E2E Transition and Permission Verification...");
    // 1. Start express server on port 5002
    const server = app_1.default.listen(PORT, () => {
        console.log(`Verification server listening on port ${PORT}`);
    });
    try {
        // 2. Fetch required users for the roles
        const superadminUser = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN", isActive: true } });
        const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN", isActive: true } });
        const clientUser = await prisma.user.findFirst({ where: { role: "CLIENT", isActive: true } });
        const managerUser = await prisma.user.findFirst({ where: { role: "MANAGER", isActive: true } });
        const developerUser = await prisma.user.findFirst({ where: { role: "DEVELOPER", isActive: true } });
        const verifierUser = await prisma.user.findFirst({ where: { role: "VERIFIER", isActive: true } });
        const targetModule = await prisma.module.findFirst();
        if (!superadminUser ||
            !adminUser ||
            !clientUser ||
            !managerUser ||
            !developerUser ||
            !verifierUser ||
            !targetModule) {
            throw new Error("Required seed data (users or modules) is missing in the database!");
        }
        console.log("Target test users identified successfully.");
        // Helpers to log in and get auth headers
        const getAuthHeader = async (username) => {
            const loginRes = await fetch(`${BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    password: "Admin@123",
                }),
            });
            const data = (await loginRes.json());
            return { Authorization: `Bearer ${data.token}`, "Content-Type": "application/json" };
        };
        const headersSuper = await getAuthHeader(superadminUser.username);
        const headersClient = await getAuthHeader(clientUser.username);
        const headersManager = await getAuthHeader(managerUser.username);
        const headersDeveloper = await getAuthHeader(developerUser.username);
        const headersVerifier = await getAuthHeader(verifierUser.username);
        // Make sure the developer and verifier are managed by the manager under userManager
        // or we will link them to prevent assignment module access/manager relationship issues
        const ensureUserManager = async (userId, managerId) => {
            const existing = await prisma.userManager.findFirst({
                where: { userId, managerId }
            });
            if (!existing) {
                await prisma.userManager.create({
                    data: { userId, managerId }
                });
            }
        };
        await ensureUserManager(developerUser.userId, managerUser.userId);
        await ensureUserManager(verifierUser.userId, managerUser.userId);
        // Also link users to the module so module checks don't throw validation errors
        const linkModule = async (userId) => {
            await prisma.user.update({
                where: { userId },
                data: {
                    modules: {
                        connect: { moduleId: targetModule.moduleId },
                    },
                },
            });
        };
        await linkModule(developerUser.userId);
        await linkModule(verifierUser.userId);
        await linkModule(managerUser.userId);
        await linkModule(clientUser.userId);
        // ----------------------------------------------------
        // TEST 1: WORKFLOW PIPELINE: DRAFT -> ASSIGNED -> PENDING_APPROVAL -> IN_DEVELOPMENT -> VERIFYING -> COMPLETED
        // ----------------------------------------------------
        console.log("\n--- Running TEST 1: Standard Workflow E2E Transitions & Permissions ---");
        // 1. Client creates request (starts in DRAFT)
        const createRes = await fetch(`${BASE_URL}/tasks`, {
            method: "POST",
            headers: headersClient,
            body: JSON.stringify({
                title: "Workflow Verification Task",
                description: "Testing valid transitions and role permissions",
                moduleId: targetModule.moduleId,
                managerId: managerUser.userId,
                clientId: clientUser.userId,
                lifecycleStatus: 0,
            }),
        });
        const createTaskData = (await createRes.json());
        const taskId = createTaskData.id;
        console.log(`   Task created in DRAFT status: ID = ${taskId}`);
        // Assign developer and verifier
        await fetch(`${BASE_URL}/tasks/${taskId}/details`, {
            method: "PATCH",
            headers: headersManager,
            body: JSON.stringify({
                developers: [developerUser.userId],
                verifiers: [verifierUser.userId],
            }),
        });
        console.log("   Developer and Verifier assigned to task.");
        // A. Transition: DRAFT -> ASSIGNED
        // Try transition with DEVELOPER (Unauthorized -> should return HTTP 403)
        const tAssignedDev = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
            method: "PATCH",
            headers: headersDeveloper,
            body: JSON.stringify({ status: "ASSIGNED" }),
        });
        if (tAssignedDev.status === 403) {
            console.log("   ✅ Developer blocked from transitioning DRAFT -> ASSIGNED (403 Forbidden)");
        }
        else {
            throw new Error(`Developer transition DRAFT -> ASSIGNED returned status ${tAssignedDev.status}`);
        }
        // Try invalid transition DRAFT -> IN_DEVELOPMENT (Invalid transition -> should return HTTP 400)
        const tDraftInDev = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
            method: "PATCH",
            headers: headersClient,
            body: JSON.stringify({ status: "IN_DEVELOPMENT" }),
        });
        if (tDraftInDev.status === 400) {
            console.log("   ✅ Invalid transition DRAFT -> IN_DEVELOPMENT blocked (400 Bad Request)");
        }
        else {
            throw new Error(`Invalid transition DRAFT -> IN_DEVELOPMENT returned status ${tDraftInDev.status}`);
        }
        // Transition with CLIENT (Authorized -> 200 OK)
        const tAssigned = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
            method: "PATCH",
            headers: headersClient,
            body: JSON.stringify({ status: "ASSIGNED" }),
        });
        const tAssignedData = (await tAssigned.json());
        if (tAssigned.status === 200 && tAssignedData.status === "ASSIGNED") {
            console.log("   ✅ Client transitioned DRAFT -> ASSIGNED successfully");
        }
        else {
            throw new Error(`Client transition DRAFT -> ASSIGNED returned status ${tAssigned.status}`);
        }
        // B. Transition: ASSIGNED -> PENDING_APPROVAL
        // Try transition with CLIENT (Unauthorized -> should return HTTP 403)
        const tPendingClient = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
            method: "PATCH",
            headers: headersClient,
            body: JSON.stringify({ status: "PENDING_APPROVAL" }),
        });
        if (tPendingClient.status === 403) {
            console.log("   ✅ Client blocked from transitioning ASSIGNED -> PENDING_APPROVAL (403 Forbidden)");
        }
        else {
            throw new Error(`Client transition ASSIGNED -> PENDING_APPROVAL returned status ${tPendingClient.status}`);
        }
        // Transition with MANAGER (Authorized -> 200 OK)
        const tPending = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
            method: "PATCH",
            headers: headersManager,
            body: JSON.stringify({ status: "PENDING_APPROVAL" }),
        });
        const tPendingData = (await tPending.json());
        if (tPending.status === 200 && tPendingData.status === "PENDING_APPROVAL") {
            console.log("   ✅ Manager transitioned ASSIGNED -> PENDING_APPROVAL successfully");
        }
        else {
            throw new Error(`Manager transition ASSIGNED -> PENDING_APPROVAL returned status ${tPending.status}`);
        }
        // C. Transition: PENDING_APPROVAL -> IN_DEVELOPMENT
        // Try transition with DEVELOPER (Unauthorized -> should return HTTP 403)
        const tInDevDev = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
            method: "PATCH",
            headers: headersDeveloper,
            body: JSON.stringify({ status: "IN_DEVELOPMENT" }),
        });
        if (tInDevDev.status === 403) {
            console.log("   ✅ Developer blocked from transitioning PENDING_APPROVAL -> IN_DEVELOPMENT (403 Forbidden)");
        }
        else {
            throw new Error(`Developer transition PENDING_APPROVAL -> IN_DEVELOPMENT returned status ${tInDevDev.status}`);
        }
        // Transition with MANAGER (Authorized -> 200 OK)
        const tInDev = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
            method: "PATCH",
            headers: headersManager,
            body: JSON.stringify({ status: "IN_DEVELOPMENT" }),
        });
        const tInDevData = (await tInDev.json());
        if (tInDev.status === 200 && tInDevData.status === "IN_DEVELOPMENT") {
            console.log("   ✅ Manager transitioned PENDING_APPROVAL -> IN_DEVELOPMENT successfully");
        }
        else {
            throw new Error(`Manager transition PENDING_APPROVAL -> IN_DEVELOPMENT returned status ${tInDev.status}`);
        }
        // D. Transition: IN_DEVELOPMENT -> VERIFYING
        // Try transition with VERIFIER (Unauthorized -> should return HTTP 403)
        const tVerifyingVerifier = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
            method: "PATCH",
            headers: headersVerifier,
            body: JSON.stringify({ status: "VERIFYING" }),
        });
        if (tVerifyingVerifier.status === 403) {
            console.log("   ✅ Verifier blocked from transitioning IN_DEVELOPMENT -> VERIFYING (403 Forbidden)");
        }
        else {
            throw new Error(`Verifier transition IN_DEVELOPMENT -> VERIFYING returned status ${tVerifyingVerifier.status}`);
        }
        // Transition with DEVELOPER (Authorized -> 200 OK)
        const tVerifying = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
            method: "PATCH",
            headers: headersDeveloper,
            body: JSON.stringify({ status: "VERIFYING" }),
        });
        const tVerifyingData = (await tVerifying.json());
        if (tVerifying.status === 200 && tVerifyingData.status === "VERIFYING") {
            console.log("   ✅ Developer transitioned IN_DEVELOPMENT -> VERIFYING successfully");
        }
        else {
            throw new Error(`Developer transition IN_DEVELOPMENT -> VERIFYING returned status ${tVerifying.status}`);
        }
        // E. Transition: VERIFYING -> COMPLETED
        // Try transition with DEVELOPER (Unauthorized -> should return HTTP 403)
        const tCompletedDev = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
            method: "PATCH",
            headers: headersDeveloper,
            body: JSON.stringify({ status: "COMPLETED" }),
        });
        if (tCompletedDev.status === 403) {
            console.log("   ✅ Developer blocked from transitioning VERIFYING -> COMPLETED (403 Forbidden)");
        }
        else {
            throw new Error(`Developer transition VERIFYING -> COMPLETED returned status ${tCompletedDev.status}`);
        }
        // Transition with VERIFIER (Authorized -> 200 OK)
        const tCompleted = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
            method: "PATCH",
            headers: headersVerifier,
            body: JSON.stringify({ status: "COMPLETED" }),
        });
        const tCompletedData = (await tCompleted.json());
        if (tCompleted.status === 200 && tCompletedData.status === "COMPLETED") {
            console.log("   ✅ Verifier transitioned VERIFYING -> COMPLETED successfully");
        }
        else {
            throw new Error(`Verifier transition VERIFYING -> COMPLETED returned status ${tCompleted.status}`);
        }
        // ----------------------------------------------------
        // TEST 2: INTERRUPTIONS / RETURN / HOLD / DELAY RESUMPTION
        // ----------------------------------------------------
        console.log("\n--- Running TEST 2: Hold, Delay, Return Loops & Resumptions ---");
        const loopTaskTest = async (intermediateStatus) => {
            // 1. Create a task and fast forward to VERIFYING using SUPER_ADMIN override
            const taskRes = await fetch(`${BASE_URL}/tasks`, {
                method: "POST",
                headers: headersSuper,
                body: JSON.stringify({
                    title: `Loop Task ${intermediateStatus}`,
                    description: "Looping tests",
                    moduleId: targetModule.moduleId,
                    managerId: managerUser.userId,
                    lifecycleStatus: 0,
                }),
            });
            const loopTaskData = (await taskRes.json());
            const loopTaskId = loopTaskData.id;
            // Assign resources and change status to VERIFYING using admin override
            await fetch(`${BASE_URL}/tasks/${loopTaskId}/details`, {
                method: "PATCH",
                headers: headersSuper,
                body: JSON.stringify({
                    developers: [developerUser.userId],
                    verifiers: [verifierUser.userId],
                    status: "VERIFYING",
                }),
            });
            console.log(`   Task ${loopTaskId} fast-forwarded to VERIFYING status`);
            // Verifier transitions VERIFYING -> intermediateStatus (Authorized -> 200)
            const tInter = await fetch(`${BASE_URL}/tasks/${loopTaskId}/status`, {
                method: "PATCH",
                headers: headersVerifier,
                body: JSON.stringify({ status: intermediateStatus }),
            });
            const tInterData = (await tInter.json());
            if (tInter.status === 200 && tInterData.status === intermediateStatus) {
                console.log(`   ✅ Verifier transitioned VERIFYING -> ${intermediateStatus} successfully`);
            }
            else {
                throw new Error(`Verifier transition VERIFYING -> ${intermediateStatus} returned status ${tInter.status}`);
            }
            // Try transition intermediateStatus -> IN_DEVELOPMENT with CLIENT (Unauthorized -> 403)
            const tResumeClient = await fetch(`${BASE_URL}/tasks/${loopTaskId}/status`, {
                method: "PATCH",
                headers: headersClient,
                body: JSON.stringify({ status: "IN_DEVELOPMENT" }),
            });
            if (tResumeClient.status === 403) {
                console.log(`   ✅ Client blocked from transitioning ${intermediateStatus} -> IN_DEVELOPMENT (403 Forbidden)`);
            }
            else {
                throw new Error(`Client transition ${intermediateStatus} -> IN_DEVELOPMENT returned status ${tResumeClient.status}`);
            }
            // Transition intermediateStatus -> IN_DEVELOPMENT with DEVELOPER (Authorized -> 200)
            const tResume = await fetch(`${BASE_URL}/tasks/${loopTaskId}/status`, {
                method: "PATCH",
                headers: headersDeveloper,
                body: JSON.stringify({ status: "IN_DEVELOPMENT" }),
            });
            const tResumeData = (await tResume.json());
            if (tResume.status === 200 && tResumeData.status === "IN_DEVELOPMENT") {
                console.log(`   ✅ Developer transitioned ${intermediateStatus} -> IN_DEVELOPMENT successfully`);
            }
            else {
                throw new Error(`Developer transition ${intermediateStatus} -> IN_DEVELOPMENT returned status ${tResume.status}`);
            }
        };
        await loopTaskTest("RETURNED_TO_DEVELOPER");
        await loopTaskTest("DELAYED");
        await loopTaskTest("ON_HOLD");
        // ----------------------------------------------------
        // TEST 3: SUPER_ADMIN OVERRIDE POWER
        // ----------------------------------------------------
        console.log("\n--- Running TEST 3: Super Admin Override Power ---");
        const superTaskRes = await fetch(`${BASE_URL}/tasks`, {
            method: "POST",
            headers: headersSuper,
            body: JSON.stringify({
                title: "Override Task",
                description: "Checking admin overrides",
                moduleId: targetModule.moduleId,
                managerId: managerUser.userId,
                lifecycleStatus: 0,
            }),
        });
        const superTaskData = (await superTaskRes.json());
        const superTaskId = superTaskData.id;
        // Super Admin jumps from DRAFT directly to IN_DEVELOPMENT bypassing ASSIGNED and PENDING_APPROVAL
        const tOverride = await fetch(`${BASE_URL}/tasks/${superTaskId}/status`, {
            method: "PATCH",
            headers: headersSuper,
            body: JSON.stringify({ status: "IN_DEVELOPMENT" }),
        });
        const tOverrideData = (await tOverride.json());
        if (tOverride.status === 200 && tOverrideData.status === "IN_DEVELOPMENT") {
            console.log("   ✅ Super Admin bypassed workflow rules and transitioned DRAFT -> IN_DEVELOPMENT successfully");
        }
        else {
            throw new Error(`Super Admin override returned status ${tOverride.status}`);
        }
        console.log("\n🎉 ALL E2E WORKFLOW AND PERMISSION TESTS PASSED SUCCESSFULLY!");
    }
    finally {
        server.close(() => {
            console.log("Verification server shut down.");
        });
    }
}
runTests().catch((err) => {
    console.error("Test failed: ", err);
    process.exit(1);
});
