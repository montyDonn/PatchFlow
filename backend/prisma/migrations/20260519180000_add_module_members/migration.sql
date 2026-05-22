-- CreateTable: ModuleMember for module-based resource pools with roles
CREATE TABLE "ModuleMember" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "moduleId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint to prevent duplicate user-module-role combinations
CREATE UNIQUE INDEX "ModuleMember_moduleId_userId_key" ON "ModuleMember"("moduleId", "userId");

-- AddForeignKey
ALTER TABLE "ModuleMember" ADD CONSTRAINT "ModuleMember_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("moduleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleMember" ADD CONSTRAINT "ModuleMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing Module-User relationships to ModuleMember
-- For each existing user-module relationship, we'll infer the role based on the user's global role
INSERT INTO "ModuleMember" ("moduleId", "userId", "role", "assignedAt")
SELECT 
    m."moduleId",
    u."userId",
    u."role" as "role",  -- Use the user's global role as their module role
    CURRENT_TIMESTAMP
FROM "_UserModules" um
INNER JOIN "Module" m ON um."B" = m."moduleId"
INNER JOIN "User" u ON um."A" = u."userId"
ON CONFLICT ("moduleId", "userId") DO NOTHING;

-- Note: The implicit _UserModules table is still used by Prisma for the many-to-many relation
-- We're keeping both for backward compatibility and adding ModuleMember for role tracking
