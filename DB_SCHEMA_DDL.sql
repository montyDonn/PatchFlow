CREATE TABLE IF NOT EXISTS "Project" (
    "projectId"   VARCHAR(36)              NOT NULL,
    "projectName" VARCHAR(100)             NOT NULL,
    "description" TEXT,
    "isActive"    BOOLEAN                  NOT NULL DEFAULT TRUE,
    "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "Project_pkey" PRIMARY KEY ("projectId")
);
CREATE TABLE IF NOT EXISTS "Team" (
    "id"        VARCHAR(36)  NOT NULL,
    "name"      VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "Team_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "Team_name_unique" UNIQUE      ("name")
);
CREATE TABLE IF NOT EXISTS "User" (
    "userId"              VARCHAR(36)              NOT NULL,
    "username"            VARCHAR(50)              NOT NULL,
    "passwordHash"        VARCHAR(72)              NOT NULL,
    "role"                VARCHAR(30)              NOT NULL DEFAULT 'DEVELOPER',
    "name"                VARCHAR(100)             NOT NULL,
    "designation"         VARCHAR(100),
    "previousDesignation" VARCHAR(100),
    "isActive"            BOOLEAN                  NOT NULL DEFAULT TRUE,
    "createdBy"           VARCHAR(36),
    "email"               VARCHAR(255),
    "phone"               VARCHAR(50),
    "createdAt"           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt"           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "User_pkey"           PRIMARY KEY ("userId"),
    CONSTRAINT "User_username_unique" UNIQUE      ("username"),
    CONSTRAINT "User_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("userId") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "User_role_idx"     ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_isActive_idx" ON "User"("isActive");
CREATE TABLE IF NOT EXISTS "Module" (
    "moduleId"    VARCHAR(36)  NOT NULL,
    "projectId"   VARCHAR(36)  NOT NULL,
    "moduleName"  VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isActive"    BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT "Module_pkey"              PRIMARY KEY ("moduleId"),
    CONSTRAINT "Module_moduleName_unique" UNIQUE      ("moduleName"),
    CONSTRAINT "Module_projectId_fkey"    FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Module_projectId_idx" ON "Module"("projectId");
CREATE INDEX IF NOT EXISTS "Module_isActive_idx"  ON "Module"("isActive");
CREATE TABLE IF NOT EXISTS "Session" (
    "sessionId" VARCHAR(36)              NOT NULL,
    "userId"    VARCHAR(36)              NOT NULL,
    "tokenHash" VARCHAR(64)              NOT NULL,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "Session_pkey"             PRIMARY KEY ("sessionId"),
    CONSTRAINT "Session_tokenHash_unique" UNIQUE      ("tokenHash"),
    CONSTRAINT "Session_userId_fkey"      FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Session_userId_idx"    ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE TABLE IF NOT EXISTS "AccountRequest" (
    "id"           VARCHAR(36)              NOT NULL,
    "username"     VARCHAR(50)              NOT NULL,
    "passwordHash" VARCHAR(72)              NOT NULL,
    "name"         VARCHAR(100)             NOT NULL,
    "phone"        VARCHAR(20),
    "email"        VARCHAR(255),
    "role"         VARCHAR(20)              NOT NULL,
    "status"       VARCHAR(10)              NOT NULL DEFAULT 'PENDING',
    "reviewedBy"   VARCHAR(36),
    "reviewNote"   TEXT,
    "createdAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "reviewedAt"   TIMESTAMP WITH TIME ZONE,
    CONSTRAINT "AccountRequest_pkey"            PRIMARY KEY ("id"),
    CONSTRAINT "AccountRequest_username_unique" UNIQUE      ("username"),
    CONSTRAINT "AccountRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("userId") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "AccountRequest_status_idx" ON "AccountRequest"("status");
CREATE TABLE IF NOT EXISTS "Task" (
    "id"              VARCHAR(36)              NOT NULL,
    "clientRequestId" INTEGER                  NOT NULL DEFAULT 0,
    "title"           VARCHAR(200)             NOT NULL,
    "description"     TEXT                     NOT NULL,
    "status"          VARCHAR(30)              NOT NULL DEFAULT 'DRAFT',
    "lifecycleStatus" INTEGER                  NOT NULL DEFAULT 0,
    "isInternal"      BOOLEAN                  NOT NULL DEFAULT FALSE,
    "authorId"   VARCHAR(36) NOT NULL,
    "clientId"   VARCHAR(36),
    "assigneeId" VARCHAR(36),
    "approverId" VARCHAR(36),
    "deployerId" VARCHAR(36),
    "verifierId" VARCHAR(36),
    "teamId"   VARCHAR(36),
    "moduleId" VARCHAR(36),
    "assignedAt"       TIMESTAMP WITH TIME ZONE,
    "plannedStartDate" TIMESTAMP WITH TIME ZONE,
    "plannedEndDate"   TIMESTAMP WITH TIME ZONE,
    "dateGiven"        TIMESTAMP WITH TIME ZONE,
    "dateStarted"      TIMESTAMP WITH TIME ZONE,
    "dateEnded"        TIMESTAMP WITH TIME ZONE,
    "completedAt"      TIMESTAMP WITH TIME ZONE,
    "createdAt"        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt"        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "Task_pkey"            PRIMARY KEY ("id"),
    CONSTRAINT "Task_authorId_fkey"   FOREIGN KEY ("authorId")   REFERENCES "User"("userId"),
    CONSTRAINT "Task_clientId_fkey"   FOREIGN KEY ("clientId")   REFERENCES "User"("userId"),
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("userId"),
    CONSTRAINT "Task_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("userId"),
    CONSTRAINT "Task_deployerId_fkey" FOREIGN KEY ("deployerId") REFERENCES "User"("userId"),
    CONSTRAINT "Task_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "User"("userId"),
    CONSTRAINT "Task_teamId_fkey"     FOREIGN KEY ("teamId")     REFERENCES "Team"("id"),
    CONSTRAINT "Task_moduleId_fkey"   FOREIGN KEY ("moduleId")   REFERENCES "Module"("moduleId")
);
CREATE INDEX IF NOT EXISTS "Task_status_idx"     ON "Task"("status");
CREATE INDEX IF NOT EXISTS "Task_authorId_idx"   ON "Task"("authorId");
CREATE INDEX IF NOT EXISTS "Task_clientId_idx"   ON "Task"("clientId");
CREATE INDEX IF NOT EXISTS "Task_moduleId_idx"   ON "Task"("moduleId");
CREATE INDEX IF NOT EXISTS "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX IF NOT EXISTS "Task_createdAt_idx"  ON "Task"("createdAt" DESC);
CREATE TABLE IF NOT EXISTS "TaskAttachment" (
    "id"         VARCHAR(36)              NOT NULL,
    "taskId"     VARCHAR(36)              NOT NULL,
    "uploaderId" VARCHAR(36)              NOT NULL,
    "fileUrl"    VARCHAR(200)             NOT NULL,
    "fileName"   VARCHAR(100)             NOT NULL,
    "fileType"   VARCHAR(60)              NOT NULL,
    "size"       INTEGER                  NOT NULL,
    "createdAt"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "TaskAttachment_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId")     REFERENCES "Task"("id") ON DELETE CASCADE,
    CONSTRAINT "TaskAttachment_userId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("userId")
);
CREATE INDEX IF NOT EXISTS "TaskAttachment_taskId_idx" ON "TaskAttachment"("taskId");
CREATE TABLE IF NOT EXISTS "TaskComment" (
    "id"         VARCHAR(36)              NOT NULL,
    "taskId"     VARCHAR(36)              NOT NULL,
    "userId"     VARCHAR(36)              NOT NULL,
    "content"    TEXT                     NOT NULL,
    "authorName" VARCHAR(100),
    "authorRole" VARCHAR(30),
    "files"      JSONB,
    "createdAt"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "TaskComment_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE,
    CONSTRAINT "TaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId")
);
CREATE INDEX IF NOT EXISTS "TaskComment_taskId_idx" ON "TaskComment"("taskId");
CREATE TABLE IF NOT EXISTS "StatusHistory" (
    "id"                VARCHAR(36)              NOT NULL,
    "taskId"            VARCHAR(36)              NOT NULL,
    "previousStatus"    VARCHAR(30)              NOT NULL,
    "newStatus"         VARCHAR(30)              NOT NULL,
    "changedById"       VARCHAR(36),
    "changedByName"     VARCHAR(100),
    "changedByUsername" VARCHAR(50),
    "changedByRole"     VARCHAR(30),
    "reason"            TEXT,
    "createdAt"         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "StatusHistory_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "StatusHistory_taskId_fkey" FOREIGN KEY ("taskId")      REFERENCES "Task"("id") ON DELETE CASCADE,
    CONSTRAINT "StatusHistory_user_fkey"   FOREIGN KEY ("changedById") REFERENCES "User"("userId") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "StatusHistory_taskId_idx"    ON "StatusHistory"("taskId");
CREATE INDEX IF NOT EXISTS "StatusHistory_createdAt_idx" ON "StatusHistory"("createdAt" ASC);
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "logId"        VARCHAR(36)              NOT NULL,
    "taskId"       VARCHAR(36),
    "changedBy"    VARCHAR(36),
    "targetUserId" VARCHAR(36),
    "fieldChanged" VARCHAR(80)              NOT NULL,
    "oldValue"     VARCHAR(100),
    "newValue"     VARCHAR(100),
    "reason"       TEXT                     NOT NULL,
    "changedAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "AuditLog_pkey"            PRIMARY KEY ("logId"),
    CONSTRAINT "AuditLog_taskId_fkey"     FOREIGN KEY ("taskId")       REFERENCES "Task"("id") ON DELETE SET NULL,
    CONSTRAINT "AuditLog_changedBy_fkey"  FOREIGN KEY ("changedBy")    REFERENCES "User"("userId") ON DELETE SET NULL,
    CONSTRAINT "AuditLog_targetUser_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("userId") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "AuditLog_taskId_idx"    ON "AuditLog"("taskId");
CREATE INDEX IF NOT EXISTS "AuditLog_changedAt_idx" ON "AuditLog"("changedAt" DESC);
CREATE TABLE IF NOT EXISTS "Notification" (
    "id"        VARCHAR(36)              NOT NULL,
    "userId"    VARCHAR(36)              NOT NULL,
    "type"      VARCHAR(50)              NOT NULL,
    "message"   TEXT                     NOT NULL,
    "read"      BOOLEAN                  NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "Notification_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "Notification_userId_idx"    ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt" DESC);
CREATE TABLE IF NOT EXISTS "UserManager" (
    "id"         VARCHAR(36)              NOT NULL,
    "userId"     VARCHAR(36)              NOT NULL,
    "managerId"  VARCHAR(36)              NOT NULL,
    "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT "UserManager_pkey"         PRIMARY KEY ("id"),
    CONSTRAINT "UserManager_unique_pair"  UNIQUE      ("userId", "managerId"),
    CONSTRAINT "UserManager_userId_fkey"  FOREIGN KEY ("userId")    REFERENCES "User"("userId") ON DELETE CASCADE,
    CONSTRAINT "UserManager_manager_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("userId") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "_TaskManagers" (
    "A" VARCHAR(36) NOT NULL,
    "B" VARCHAR(36) NOT NULL,
    CONSTRAINT "_TaskManagers_pkey"   PRIMARY KEY ("A", "B"),
    CONSTRAINT "_TaskManagers_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE,
    CONSTRAINT "_TaskManagers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("userId") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "_TaskManagers_B_idx" ON "_TaskManagers"("B");
CREATE TABLE IF NOT EXISTS "_TaskDevelopers" (
    "A" VARCHAR(36) NOT NULL,
    "B" VARCHAR(36) NOT NULL,
    CONSTRAINT "_TaskDevelopers_pkey"   PRIMARY KEY ("A", "B"),
    CONSTRAINT "_TaskDevelopers_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE,
    CONSTRAINT "_TaskDevelopers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("userId") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "_TaskDevelopers_B_idx" ON "_TaskDevelopers"("B");
CREATE TABLE IF NOT EXISTS "_TaskVerifiers" (
    "A" VARCHAR(36) NOT NULL,
    "B" VARCHAR(36) NOT NULL,
    CONSTRAINT "_TaskVerifiers_pkey"   PRIMARY KEY ("A", "B"),
    CONSTRAINT "_TaskVerifiers_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE,
    CONSTRAINT "_TaskVerifiers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("userId") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "_TaskVerifiers_B_idx" ON "_TaskVerifiers"("B");
CREATE TABLE IF NOT EXISTS "_UserModules" (
    "A" VARCHAR(36) NOT NULL,
    "B" VARCHAR(36) NOT NULL,
    CONSTRAINT "_UserModules_pkey"   PRIMARY KEY ("A", "B"),
    CONSTRAINT "_UserModules_A_fkey" FOREIGN KEY ("A") REFERENCES "Module"("moduleId") ON DELETE CASCADE,
    CONSTRAINT "_UserModules_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("userId") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "_UserModules_B_idx" ON "_UserModules"("B");


