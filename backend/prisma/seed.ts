import { PrismaClient, user_role as Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { TaskStatus } from '../src/utils/constants';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Seed Script (Clean Database & Populate New Roles)...');

  // 1. Clean up existing records in correct order to avoid foreign key violations
  console.log('Truncating legacy tables for a clean slate...');
  await prisma.statusHistory.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.taskAttachment.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.userManager.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.module.deleteMany();
  await prisma.team.deleteMany();
  await prisma.project.deleteMany();
  console.log('Database successfully cleaned.');

  // 2. Password Hashing (Cost factor 12)
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash('Admin@123', salt);

  // 3. Create Project
  const project = await prisma.project.create({
    data: { projectName: 'Patch & Resource Migration', description: 'Core system project' }
  });

  // 4. Create Modules (10 required modules)
  const moduleNames = ['NSC', 'DND', 'CSC', 'BILLING', 'METERING', 'FAM', 'MOBILE_BILLING', 'INTEGRATION', 'SMART_METER', 'REPORT'];
  const modules = [];
  for (const name of moduleNames) {
    const mod = await prisma.module.create({
      data: { moduleName: name, projectId: project.projectId }
    });
    modules.push(mod);
    await new Promise(resolve => setTimeout(resolve, 5)); // prevent timestamp collisions
  }
  console.log('Created 10 Modules.');

  // 5. Seed Users (Exactly 50 active users according to target distribution)
  const roleDistribution = [
    { role: 'SUPER_ADMIN', count: 2, prefix: 'superadmin' },
    { role: 'CLIENT', count: 5, prefix: 'client' },
    { role: 'ADMIN', count: 3, prefix: 'admin' },
    { role: 'MANAGER', count: 5, prefix: 'manager' },
    { role: 'DEVELOPER', count: 25, prefix: 'developer' },
    { role: 'VERIFIER', count: 10, prefix: 'verifier' },
  ];

  const allUsers = [];
  for (const dist of roleDistribution) {
    for (let i = 1; i <= dist.count; i++) {
      const username = `${dist.prefix}${i}`;
      const user = await prisma.user.create({
        data: {
          username,
          name: `${dist.role.replace(/_/g, ' ')} ${i}`,
          passwordHash,
          salt,
          role: dist.role as Role,
          isActive: true
        }
      });
      allUsers.push(user);
    }
  }
  console.log(`Successfully seeded exactly ${allUsers.length} Users.`);

  // Prepare managers pool
  const managers = allUsers.filter(u => ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(u.role));
  const superAdmin = allUsers.find(u => u.role === 'SUPER_ADMIN')!;
  const clients = allUsers.filter(u => u.role === 'CLIENT');
  const developers = allUsers.filter(u => u.role === 'DEVELOPER');
  const verifiers = allUsers.filter(u => u.role === 'VERIFIER');

  // 6. Assign Modules (1-5) and Managers (1-3)
  console.log('Assigning Modules and Managers...');
  for (const user of allUsers) {
    const numModules = Math.floor(Math.random() * 5) + 1;
    const assignedModules = [...modules].sort(() => 0.5 - Math.random()).slice(0, numModules);
    
    // Explicitly add specific test users to NSC module
    if (
      ['manager1', 'developer1', 'developer2', 'developer3', 'verifier1', 'verifier2'].includes(user.username)
    ) {
      const nscMod = modules.find(m => m.moduleName === 'NSC')!;
      if (!assignedModules.some(m => m.moduleId === nscMod.moduleId)) {
        assignedModules.push(nscMod);
      }
    }
    
    let assignedManagers: any[] = [];
    if (!['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user.role)) {
      const numManagers = Math.floor(Math.random() * 3) + 1;
      assignedManagers = [...managers].sort(() => 0.5 - Math.random()).slice(0, numManagers);
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { userId: user.userId },
        data: {
          modules: {
            connect: assignedModules.map(m => ({ moduleId: m.moduleId }))
          }
        }
      }),
      prisma.userManager.createMany({
        data: assignedManagers.map(m => ({
          userId: user.userId,
          managerId: m.userId
        }))
      })
    ]);
  }
  console.log('Completed User relationships.');

  // 7. Create realistic demo patches using the new roles
  const moduleByName = new Map(modules.map((module) => [module.moduleName, module]));

  const demoPatches = [
    {
      title: 'Demo BILLING Draft: GST slab reconciliation patch',
      description: 'Prepare billing tariff calculation changes for the May regulatory update before assignment review.',
      moduleName: 'BILLING',
      status: TaskStatus.DRAFT,
      client: null,
      manager: managers[0],
      devs: [developers[0]],
      vers: [verifiers[0]],
      dateGiven: new Date(),
    },
    {
      title: 'Demo METERING Assigned: AMR read validation patch',
      description: 'Correct validation for delayed AMR meter reads and route failed reads to exception queues.',
      moduleName: 'METERING',
      status: TaskStatus.ASSIGNED,
      client: clients[1],
      manager: managers[1],
      devs: [developers[1], developers[2]],
      vers: [verifiers[1]],
      dateGiven: new Date(),
    },
    {
      title: 'Demo SMART_METER Pending Approval: DLMS retry tuning',
      description: 'Tune DLMS retry windows for intermittent smart meter connections in high-loss feeders.',
      moduleName: 'SMART_METER',
      status: TaskStatus.PENDING_APPROVAL,
      client: clients[2],
      manager: managers[2],
      devs: [developers[3]],
      vers: [verifiers[2], verifiers[3]],
      dateGiven: new Date(),
    },
    {
      title: 'Demo CSC In Development: complaint SLA escalation patch',
      description: 'Implement escalation rule changes so CSC complaints breach notifications reach supervisors on time.',
      moduleName: 'CSC',
      status: TaskStatus.IN_DEVELOPMENT,
      client: clients[3],
      manager: managers[3],
      devs: [developers[4], developers[5]],
      vers: [verifiers[4]],
      dateGiven: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      dateStarted: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      title: 'Demo REPORT Verifying: feeder loss dashboard patch',
      description: 'Verify aggregate feeder loss reports after adding exception handling for missing interval data.',
      moduleName: 'REPORT',
      status: TaskStatus.VERIFYING,
      client: clients[4],
      manager: managers[4],
      devs: [developers[6]],
      vers: [verifiers[5]],
      dateGiven: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      dateStarted: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      title: 'Demo FAM Completed: asset deprecation fixes',
      description: 'Fixed incorrect double depreciation calculations on retired asset categories.',
      moduleName: 'FAM',
      status: TaskStatus.COMPLETED,
      client: clients[0],
      manager: managers[0],
      devs: [developers[7], developers[8]],
      vers: [verifiers[6]],
      dateGiven: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      dateStarted: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      dateEnded: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const patch of demoPatches) {
    const module = moduleByName.get(patch.moduleName);
    if (!module || !patch.manager || patch.devs.length === 0 || patch.vers.length === 0) {
      throw new Error(`Unable to seed demo patch "${patch.title}" because a required owner or module is missing.`);
    }

    // Ensure users belong to the patch module
    const assignees = [patch.client, patch.manager, ...patch.devs, ...patch.vers].filter(Boolean) as any[];
    for (const owner of assignees) {
      await prisma.user.update({
        where: { userId: owner.userId },
        data: {
          modules: {
            connect: { moduleId: module.moduleId }
          }
        }
      });
    }

    const task = await prisma.task.create({
      data: {
        title: patch.title,
        description: patch.description,
        status: patch.status,
        lifecycleStatus: 0,
        authorId: superAdmin.userId,
        clientId: patch.client ? patch.client.userId : null,
        managerId: patch.manager.userId,
        moduleId: module.moduleId,
        dateGiven: patch.dateGiven,
        dateStarted: (patch as any).dateStarted || null,
        dateEnded: (patch as any).dateEnded || null,
        developers: {
          connect: patch.devs.map(d => ({ userId: d.userId }))
        },
        verifiers: {
          connect: patch.vers.map(v => ({ userId: v.userId }))
        }
      },
    });

    await prisma.statusHistory.create({
      data: {
        taskId: task.id,
        previousStatus: TaskStatus.DRAFT,
        newStatus: patch.status,
        changedById: superAdmin.userId,
        reason: `Demo seed set workflow stage to ${patch.status}`,
      },
    });

    await prisma.auditLog.create({
      data: {
        taskId: task.id,
        changedBy: superAdmin.userId,
        fieldChanged: 'Demo Patch Seed',
        newValue: patch.title,
        reason: 'Idempotent demo patch seed',
      },
    });
  }

  console.log('Realistic demo patches with StatusHistory and AuditLog entries successfully seeded.');
  console.log('Seeding executed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
