-- Migration: Add soft-deletion columns for No-DELETE database policy
-- Adds columns to UserManager and Task relationship join tables
-- Supports both original schema naming and Java change_req_ naming strategies.

-- 1. UserManager
ALTER TABLE IF EXISTS "UserManager" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS "change_req_UserManager" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. TaskManagers
ALTER TABLE IF EXISTS "_TaskManagers" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS "change_req_TaskManagers" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. TaskDevelopers
ALTER TABLE IF EXISTS "_TaskDevelopers" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS "change_req_TaskDevelopers" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE;

-- 4. TaskVerifiers
ALTER TABLE IF EXISTS "_TaskVerifiers" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS "change_req_TaskVerifiers" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE;
