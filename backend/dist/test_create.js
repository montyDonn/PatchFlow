"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./utils/prisma"));
const task_service_1 = require("./services/task.service");
async function main() {
    const clientUser = await prisma_1.default.user.findFirst({ where: { role: "CLIENT" } });
    const managerUser = await prisma_1.default.user.findFirst({ where: { role: "MANAGER" } });
    const testModule = await prisma_1.default.module.findFirst();
    console.log("Client:", clientUser?.userId, "Manager:", managerUser?.userId, "Module:", testModule?.moduleId);
    try {
        const res = await task_service_1.TaskService.createTask({
            title: "Test Client Task",
            description: "Test Client Task description",
            authorId: clientUser.userId,
            moduleId: testModule.moduleId,
            managerId: managerUser.userId,
            lifecycleStatus: 0,
        });
        console.log("Success:", res);
    }
    catch (err) {
        console.error("Error occurred:", err);
    }
}
main();
