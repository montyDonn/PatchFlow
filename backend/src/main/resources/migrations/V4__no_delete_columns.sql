-- Migration: Add soft-deletion columns for No-DELETE database policy (MySQL Version)

-- 1. UserManager
ALTER TABLE change_req_UserManager ADD COLUMN isActive BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. TaskManagers
ALTER TABLE change_req_TaskManagers ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. TaskDevelopers
ALTER TABLE change_req_TaskDevelopers ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 4. TaskVerifiers
ALTER TABLE change_req_TaskVerifiers ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
