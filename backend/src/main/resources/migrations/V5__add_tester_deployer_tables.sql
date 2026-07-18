-- V5: Add Tester and Deployer many-to-many junction tables
-- Schema is identical to change_req_TaskDevelopers / change_req_TaskVerifiers.
-- Run once on production before deploying PatchFlow v2 with Tester/Deployer support.

CREATE TABLE IF NOT EXISTS change_req_TaskTesters (
    A         VARCHAR(36) NOT NULL,
    B         VARCHAR(36) NOT NULL,
    is_active BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_tasktesters PRIMARY KEY (A, B),
    CONSTRAINT fk_tasktesters_A FOREIGN KEY (A) REFERENCES change_req_Task(id) ON DELETE CASCADE,
    CONSTRAINT fk_tasktesters_B FOREIGN KEY (B) REFERENCES change_req_User(userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_tasktesters_B ON change_req_TaskTesters(B);

CREATE TABLE IF NOT EXISTS change_req_TaskDeployers (
    A         VARCHAR(36) NOT NULL,
    B         VARCHAR(36) NOT NULL,
    is_active BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_taskdeployers PRIMARY KEY (A, B),
    CONSTRAINT fk_taskdeployers_A FOREIGN KEY (A) REFERENCES change_req_Task(id) ON DELETE CASCADE,
    CONSTRAINT fk_taskdeployers_B FOREIGN KEY (B) REFERENCES change_req_User(userId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_taskdeployers_B ON change_req_TaskDeployers(B);
