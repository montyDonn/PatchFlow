import prisma from "./src/utils/prisma";

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const module = await prisma.module.findFirst();

  if (!admin || !module) throw new Error("Missing seeded data");

  // Create task 1
  const t1 = await prisma.task.create({
    data: {
      title: "Test Task 1",
      description: "Desc",
      authorId: admin.userId,
      managerId: admin.userId,
      moduleId: module.moduleId,
      clientRequestId: 999,
      status: "DRAFT",
      lifecycleStatus: 0,
    }
  });

  console.log("Created T1:", t1.id, "Ref:", t1.clientRequestId);

  // Create task 2 with the same clientRequestId
  const t2 = await prisma.task.create({
    data: {
      title: "Test Task 2",
      description: "Desc",
      authorId: admin.userId,
      managerId: admin.userId,
      moduleId: module.moduleId,
      clientRequestId: 999,
      status: "DRAFT",
      lifecycleStatus: 0,
    }
  });

  console.log("Created T2:", t2.id, "Ref:", t2.clientRequestId);
  
  await prisma.task.deleteMany({
    where: { id: { in: [t1.id, t2.id] } }
  });
  console.log("Cleanup done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
