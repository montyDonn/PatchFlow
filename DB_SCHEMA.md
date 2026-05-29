# PatchFlow — Database Schema & Setup Guide
**Prepared for:** Company DB Developer  
**Application:** PatchFlow Change Management System  
**Database Engine:** PostgreSQL (≥ 14 recommended)  
**Schema:** `public`  

---

## 1. Overview

PatchFlow is a Change Management / Patch Tracking system. The database stores users, projects, modules, tasks (called "patches" or "change requests"), comments, attachments, audit logs, notifications, and user session tokens.

All primary keys are **UUID strings** (stored as `VARCHAR(36)` or `TEXT`), except for `Task.id` which uses a date-prefixed sequential format (`YYYYMMDDnnnn`, e.g. `202605270001`).

---

## 2. Role Enumeration

The `User.role` column accepts one of the following string values:

| Role           | Description                                          |
|----------------|------------------------------------------------------|
| `ADMIN`        | Full system administrator — all permissions           |
| `MANAGER`      | Manages patch lifecycle, approves resources           |
| `DEVELOPER`    | Develops / implements patches                         |
| `VERIFIER`     | QA/verification — approves or rejects completed work  |
| `CLIENT`       | External client who raises change requests            |
| `VIEWER`       | Read-only internal observer                           |
| `UPCL_VIEWER`  | Read-only external observer (no internal patch access)|

---

## 3. Task Status Enumeration

The `Task.status` column accepts one of the following string values, and transitions follow the workflow below:

```
DRAFT → ASSIGNED → PENDING_APPROVAL → IN_DEVELOPMENT → VERIFYING → COMPLETED
                                                              ↓
                                                   RETURNED_TO_DEVELOPER → IN_DEVELOPMENT
                                                              ↓
                                                            REJECTED
                                                              ↓
                                                            ON_HOLD → IN_DEVELOPMENT
                                                              ↓
                                                           CANCELLED
```

| Status                  | Description                                            |
|-------------------------|--------------------------------------------------------|
| `DRAFT`                 | Newly created, not yet assigned                        |
| `ASSIGNED`              | Manager(s), Developer(s), Verifier(s) assigned         |
| `PENDING_APPROVAL`      | Manager reviewing assignments before development starts|
| `IN_DEVELOPMENT`        | Active development by assigned developers              |
| `VERIFYING`             | Under QA verification                                  |
| `COMPLETED`             | Successfully verified and closed                       |
| `RETURNED_TO_DEVELOPER` | Verification failed — returned for rework              |
| `REJECTED`              | Patch rejected (terminal state)                        |
| `ON_HOLD`               | Paused — can resume to IN_DEVELOPMENT                  |
| `CANCELLED`             | Cancelled (terminal state)                             |
| `DELAYED`               | Delayed — can resume to IN_DEVELOPMENT (legacy)        |

---

## 4. Complete DDL — PostgreSQL

Run the following SQL statements **in order** to create the database schema from scratch.

### 4.1 Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid() if needed
```

---

### 4.2 Table: `Project`

Represents a top-level project grouping modules.

```sql
CREATE TABLE "Project" (
    "projectId"   VARCHAR(36)   NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "projectName" VARCHAR(255)  NOT NULL,
    "description" TEXT,
    "isActive"    BOOLEAN       NOT NULL DEFAULT TRUE,
    "createdAt"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT "pk_project" PRIMARY KEY ("projectId")
);
```

---

### 4.3 Table: `Module`

Each module belongs to a project and groups tasks/patches by functional area.

```sql
CREATE TABLE "Module" (
    "moduleId"    VARCHAR(36)   NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "projectId"   VARCHAR(36)   NOT NULL,
    "moduleName"  VARCHAR(255)  NOT NULL,
    "description" TEXT,
    "isActive"    BOOLEAN       NOT NULL DEFAULT TRUE,

    CONSTRAINT "pk_module"             PRIMARY KEY ("moduleId"),
    CONSTRAINT "uq_module_name"        UNIQUE      ("moduleName"),
    CONSTRAINT "fk_module_project"     FOREIGN KEY ("projectId")
        REFERENCES "Project" ("projectId") ON DELETE CASCADE
);
```

**Seed Modules (10 default modules):**
| moduleName               |
|--------------------------|
| NSC                      |
| DND                      |
| CSC                      |
| BILLING                  |
| METERING                 |
| FAM                      |
| MOBILE BILLING           |
| REPORT                   |
| INTEGRATION              |
| SMART METER INTEGRATION  |

---

### 4.4 Table: `Team`

Optional grouping of resources into named teams.

```sql
CREATE TABLE "Team" (
    "id"        VARCHAR(36)  NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "name"      VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "pk_team"   PRIMARY KEY ("id"),
    CONSTRAINT "uq_team_name" UNIQUE ("name")
);
```

---

### 4.5 Table: `User`

All system users — clients, managers, developers, verifiers, admins, viewers.

```sql
CREATE TABLE "User" (
    "userId"               VARCHAR(36)  NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "username"             VARCHAR(255) NOT NULL,
    "passwordHash"         VARCHAR(255) NOT NULL,
    "salt"                 VARCHAR(255) NOT NULL,          -- always "BCrypt" (hash includes salt)
    "role"                 VARCHAR(50)  NOT NULL DEFAULT 'DEVELOPER',
    "name"                 VARCHAR(255) NOT NULL,
    "designation"          VARCHAR(255),
    "previousDesignation"  VARCHAR(255),
    "isActive"             BOOLEAN      NOT NULL DEFAULT TRUE,
    "createdAt"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "createdBy"            VARCHAR(36),

    CONSTRAINT "pk_user"       PRIMARY KEY ("userId"),
    CONSTRAINT "uq_username"   UNIQUE      ("username"),
    CONSTRAINT "ck_user_role"  CHECK       ("role" IN (
        'ADMIN', 'MANAGER', 'DEVELOPER', 'VERIFIER',
        'CLIENT', 'VIEWER', 'UPCL_VIEWER'
    ))
);

-- Index for fast username lookups (used in login)
CREATE INDEX "idx_user_username" ON "User" ("username");
CREATE INDEX "idx_user_role"     ON "User" ("role");
```

> **Security Note:** Passwords are hashed using **BCrypt** (Spring Security's BCryptPasswordEncoder, strength 10). Never store plaintext passwords. The `salt` column always contains the string `"BCrypt"` since BCrypt embeds its salt inside the hash.

**Initial Seed Users** (all with password `upcl@123`):

| username        | name            | role        | designation            |
|-----------------|-----------------|-------------|------------------------|
| admin           | System Admin    | ADMIN       | System Administrator   |
| komal           | Komal           | CLIENT      | Client                 |
| abhishek_rishi  | ABHISHEK_RISHI  | MANAGER     | Project Manager        |
| prashantp       | PRASHANTP       | MANAGER     | Project Manager        |
| abhishiek_r     | ABHISHIEK_R     | MANAGER     | Project Manager        |
| siva            | SIVA            | DEVELOPER   | Software Developer     |
| trinadh         | TRINADH         | DEVELOPER   | Software Developer     |
| anukriti        | ANUKRITI        | DEVELOPER   | Software Developer     |
| sachinp         | SACHINP         | DEVELOPER   | Software Developer     |
| pankaj          | PANKAJ          | VERIFIER    | QA Engineer            |
| jagdish         | JAGDISH         | VERIFIER    | QA Engineer            |

---

### 4.6 Table: `UserManager`

Maps each non-manager user to their manager (hierarchy tracking).

```sql
CREATE TABLE "UserManager" (
    "id"         VARCHAR(36) NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "userId"     VARCHAR(36) NOT NULL,
    "managerId"  VARCHAR(36) NOT NULL,
    "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "pk_usermanager"         PRIMARY KEY ("id"),
    CONSTRAINT "fk_usermanager_user"    FOREIGN KEY ("userId")
        REFERENCES "User" ("userId") ON DELETE CASCADE,
    CONSTRAINT "fk_usermanager_manager" FOREIGN KEY ("managerId")
        REFERENCES "User" ("userId") ON DELETE CASCADE
);

CREATE INDEX "idx_usermanager_manager" ON "UserManager" ("managerId");
CREATE INDEX "idx_usermanager_user"    ON "UserManager" ("userId");
```

---

### 4.7 Table: `_UserModules`

Many-to-many join table — users assigned to modules.

```sql
CREATE TABLE "_UserModules" (
    "A" VARCHAR(36) NOT NULL,   -- moduleId
    "B" VARCHAR(36) NOT NULL,   -- userId

    CONSTRAINT "pk_usermodules" PRIMARY KEY ("A", "B"),
    CONSTRAINT "fk_usermodules_module" FOREIGN KEY ("A")
        REFERENCES "Module" ("moduleId") ON DELETE CASCADE,
    CONSTRAINT "fk_usermodules_user"   FOREIGN KEY ("B")
        REFERENCES "User"   ("userId")   ON DELETE CASCADE
);

CREATE INDEX "idx_usermodules_user" ON "_UserModules" ("B");
```

---

### 4.8 Table: `Task`

The core table. Each row is one **Change Request / Patch**.

```sql
CREATE TABLE "Task" (
    -- Primary key: date-prefixed sequential ID, e.g. "202605270001"
    "id"               VARCHAR(36)  NOT NULL,

    -- Client-side request reference number (optional)
    "clientRequestId"  INTEGER      NOT NULL DEFAULT 0,

    -- Core fields
    "title"            VARCHAR(255) NOT NULL,
    "description"      TEXT         NOT NULL,
    "status"           VARCHAR(50)  NOT NULL DEFAULT 'DRAFT',

    -- People references
    "authorId"         VARCHAR(36)  NOT NULL,   -- User who created the task
    "assigneeId"       VARCHAR(36),              -- Legacy single-developer field (may be null)
    "approverId"       VARCHAR(36),              -- Legacy approver field (may be null)
    "deployerId"       VARCHAR(36),              -- Legacy deployer field (may be null)
    "verifierId"       VARCHAR(36),              -- Legacy single-verifier field (may be null)
    "clientId"         VARCHAR(36),              -- Client this patch belongs to (null for internal)
    "teamId"           VARCHAR(36),              -- Optional team assignment
    "moduleId"         VARCHAR(36),              -- Which module this patch affects

    -- Timestamps
    "assignedAt"       TIMESTAMPTZ,
    "plannedStartDate" TIMESTAMPTZ,              -- Manager-approved planned start
    "plannedEndDate"   TIMESTAMPTZ,              -- Manager-approved planned end (deadline)
    "completedAt"      TIMESTAMPTZ,
    "createdAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Business timestamps
    "dateGiven"        TIMESTAMPTZ,              -- Date client/manager gave this request
    "dateStarted"      TIMESTAMPTZ,              -- Actual start (set when IN_DEVELOPMENT reached)
    "dateEnded"        TIMESTAMPTZ,              -- Actual end (set on COMPLETED/REJECTED/CANCELLED)

    -- Flags
    "lifecycleStatus"  INTEGER      NOT NULL DEFAULT 0,
        -- 0  = active
        -- 100 = soft-deleted
    "isInternal"       BOOLEAN      NOT NULL DEFAULT FALSE,
        -- TRUE  = only visible to assigned team (hidden from clients)
        -- FALSE = client-visible

    CONSTRAINT "pk_task"         PRIMARY KEY ("id"),
    CONSTRAINT "ck_task_status"  CHECK       ("status" IN (
        'DRAFT', 'ASSIGNED', 'PENDING_APPROVAL', 'IN_DEVELOPMENT',
        'VERIFYING', 'COMPLETED', 'RETURNED_TO_DEVELOPER',
        'REJECTED', 'ON_HOLD', 'CANCELLED', 'DELAYED'
    )),
    CONSTRAINT "fk_task_author"   FOREIGN KEY ("authorId")
        REFERENCES "User"   ("userId"),
    CONSTRAINT "fk_task_client"   FOREIGN KEY ("clientId")
        REFERENCES "User"   ("userId"),
    CONSTRAINT "fk_task_assignee" FOREIGN KEY ("assigneeId")
        REFERENCES "User"   ("userId"),
    CONSTRAINT "fk_task_approver" FOREIGN KEY ("approverId")
        REFERENCES "User"   ("userId"),
    CONSTRAINT "fk_task_deployer" FOREIGN KEY ("deployerId")
        REFERENCES "User"   ("userId"),
    CONSTRAINT "fk_task_verifier" FOREIGN KEY ("verifierId")
        REFERENCES "User"   ("userId"),
    CONSTRAINT "fk_task_module"   FOREIGN KEY ("moduleId")
        REFERENCES "Module" ("moduleId"),
    CONSTRAINT "fk_task_team"     FOREIGN KEY ("teamId")
        REFERENCES "Team"   ("id")
);

CREATE INDEX "idx_task_status"          ON "Task" ("status");
CREATE INDEX "idx_task_client"          ON "Task" ("clientId");
CREATE INDEX "idx_task_author"          ON "Task" ("authorId");
CREATE INDEX "idx_task_module"          ON "Task" ("moduleId");
CREATE INDEX "idx_task_lifecycle"       ON "Task" ("lifecycleStatus");
CREATE INDEX "idx_task_id_prefix"       ON "Task" ("id" text_pattern_ops);  -- for LIKE 'YYYYMMDD%' queries
```

> **Note on `description` format:** The description field uses a structured embedded format:
> ```
> [CHANGE_ID: 202605270001] [TYPE: Modify]
> [DESC: Short title of the change]
> Full details / comments go here...
> [CLIENT_PHONE: 9876543210]      ← optional
> [CLIENT_DEADLINE: 2025-06-30]   ← optional, client-requested deadline
> ```
> The `[CLIENT_DEADLINE: ...]` tag embeds the client's requested deadline. The manager then sets the official `plannedEndDate` after review.

---

### 4.9 Table: `_TaskManagers`

Many-to-many: Tasks ↔ Managers.

```sql
CREATE TABLE "_TaskManagers" (
    "A" VARCHAR(36) NOT NULL,   -- taskId
    "B" VARCHAR(36) NOT NULL,   -- userId (MANAGER role)

    CONSTRAINT "pk_taskmanagers" PRIMARY KEY ("A", "B"),
    CONSTRAINT "fk_taskmanagers_task" FOREIGN KEY ("A")
        REFERENCES "Task" ("id") ON DELETE CASCADE,
    CONSTRAINT "fk_taskmanagers_user" FOREIGN KEY ("B")
        REFERENCES "User" ("userId") ON DELETE CASCADE
);

CREATE INDEX "idx_taskmanagers_user" ON "_TaskManagers" ("B");
```

---

### 4.10 Table: `_TaskDevelopers`

Many-to-many: Tasks ↔ Developers.

```sql
CREATE TABLE "_TaskDevelopers" (
    "A" VARCHAR(36) NOT NULL,   -- taskId
    "B" VARCHAR(36) NOT NULL,   -- userId (DEVELOPER role)

    CONSTRAINT "pk_taskdevelopers" PRIMARY KEY ("A", "B"),
    CONSTRAINT "fk_taskdevelopers_task" FOREIGN KEY ("A")
        REFERENCES "Task" ("id") ON DELETE CASCADE,
    CONSTRAINT "fk_taskdevelopers_user" FOREIGN KEY ("B")
        REFERENCES "User" ("userId") ON DELETE CASCADE
);

CREATE INDEX "idx_taskdevelopers_user" ON "_TaskDevelopers" ("B");
```

---

### 4.11 Table: `_TaskVerifiers`

Many-to-many: Tasks ↔ Verifiers.

```sql
CREATE TABLE "_TaskVerifiers" (
    "A" VARCHAR(36) NOT NULL,   -- taskId
    "B" VARCHAR(36) NOT NULL,   -- userId (VERIFIER role)

    CONSTRAINT "pk_taskverifiers" PRIMARY KEY ("A", "B"),
    CONSTRAINT "fk_taskverifiers_task" FOREIGN KEY ("A")
        REFERENCES "Task" ("id") ON DELETE CASCADE,
    CONSTRAINT "fk_taskverifiers_user" FOREIGN KEY ("B")
        REFERENCES "User" ("userId") ON DELETE CASCADE
);

CREATE INDEX "idx_taskverifiers_user" ON "_TaskVerifiers" ("B");
```

---

### 4.12 Table: `TaskComment`

Comments posted on tasks by any assigned user.

```sql
CREATE TABLE "TaskComment" (
    "id"              VARCHAR(36) NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "taskId"          VARCHAR(36) NOT NULL,
    "userId"          VARCHAR(36) NOT NULL,
    "content"         TEXT        NOT NULL,
    "authorName"      VARCHAR(255),           -- denormalized snapshot of user name at comment time
    "authorRole"      VARCHAR(50),            -- denormalized snapshot of user role at comment time
    "files"           JSONB,                  -- array of file URL strings, e.g. ["/uploads/..."]
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "pk_taskcomment"        PRIMARY KEY ("id"),
    CONSTRAINT "fk_taskcomment_task"   FOREIGN KEY ("taskId")
        REFERENCES "Task" ("id") ON DELETE CASCADE,
    CONSTRAINT "fk_taskcomment_user"   FOREIGN KEY ("userId")
        REFERENCES "User" ("userId")
);

CREATE INDEX "idx_taskcomment_task" ON "TaskComment" ("taskId");
```

---

### 4.13 Table: `TaskAttachment`

File attachments uploaded to tasks.

```sql
CREATE TABLE "TaskAttachment" (
    "id"          VARCHAR(36)  NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "taskId"      VARCHAR(36)  NOT NULL,
    "uploaderId"  VARCHAR(36)  NOT NULL,
    "fileUrl"     VARCHAR(500) NOT NULL,   -- e.g. "/uploads/{clientId}/{uniqueFileName}"
    "fileName"    VARCHAR(255) NOT NULL,   -- original filename
    "fileType"    VARCHAR(100) NOT NULL,   -- MIME type, e.g. "application/pdf"
    "size"        INTEGER      NOT NULL,   -- file size in bytes
    "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "pk_taskattachment"          PRIMARY KEY ("id"),
    CONSTRAINT "fk_taskattachment_task"     FOREIGN KEY ("taskId")
        REFERENCES "Task" ("id") ON DELETE CASCADE,
    CONSTRAINT "fk_taskattachment_uploader" FOREIGN KEY ("uploaderId")
        REFERENCES "User" ("userId")
);

CREATE INDEX "idx_taskattachment_task" ON "TaskAttachment" ("taskId");
```

> **File Storage Note:** The actual files are stored on the **server filesystem** under `./uploads/{clientId}/` (or `./uploads/internal/` for internal patches). The `fileUrl` column stores the relative URL path. This directory should be mapped to persistent storage in production.

---

### 4.14 Table: `StatusHistory`

Chronological log of every status transition for each task.

```sql
CREATE TABLE "StatusHistory" (
    "id"                VARCHAR(36)  NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "taskId"            VARCHAR(36)  NOT NULL,
    "previousStatus"    VARCHAR(50)  NOT NULL,
    "newStatus"         VARCHAR(50)  NOT NULL,
    "changedById"       VARCHAR(36),
    "changedByName"     VARCHAR(255),   -- denormalized snapshot
    "changedByUsername" VARCHAR(255),   -- denormalized snapshot
    "changedByRole"     VARCHAR(50),    -- denormalized snapshot
    "reason"            TEXT,
    "createdAt"         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "pk_statushistory"        PRIMARY KEY ("id"),
    CONSTRAINT "fk_statushistory_task"   FOREIGN KEY ("taskId")
        REFERENCES "Task" ("id") ON DELETE CASCADE,
    CONSTRAINT "fk_statushistory_changer" FOREIGN KEY ("changedById")
        REFERENCES "User" ("userId")
);

CREATE INDEX "idx_statushistory_task"      ON "StatusHistory" ("taskId");
CREATE INDEX "idx_statushistory_createdat" ON "StatusHistory" ("createdAt" ASC);
```

---

### 4.15 Table: `AuditLog`

Fine-grained field-level audit trail — every change to every field is logged.

```sql
CREATE TABLE "AuditLog" (
    "logId"        VARCHAR(36)  NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "taskId"       VARCHAR(36),           -- which task this log belongs to (may be null for user-level logs)
    "changedBy"    VARCHAR(36),           -- userId of actor
    "targetUserId" VARCHAR(36),           -- userId affected (if a user-level change)
    "fieldChanged" VARCHAR(255) NOT NULL, -- e.g. "Task Status", "Task Comment", "Task Attachment"
    "oldValue"     TEXT,
    "newValue"     TEXT,
    "reason"       TEXT         NOT NULL,
    "changedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "pk_auditlog"         PRIMARY KEY ("logId"),
    CONSTRAINT "fk_auditlog_task"    FOREIGN KEY ("taskId")
        REFERENCES "Task" ("id"),
    CONSTRAINT "fk_auditlog_actor"   FOREIGN KEY ("changedBy")
        REFERENCES "User" ("userId"),
    CONSTRAINT "fk_auditlog_target"  FOREIGN KEY ("targetUserId")
        REFERENCES "User" ("userId")
);

CREATE INDEX "idx_auditlog_task"      ON "AuditLog" ("taskId");
CREATE INDEX "idx_auditlog_actor"     ON "AuditLog" ("changedBy");
CREATE INDEX "idx_auditlog_changedat" ON "AuditLog" ("changedAt" DESC);
```

---

### 4.16 Table: `Notification`

In-app notifications for users.

```sql
CREATE TABLE "Notification" (
    "id"        VARCHAR(36)  NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "userId"    VARCHAR(36)  NOT NULL,
    "type"      VARCHAR(100) NOT NULL,   -- e.g. "TASK_ASSIGNED", "TASK_PENDING_VERIFICATION"
    "message"   TEXT         NOT NULL,
    "read"      BOOLEAN      NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "pk_notification"        PRIMARY KEY ("id"),
    CONSTRAINT "fk_notification_user"   FOREIGN KEY ("userId")
        REFERENCES "User" ("userId") ON DELETE CASCADE
);

CREATE INDEX "idx_notification_user"      ON "Notification" ("userId");
CREATE INDEX "idx_notification_read"      ON "Notification" ("userId", "read");
CREATE INDEX "idx_notification_createdat" ON "Notification" ("createdAt" DESC);
```

**Notification Types Used:**

| type                       | Trigger                                             |
|----------------------------|-----------------------------------------------------|
| `TASK_ASSIGNED`            | Task moves to ASSIGNED (sent to managers)           |
| `TASK_PENDING_APPROVAL`    | Task moves to PENDING_APPROVAL (sent to managers)   |
| `TASK_IN_DEVELOPMENT`      | Task moves to IN_DEVELOPMENT (sent to developers)   |
| `TASK_PENDING_VERIFICATION`| Task moves to VERIFYING (sent to verifiers)         |
| `TASK_RETURNED`            | Task returned to developer (sent to developers)     |
| `TASK_FINALIZED`           | Task COMPLETED/REJECTED/CANCELLED (sent to client)  |

---

### 4.17 Table: `Session`

Authentication sessions (token-based, no JWTs). Tokens are BCrypt-hashed before storage.

```sql
CREATE TABLE "Session" (
    "sessionId"  VARCHAR(36)  NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "userId"     VARCHAR(36)  NOT NULL,
    "tokenHash"  VARCHAR(255) NOT NULL,   -- BCrypt hash of the raw session token
    "expiresAt"  TIMESTAMPTZ  NOT NULL,
    "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "pk_session"         PRIMARY KEY ("sessionId"),
    CONSTRAINT "uq_session_token"   UNIQUE      ("tokenHash"),
    CONSTRAINT "fk_session_user"    FOREIGN KEY ("userId")
        REFERENCES "User" ("userId") ON DELETE CASCADE
);

CREATE INDEX "idx_session_user"      ON "Session" ("userId");
CREATE INDEX "idx_session_expiresat" ON "Session" ("expiresAt");
```

> **Session Management Note:** On login, the backend generates a random token, BCrypt-hashes it, stores the hash in `Session`, and returns the raw token to the client as a cookie/header. On subsequent requests, the raw token is compared against all active sessions for the user using BCrypt match. Expired sessions should be cleaned up periodically (`DELETE FROM "Session" WHERE "expiresAt" < NOW()`).

---

## 5. Entity Relationship Summary

```
Project ──< Module ──< Task >──< _TaskManagers    >── User
                              >──< _TaskDevelopers  >── User
                              >──< _TaskVerifiers   >── User
                              ──< TaskComment       >── User
                              ──< TaskAttachment    >── User (uploader)
                              ──< StatusHistory     >── User
                              ──< AuditLog          >── User (actor)

User ──< Session
User ──< Notification
User ──< UserManager (as "user")
User ──< UserManager (as "manager")
User >──< _UserModules >── Module

Task ──> User (authorId, clientId, assigneeId, approverId, deployerId, verifierId)
Task ──> Team (optional)
Task ──> Module
```

---

## 6. Connection Configuration

The backend connects to PostgreSQL using the following environment variables. Provide these to the backend team:

| Environment Variable               | Description                              | Example                         |
|------------------------------------|------------------------------------------|---------------------------------|
| `SPRING_DATASOURCE_URL`            | JDBC connection URL                      | `jdbc:postgresql://host/dbname?sslmode=require` |
| `SPRING_DATASOURCE_USERNAME`       | Database username                        | `patchflow_user`                |
| `SPRING_DATASOURCE_PASSWORD`       | Database password                        | `<strong-password>`             |
| `SPRING_JPA_HIBERNATE_DDL_AUTO`    | Schema management (must be `none`)       | `none`                          |
| `PORT`                             | Backend server port                      | `8080`                          |
| `UPLOAD_DIR`                       | Directory for uploaded attachments       | `/var/patchflow/uploads`        |
| `CORS_ORIGINS`                     | Allowed frontend origins                 | `https://yourdomain.com`        |

> **Important:** `SPRING_JPA_HIBERNATE_DDL_AUTO` must be set to `none` in production. The schema is managed manually using the DDL above.

---

## 7. Required PostgreSQL Configuration

```sql
-- The application uses quoted identifiers throughout (table names like "Task", "User", etc.)
-- Ensure the PostgreSQL search_path is set to public:
SET search_path TO public;

-- Required: jsonb support (built-in from PostgreSQL 9.4+)
-- Required: TIMESTAMPTZ support (built-in)

-- Recommended: Set timezone
SET timezone = 'UTC';
```

---

## 8. Hibernate / JPA Configuration

The backend uses **Hibernate 6** with these settings:

```yaml
spring.jpa.hibernate.ddl-auto: none
spring.jpa.properties.hibernate.dialect: org.hibernate.dialect.PostgreSQLDialect
spring.jpa.properties.hibernate.globally_quoted_identifiers: true
spring.jpa.properties.hibernate.default_schema: public
spring.jpa.properties.hibernate.default_batch_fetch_size: 16
```

`globally_quoted_identifiers: true` means Hibernate wraps all identifiers in double-quotes. This is why all table names in the DDL above use double-quoted names like `"Task"`, `"User"`, etc. **Do not change the table/column casing** — the Java entities map directly to these exact names.

---

## 9. Periodic Maintenance Queries

```sql
-- Clean up expired sessions (run daily via cron)
DELETE FROM "Session" WHERE "expiresAt" < NOW();

-- Find all active patches (non-deleted)
SELECT id, title, status FROM "Task" WHERE "lifecycleStatus" = 0;

-- Find soft-deleted patches
SELECT id, title, status FROM "Task" WHERE "lifecycleStatus" >= 100;

-- Notification cleanup (older than 90 days, already read)
DELETE FROM "Notification"
WHERE "read" = TRUE AND "createdAt" < NOW() - INTERVAL '90 days';
```

---

## 10. Security Checklist for DB Developer

- [ ] Create a **dedicated database user** for the application (do not use superuser/owner)
- [ ] Grant only `SELECT`, `INSERT`, `UPDATE`, `DELETE` on all tables — no `DROP`, `CREATE`, `ALTER`
- [ ] Enable **SSL** on the connection (`sslmode=require`)
- [ ] Use a **strong password** for the DB user (store in secrets manager, not in code)
- [ ] Restrict network access — allow only the backend server's IP to connect to the DB port
- [ ] Enable **pg_audit** or PostgreSQL's `log_statement` for compliance if required
- [ ] Set up regular **automated backups** with point-in-time recovery (PITR)
- [ ] The `passwordHash` column contains BCrypt hashes — treat it as sensitive PII

---

## 11. Full Table List Summary

| Table Name         | Purpose                                         | Row Growth |
|--------------------|-------------------------------------------------|------------|
| `Project`          | Top-level project container                     | Minimal    |
| `Module`           | Functional area groupings (10 default)          | Low        |
| `Team`             | Optional team groupings                         | Low        |
| `User`             | All system users                                | Low-Medium |
| `UserManager`      | Manager-user hierarchy mappings                 | Low-Medium |
| `_UserModules`     | User-module many-to-many                        | Low-Medium |
| `Task`             | Core patch/change request records               | **High**   |
| `_TaskManagers`    | Task-manager many-to-many                       | High       |
| `_TaskDevelopers`  | Task-developer many-to-many                     | High       |
| `_TaskVerifiers`   | Task-verifier many-to-many                      | High       |
| `TaskComment`      | Comments on patches                             | **High**   |
| `TaskAttachment`   | File metadata for attachments                   | Medium     |
| `StatusHistory`    | Status transition audit trail                   | **High**   |
| `AuditLog`         | Field-level change audit trail                  | **High**   |
| `Notification`     | In-app user notifications                       | **High**   |
| `Session`          | Auth session tokens                             | Medium     |

---

## 12. SQL Seed Script for Dummy Data

Run the following SQL statements to populate the database with initial projects, modules, the 11 real team users, and sample tasks.

```sql
-- 1. Seed Project
INSERT INTO "Project" ("projectId", "projectName", "description", "isActive") VALUES
('p1111111-1111-1111-1111-111111111111', 'Change Management Default Project', 'Default project for module management', TRUE);

-- 2. Seed Modules (10 default modules)
INSERT INTO "Module" ("moduleId", "projectId", "moduleName", "description", "isActive") VALUES
('m1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 'NSC', 'NSC Module', TRUE),
('m2222222-2222-2222-2222-222222222222', 'p1111111-1111-1111-1111-111111111111', 'DND', 'DND Module', TRUE),
('m3333333-3333-3333-3333-333333333333', 'p1111111-1111-1111-1111-111111111111', 'CSC', 'CSC Module', TRUE),
('m4444444-4444-4444-4444-444444444444', 'p1111111-1111-1111-1111-111111111111', 'BILLING', 'BILLING Module', TRUE),
('m5555555-5555-5555-5555-555555555555', 'p1111111-1111-1111-1111-111111111111', 'METERING', 'METERING Module', TRUE),
('m6666666-6666-6666-6666-666666666666', 'p1111111-1111-1111-1111-111111111111', 'FAM', 'FAM Module', TRUE),
('m7777777-7777-7777-7777-777777777777', 'p1111111-1111-1111-1111-111111111111', 'MOBILE BILLING', 'MOBILE BILLING Module', TRUE),
('m8888888-8888-8888-8888-888888888888', 'p1111111-1111-1111-1111-111111111111', 'REPORT', 'REPORT Module', TRUE),
('m9999999-9999-9999-9999-999999999999', 'p1111111-1111-1111-1111-111111111111', 'INTEGRATION', 'INTEGRATION Module', TRUE),
('maaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'p1111111-1111-1111-1111-111111111111', 'SMART METER INTEGRATION', 'SMART METER INTEGRATION Module', TRUE);

-- 3. Seed Users (all with password hash for 'upcl@123', BCrypt salt)
INSERT INTO "User" ("userId", "username", "passwordHash", "salt", "role", "name", "designation", "isActive") VALUES
('u0000000-0000-0000-0000-000000000000', 'admin', '$2a$12$XsO0Pdfk3VVB9dk8TCF94uviwue//Cu0UT3upTlPkZmKA0cfMzhoO', 'BCrypt', 'ADMIN', 'System Admin', 'System Administrator', TRUE),
('u1111111-1111-1111-1111-111111111111', 'komal', '$2a$12$XsO0Pdfk3VVB9dk8TCF94uviwue//Cu0UT3upTlPkZmKA0cfMzhoO', 'BCrypt', 'CLIENT', 'Komal', 'Client', TRUE),
('u2222222-2222-2222-2222-222222222222', 'abhishek_rishi', '$2a$12$XsO0Pdfk3VVB9dk8TCF94uviwue//Cu0UT3upTlPkZmKA0cfMzhoO', 'BCrypt', 'MANAGER', 'ABHISHEK_RISHI', 'Project Manager', TRUE),
('u3333333-3333-3333-3333-333333333333', 'prashantp', '$2a$12$XsO0Pdfk3VVB9dk8TCF94uviwue//Cu0UT3upTlPkZmKA0cfMzhoO', 'BCrypt', 'MANAGER', 'PRASHANTP', 'Project Manager', TRUE),
('u4444444-4444-4444-4444-444444444444', 'abhishiek_r', '$2a$12$XsO0Pdfk3VVB9dk8TCF94uviwue//Cu0UT3upTlPkZmKA0cfMzhoO', 'BCrypt', 'MANAGER', 'ABHISHIEK_R', 'Project Manager', TRUE),
('u5555555-5555-5555-5555-555555555555', 'siva', '$2a$12$XsO0Pdfk3VVB9dk8TCF94uviwue//Cu0UT3upTlPkZmKA0cfMzhoO', 'BCrypt', 'DEVELOPER', 'SIVA', 'Software Developer', TRUE),
('u6666666-6666-6666-6666-666666666666', 'trinadh', '$2a$12$XsO0Pdfk3VVB9dk8TCF94uviwue//Cu0UT3upTlPkZmKA0cfMzhoO', 'BCrypt', 'DEVELOPER', 'TRINADH', 'Software Developer', TRUE),
('u7777777-7777-7777-7777-777777777777', 'anukriti', '$2a$12$XsO0Pdfk3VVB9dk8TCF94uviwue//Cu0UT3upTlPkZmKA0cfMzhoO', 'BCrypt', 'DEVELOPER', 'ANUKRITI', 'Software Developer', TRUE),
('u8888888-8888-8888-8888-888888888888', 'sachinp', '$2a$12$XsO0Pdfk3VVB9dk8TCF94uviwue//Cu0UT3upTlPkZmKA0cfMzhoO', 'BCrypt', 'DEVELOPER', 'SACHINP', 'Software Developer', TRUE),
('u9999999-9999-9999-9999-999999999999', 'pankaj', '$2a$12$XsO0Pdfk3VVB9dk8TCF94uviwue//Cu0UT3upTlPkZmKA0cfMzhoO', 'BCrypt', 'VERIFIER', 'PANKAJ', 'QA Engineer', TRUE),
('uaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'jagdish', '$2a$12$XsO0Pdfk3VVB9dk8TCF94uviwue//Cu0UT3upTlPkZmKA0cfMzhoO', 'BCrypt', 'VERIFIER', 'JAGDISH', 'QA Engineer', TRUE);

-- 4. Seed UserManager Relationships (Manager assignment mapping)
INSERT INTO "UserManager" ("id", "userId", "managerId") VALUES
('um111111-1111-1111-1111-111111111111', 'u5555555-5555-5555-5555-555555555555', 'u2222222-2222-2222-2222-222222222222'), -- siva managed by abhishek_rishi
('um222222-2222-2222-2222-222222222222', 'u6666666-6666-6666-6666-666666666666', 'u2222222-2222-2222-2222-222222222222'), -- trinadh managed by abhishek_rishi
('um333333-3333-3333-3333-333333333333', 'u7777777-7777-7777-7777-777777777777', 'u3333333-3333-3333-3333-333333333333'), -- anukriti managed by prashantp
('um444444-4444-4444-4444-444444444444', 'u8888888-8888-8888-8888-888888888888', 'u4444444-4444-4444-4444-444444444444'), -- sachinp managed by abhishiek_r
('um555555-5555-5555-5555-555555555555', 'u9999999-9999-9999-9999-999999999999', 'u2222222-2222-2222-2222-222222222222'), -- pankaj managed by abhishek_rishi
('um666666-6666-6666-6666-666666666666', 'uaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'u3333333-3333-3333-3333-333333333333'); -- jagdish managed by prashantp

-- 5. Seed Tasks (Change Requests / Patches)
INSERT INTO "Task" ("id", "clientRequestId", "title", "description", "status", "authorId", "clientId", "moduleId", "dateGiven", "isInternal") VALUES
('202605270001', 101, 'NSC Billing Interface Adjustments', 'Test Patch 1 - NSC Billing Interface [CHANGE_ID: 202605270001] [CLIENT_DEADLINE: 2026-06-30]
Needs verification of formatting and data parsing filters.', 'DRAFT', 'u1111111-1111-1111-1111-111111111111', 'u1111111-1111-1111-1111-111111111111', 'm1111111-1111-1111-1111-111111111111', NOW(), FALSE);

INSERT INTO "Task" ("id", "clientRequestId", "title", "description", "status", "authorId", "clientId", "moduleId", "dateGiven", "dateStarted", "isInternal") VALUES
('202605270002', 102, 'DND Security Update', 'Test Patch 2 - DND Security Update [CHANGE_ID: 202605270002]
Applying security filters and authentication locks on the DND modules.', 'IN_DEVELOPMENT', 'u1111111-1111-1111-1111-111111111111', 'u1111111-1111-1111-1111-111111111111', 'm2222222-2222-2222-2222-222222222222', NOW() - INTERVAL '1 DAY', NOW(), FALSE);

-- 6. Seed Task Assignments (Many-to-Many associations)
-- Map task 2 to manager (abhishek_rishi), developer (siva), verifier (pankaj)
INSERT INTO "_TaskManagers" ("A", "B") VALUES ('202605270002', 'u2222222-2222-2222-2222-222222222222');
INSERT INTO "_TaskDevelopers" ("A", "B") VALUES ('202605270002', 'u5555555-5555-5555-5555-555555555555');
INSERT INTO "_TaskVerifiers" ("A", "B") VALUES ('202605270002', 'u9999999-9999-9999-9999-999999999999');

-- 7. Seed Comments
INSERT INTO "TaskComment" ("id", "taskId", "userId", "content", "authorName", "authorRole") VALUES
('tc111111-1111-1111-1111-111111111111', '202605270001', 'u1111111-1111-1111-1111-111111111111', 'Created the patch request for NSC module interface integration. Please review.', 'Komal', 'CLIENT'),
('tc222222-2222-2222-2222-222222222222', '202605270002', 'u1111111-1111-1111-1111-111111111111', 'Patch request submitted to assignment pool.', 'Komal', 'CLIENT'),
('tc333333-3333-3333-3333-333333333333', '202605270002', 'u2222222-2222-2222-2222-222222222222', 'Assigned Siva for DND development, and Pankaj for QA verification.', 'ABHISHEK_RISHI', 'MANAGER'),
('tc444444-4444-4444-4444-444444444444', '202605270002', 'u5555555-5555-5555-5555-555555555555', 'Beginning development on safety filters.', 'SIVA', 'DEVELOPER');

-- 8. Seed Status History
INSERT INTO "StatusHistory" ("id", "taskId", "previousStatus", "newStatus", "changedById", "changedByName", "changedByUsername", "changedByRole", "reason") VALUES
('sh111111-1111-1111-1111-111111111111', '202605270001', 'DRAFT', 'DRAFT', 'u1111111-1111-1111-1111-111111111111', 'Komal', 'komal', 'CLIENT', 'Task created in draft mode'),
('sh222222-2222-2222-2222-222222222222', '202605270002', 'DRAFT', 'ASSIGNED', 'u1111111-1111-1111-1111-111111111111', 'Komal', 'komal', 'CLIENT', 'Submitted to assignment pool'),
('sh333333-3333-3333-3333-333333333333', '202605270002', 'ASSIGNED', 'PENDING_APPROVAL', 'u2222222-2222-2222-2222-222222222222', 'ABHISHEK_RISHI', 'abhishek_rishi', 'MANAGER', 'Assigned resources'),
('sh444444-4444-4444-4444-444444444444', '202605270002', 'PENDING_APPROVAL', 'IN_DEVELOPMENT', 'u2222222-2222-2222-2222-222222222222', 'ABHISHEK_RISHI', 'abhishek_rishi', 'MANAGER', 'Development process approved');
```

---

*Document generated from source code analysis of the PatchFlow backend (Spring Boot + Hibernate JPA, PostgreSQL).*  
*Contact the application developer for any clarifications before making schema changes.*
