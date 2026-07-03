-- MySQL Schema DDL for PatchFlow

CREATE TABLE IF NOT EXISTS change_req_Project (
    projectId   VARCHAR(36)  NOT NULL,
    projectName VARCHAR(100) NOT NULL,
    description TEXT,
    isActive    BOOLEAN      NOT NULL DEFAULT TRUE,
    createdAt   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_project PRIMARY KEY (projectId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS change_req_Team (
    id        VARCHAR(36)  NOT NULL,
    name      VARCHAR(100) NOT NULL,
    createdAt TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_team PRIMARY KEY (id),
    CONSTRAINT uq_team_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS change_req_User (
    userId              VARCHAR(36)  NOT NULL,
    username            VARCHAR(50)  NOT NULL,
    passwordHash        VARCHAR(72)  NOT NULL,
    role                VARCHAR(30)  NOT NULL DEFAULT 'DEVELOPER',
    name                VARCHAR(100) NOT NULL,
    designation         VARCHAR(100),
    previousDesignation VARCHAR(100),
    isActive            BOOLEAN      NOT NULL DEFAULT TRUE,
    createdBy           VARCHAR(36),
    email               VARCHAR(255),
    phone               VARCHAR(50),
    createdAt           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_user PRIMARY KEY (userId),
    CONSTRAINT uq_user_username UNIQUE (username),
    CONSTRAINT fk_user_createdBy FOREIGN KEY (createdBy) REFERENCES change_req_User(userId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_user_role     ON change_req_User(role);
CREATE INDEX idx_user_isActive ON change_req_User(isActive);

CREATE TABLE IF NOT EXISTS change_req_Module (
    moduleId    VARCHAR(36)  NOT NULL,
    projectId   VARCHAR(36)  NOT NULL,
    moduleName  VARCHAR(100) NOT NULL,
    description TEXT,
    isActive    BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_module PRIMARY KEY (moduleId),
    CONSTRAINT uq_module_moduleName UNIQUE (moduleName),
    CONSTRAINT fk_module_projectId FOREIGN KEY (projectId) REFERENCES change_req_Project(projectId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_module_projectId ON change_req_Module(projectId);
CREATE INDEX idx_module_isActive  ON change_req_Module(isActive);

CREATE TABLE IF NOT EXISTS change_req_Session (
    sessionId VARCHAR(36)  NOT NULL,
    userId    VARCHAR(36)  NOT NULL,
    tokenHash VARCHAR(64)  NOT NULL,
    expiresAt TIMESTAMP    NOT NULL,
    createdAt TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_session PRIMARY KEY (sessionId),
    CONSTRAINT uq_session_tokenHash UNIQUE (tokenHash),
    CONSTRAINT fk_session_userId FOREIGN KEY (userId) REFERENCES change_req_User(userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_session_userId    ON change_req_Session(userId);
CREATE INDEX idx_session_expiresAt ON change_req_Session(expiresAt);

CREATE TABLE IF NOT EXISTS change_req_AccountRequest (
    id           VARCHAR(36)  NOT NULL,
    username     VARCHAR(50)  NOT NULL,
    passwordHash VARCHAR(72)  NOT NULL,
    name         VARCHAR(100) NOT NULL,
    phone        VARCHAR(20),
    email        VARCHAR(255),
    role         VARCHAR(20)  NOT NULL,
    status       VARCHAR(10)  NOT NULL DEFAULT 'PENDING',
    reviewedBy   VARCHAR(36),
    reviewNote   TEXT,
    createdAt    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewedAt   TIMESTAMP    NULL DEFAULT NULL,
    CONSTRAINT pk_accountrequest PRIMARY KEY (id),
    CONSTRAINT uq_accountrequest_username UNIQUE (username),
    CONSTRAINT fk_accountrequest_reviewedBy FOREIGN KEY (reviewedBy) REFERENCES change_req_User(userId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_accountrequest_status ON change_req_AccountRequest(status);

CREATE TABLE IF NOT EXISTS change_req_Task (
    id              VARCHAR(36)  NOT NULL,
    clientRequestId INTEGER      NOT NULL DEFAULT 0,
    title           VARCHAR(200) NOT NULL,
    description     TEXT         NOT NULL,
    status          VARCHAR(30)  NOT NULL DEFAULT 'DRAFT',
    lifecycleStatus INTEGER      NOT NULL DEFAULT 0,
    isInternal      BOOLEAN      NOT NULL DEFAULT FALSE,
    authorId        VARCHAR(36)  NOT NULL,
    clientId        VARCHAR(36),
    assigneeId      VARCHAR(36),
    approverId      VARCHAR(36),
    deployerId      VARCHAR(36),
    verifierId      VARCHAR(36),
    teamId          VARCHAR(36),
    moduleId        VARCHAR(36),
    assignedAt       TIMESTAMP    NULL DEFAULT NULL,
    plannedStartDate TIMESTAMP    NULL DEFAULT NULL,
    plannedEndDate   TIMESTAMP    NULL DEFAULT NULL,
    dateGiven        TIMESTAMP    NULL DEFAULT NULL,
    dateStarted      TIMESTAMP    NULL DEFAULT NULL,
    dateEnded        TIMESTAMP    NULL DEFAULT NULL,
    completedAt      TIMESTAMP    NULL DEFAULT NULL,
    createdAt        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_task PRIMARY KEY (id),
    CONSTRAINT fk_task_authorId   FOREIGN KEY (authorId)   REFERENCES change_req_User(userId),
    CONSTRAINT fk_task_clientId   FOREIGN KEY (clientId)   REFERENCES change_req_User(userId),
    CONSTRAINT fk_task_assigneeId FOREIGN KEY (assigneeId) REFERENCES change_req_User(userId),
    CONSTRAINT fk_task_approverId FOREIGN KEY (approverId) REFERENCES change_req_User(userId),
    CONSTRAINT fk_task_deployerId FOREIGN KEY (deployerId) REFERENCES change_req_User(userId),
    CONSTRAINT fk_task_verifierId FOREIGN KEY (verifierId) REFERENCES change_req_User(userId),
    CONSTRAINT fk_task_teamId     FOREIGN KEY (teamId)     REFERENCES change_req_Team(id),
    CONSTRAINT fk_task_moduleId   FOREIGN KEY (moduleId)   REFERENCES change_req_Module(moduleId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_task_status     ON change_req_Task(status);
CREATE INDEX idx_task_authorId   ON change_req_Task(authorId);
CREATE INDEX idx_task_clientId   ON change_req_Task(clientId);
CREATE INDEX idx_task_moduleId   ON change_req_Task(moduleId);
CREATE INDEX idx_task_assigneeId ON change_req_Task(assigneeId);
CREATE INDEX idx_task_createdAt  ON change_req_Task(createdAt DESC);

CREATE TABLE IF NOT EXISTS change_req_TaskAttachment (
    id         VARCHAR(36)  NOT NULL,
    taskId     VARCHAR(36)  NOT NULL,
    uploaderId VARCHAR(36)  NOT NULL,
    fileUrl    VARCHAR(200) NOT NULL,
    fileName   VARCHAR(100) NOT NULL,
    fileType   VARCHAR(60)  NOT NULL,
    size       INTEGER      NOT NULL,
    createdAt  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_taskattachment PRIMARY KEY (id),
    CONSTRAINT fk_attachment_taskId FOREIGN KEY (taskId)     REFERENCES change_req_Task(id) ON DELETE CASCADE,
    CONSTRAINT fk_attachment_uploaderId FOREIGN KEY (uploaderId) REFERENCES change_req_User(userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_taskattachment_taskId ON change_req_TaskAttachment(taskId);

CREATE TABLE IF NOT EXISTS change_req_TaskComment (
    id         VARCHAR(36)  NOT NULL,
    taskId     VARCHAR(36)  NOT NULL,
    userId     VARCHAR(36)  NOT NULL,
    content    TEXT         NOT NULL,
    authorName VARCHAR(100),
    authorRole VARCHAR(30),
    files      JSON,
    createdAt  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_taskcomment PRIMARY KEY (id),
    CONSTRAINT fk_comment_taskId FOREIGN KEY (taskId) REFERENCES change_req_Task(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_userId FOREIGN KEY (userId) REFERENCES change_req_User(userId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_taskcomment_taskId ON change_req_TaskComment(taskId);

CREATE TABLE IF NOT EXISTS change_req_StatusHistory (
    id                VARCHAR(36)  NOT NULL,
    taskId            VARCHAR(36)  NOT NULL,
    previousStatus    VARCHAR(30)  NOT NULL,
    newStatus         VARCHAR(30)  NOT NULL,
    changedById       VARCHAR(36),
    changedByName     VARCHAR(100),
    changedByUsername VARCHAR(50),
    changedByRole     VARCHAR(30),
    reason            TEXT,
    createdAt         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_statushistory PRIMARY KEY (id),
    CONSTRAINT fk_statushistory_taskId FOREIGN KEY (taskId)      REFERENCES change_req_Task(id) ON DELETE CASCADE,
    CONSTRAINT fk_statushistory_changedById   FOREIGN KEY (changedById) REFERENCES change_req_User(userId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_statushistory_taskId    ON change_req_StatusHistory(taskId);
CREATE INDEX idx_statushistory_createdAt ON change_req_StatusHistory(createdAt ASC);

CREATE TABLE IF NOT EXISTS change_req_AuditLog (
    logId        VARCHAR(36)  NOT NULL,
    taskId       VARCHAR(36),
    changedBy    VARCHAR(36),
    targetUserId VARCHAR(36),
    fieldChanged VARCHAR(80)  NOT NULL,
    oldValue     VARCHAR(100),
    newValue     VARCHAR(100),
    reason       TEXT         NOT NULL,
    changedAt    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_auditlog PRIMARY KEY (logId),
    CONSTRAINT fk_auditlog_taskId     FOREIGN KEY (taskId)       REFERENCES change_req_Task(id) ON DELETE SET NULL,
    CONSTRAINT fk_auditlog_changedBy  FOREIGN KEY (changedBy)    REFERENCES change_req_User(userId) ON DELETE SET NULL,
    CONSTRAINT fk_auditlog_targetUser FOREIGN KEY (targetUserId) REFERENCES change_req_User(userId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_auditlog_taskId    ON change_req_AuditLog(taskId);
CREATE INDEX idx_auditlog_changedAt ON change_req_AuditLog(changedAt DESC);

CREATE TABLE IF NOT EXISTS change_req_Notification (
    id        VARCHAR(36) NOT NULL,
    userId    VARCHAR(36) NOT NULL,
    type      VARCHAR(50) NOT NULL,
    message   TEXT        NOT NULL,
    `read`    BOOLEAN     NOT NULL DEFAULT FALSE,
    createdAt TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_notification PRIMARY KEY (id),
    CONSTRAINT fk_notification_userId FOREIGN KEY (userId) REFERENCES change_req_User(userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_notification_userId    ON change_req_Notification(userId);
CREATE INDEX idx_notification_createdAt ON change_req_Notification(createdAt DESC);

CREATE TABLE IF NOT EXISTS change_req_UserManager (
    id         VARCHAR(36) NOT NULL,
    userId     VARCHAR(36) NOT NULL,
    managerId  VARCHAR(36) NOT NULL,
    assignedAt TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    isActive   BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_usermanager PRIMARY KEY (id),
    CONSTRAINT uq_usermanager_pair UNIQUE (userId, managerId),
    CONSTRAINT fk_usermanager_userId  FOREIGN KEY (userId)    REFERENCES change_req_User(userId) ON DELETE CASCADE,
    CONSTRAINT fk_usermanager_manager FOREIGN KEY (managerId) REFERENCES change_req_User(userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS change_req_TaskManagers (
    A        VARCHAR(36) NOT NULL,
    B        VARCHAR(36) NOT NULL,
    is_active BOOLEAN    NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_taskmanagers PRIMARY KEY (A, B),
    CONSTRAINT fk_taskmanagers_A FOREIGN KEY (A) REFERENCES change_req_Task(id) ON DELETE CASCADE,
    CONSTRAINT fk_taskmanagers_B FOREIGN KEY (B) REFERENCES change_req_User(userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_taskmanagers_B ON change_req_TaskManagers(B);

CREATE TABLE IF NOT EXISTS change_req_TaskDevelopers (
    A        VARCHAR(36) NOT NULL,
    B        VARCHAR(36) NOT NULL,
    is_active BOOLEAN    NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_taskdevelopers PRIMARY KEY (A, B),
    CONSTRAINT fk_taskdevelopers_A FOREIGN KEY (A) REFERENCES change_req_Task(id) ON DELETE CASCADE,
    CONSTRAINT fk_taskdevelopers_B FOREIGN KEY (B) REFERENCES change_req_User(userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_taskdevelopers_B ON change_req_TaskDevelopers(B);

CREATE TABLE IF NOT EXISTS change_req_TaskVerifiers (
    A        VARCHAR(36) NOT NULL,
    B        VARCHAR(36) NOT NULL,
    is_active BOOLEAN    NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_taskverifiers PRIMARY KEY (A, B),
    CONSTRAINT fk_taskverifiers_A FOREIGN KEY (A) REFERENCES change_req_Task(id) ON DELETE CASCADE,
    CONSTRAINT fk_taskverifiers_B FOREIGN KEY (B) REFERENCES change_req_User(userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_taskverifiers_B ON change_req_TaskVerifiers(B);

CREATE TABLE IF NOT EXISTS change_req_UserModules (
    A VARCHAR(36) NOT NULL,
    B VARCHAR(36) NOT NULL,
    CONSTRAINT pk_usermodules PRIMARY KEY (A, B),
    CONSTRAINT fk_usermodules_A FOREIGN KEY (A) REFERENCES change_req_Module(moduleId) ON DELETE CASCADE,
    CONSTRAINT fk_usermodules_B FOREIGN KEY (B) REFERENCES change_req_User(userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_usermodules_B ON change_req_UserModules(B);
