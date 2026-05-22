import prisma from './src/utils/prisma';
async function main() {
  const users = await prisma.user.findMany({ select: { username: true, role: true } });
  console.log(users);
}
main().catch(console.error).finally(() => prisma.$disconnect());
