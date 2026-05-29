# PatchFlow — Database Schema Addendum (v2)
**Prepared for:** Company DB Developer  
**Application:** PatchFlow Change Management System  
**Document Type:** Schema Extension / Migration Guide  
**Relates to:** `DB_SCHEMA.md` (base schema)  
**Date:** 2026-05-29  

---

## 1. Overview of Changes

This document describes the **new table** added to the PatchFlow database as part of the **Self-Registration & Admin Approval** feature.

### What Changed?

| Change Type | Details |
|-------------|---------|
| **New Table** | `AccountRequest` — stores pending self-registration requests from the public login page |
| **Existing Tables** | No changes to any existing table (User, Task, Session, etc.) |
| **Schema** | `public` (same as all other tables) |

### Why This Table Exists

Previously, all user accounts were created exclusively by an administrator via the Admin Panel. The new feature allows **CLIENT** and **VIEWER** role users to self-register directly from the login page. Their registration goes into `AccountRequest` as **PENDING**, and an admin must **approve** (which creates the real `User` record) or **reject** it. This table acts as the pre-approval staging area.

---

## 2. New Table: `AccountRequest`

### Purpose

Stores self-registration requests submitted from the public-facing login page. Only `CLIENT` and `VIEWER` roles are permitted via self-registration. Internal roles (`ADMIN`, `MANAGER`, `DEVELOPER`, `VERIFIER`) continue to be created exclusively by admins through the existing flow.

### Status Lifecycle

```
PENDING  →  APPROVED  (admin approves → real User record is created)
         →  REJECTED  (admin rejects, optional rejection note stored)
```

| Status | Description |
|--------|-------------|
| `PENDING` | Request submitted, awaiting admin review |
| `APPROVED` | Admin approved — corresponding `User` row has been created |
| `REJECTED` | Admin rejected — no `User` row was created |

---

## 3. DDL — `AccountRequest` Table

Run this migration **after** the base schema (`DB_SCHEMA.md`) has been applied. This is a safe, additive change — it does not alter any existing table.

```sql
-- Migration: AccountRequest table
-- Feature: Self-Registration & Admin Approval (v2)
-- Safe to run independently — no existing tables are modified.

CREATE TABLE "AccountRequest" (
    "id"           VARCHAR(36)  NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "username"     VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "salt"         VARCHAR(255) NOT NULL DEFAULT 'BCrypt',
    "name"         VARCHAR(255) NOT NULL,
    "phone"        VARCHAR(20),
    "role"         VARCHAR(50)  NOT NULL DEFAULT 'CLIENT',
    "status"       VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    "reviewedBy"   VARCHAR(36),
    "reviewNote"   TEXT,
    "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "reviewedAt"   TIMESTAMPTZ,

    CONSTRAINT "pk_accountrequest"          PRIMARY KEY ("id"),
    CONSTRAINT "uq_accountrequest_username" UNIQUE      ("username"),
    CONSTRAINT "ck_accountrequest_role"     CHECK       ("role"   IN ('CLIENT', 'VIEWER')),
    CONSTRAINT "ck_accountrequest_status"   CHECK       ("status" IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX "idx_accountrequest_status"    ON "AccountRequest" ("status");
CREATE INDEX "idx_accountrequest_createdat" ON "AccountRequest" ("createdAt" DESC);
```

> **File location:** `backend/src/main/resources/migrations/V2__account_requests.sql`

---

## 4. Column Reference

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `VARCHAR(36)` | NO | `gen_random_uuid()` | Primary key (UUID) |
| `username` | `VARCHAR(255)` | NO | — | Desired username — must be unique across this table **and** the `User` table |
| `passwordHash` | `VARCHAR(255)` | NO | — | BCrypt hash of the submitted password (strength 12). Never stored in plaintext. |
| `salt` | `VARCHAR(255)` | NO | `'BCrypt'` | Always the string `'BCrypt'` — BCrypt embeds its salt inside the hash (matches convention from `User.salt`) |
| `name` | `VARCHAR(255)` | NO | — | Full name of the applicant |
| `phone` | `VARCHAR(20)` | YES | NULL | Optional phone number provided during registration — displayed to admin during review |
| `role` | `VARCHAR(50)` | NO | `'CLIENT'` | Requested role — constrained to `CLIENT` or `VIEWER` only |
| `status` | `VARCHAR(20)` | NO | `'PENDING'` | Current lifecycle status: `PENDING`, `APPROVED`, or `REJECTED` |
| `reviewedBy` | `VARCHAR(36)` | YES | NULL | `userId` of the admin who approved or rejected the request (FK-like reference to `User.userId` — not enforced as a hard FK to allow flexible cleanup) |
| `reviewNote` | `TEXT` | YES | NULL | Optional note from admin — primarily used to explain a rejection |
| `createdAt` | `TIMESTAMPTZ` | NO | `NOW()` | Timestamp when the request was submitted |
| `reviewedAt` | `TIMESTAMPTZ` | YES | NULL | Timestamp when the request was approved or rejected |

---

## 5. Constraints Summary

| Constraint Name | Type | Details |
|----------------|------|---------|
| `pk_accountrequest` | PRIMARY KEY | `id` |
| `uq_accountrequest_username` | UNIQUE | `username` — prevents duplicate requests for the same username |
| `ck_accountrequest_role` | CHECK | `role IN ('CLIENT', 'VIEWER')` |
| `ck_accountrequest_status` | CHECK | `status IN ('PENDING', 'APPROVED', 'REJECTED')` |

---

## 6. Indexes

| Index Name | Column(s) | Purpose |
|-----------|-----------|---------|
| `idx_accountrequest_status` | `status` | Admin panel filters requests by PENDING / APPROVED / REJECTED |
| `idx_accountrequest_createdat` | `createdAt DESC` | Default sort order — newest requests first |

---

## 7. Relationship with Existing Tables

```
AccountRequest  ──(on approve)──►  User
                                   (new row created using passwordHash, name, role from AccountRequest)

AccountRequest.reviewedBy  ──►  User.userId  (soft reference, no FK constraint)
```

> **Important:** The `AccountRequest` table does **not** have a hard foreign key to the `User` table. This is intentional — `reviewedBy` is a reference to the admin's `userId` but is stored as a plain `VARCHAR(36)` to avoid cascading issues if an admin user is ever deleted.

---

## 8. Approval Flow — What Happens in the Database

When an admin **approves** a request:

1. Backend reads the `AccountRequest` row where `status = 'PENDING'`
2. A new `User` row is **inserted** using:
   - `username` ← from `AccountRequest.username`
   - `passwordHash` ← from `AccountRequest.passwordHash` (pre-hashed, reused directly)
   - `salt` ← `'BCrypt'`
   - `name` ← from `AccountRequest.name`
   - `role` ← from `AccountRequest.role`
   - `designation` ← `"Phone: {phone}"` if phone was provided (temporary storage until a `phone` column is added to `User`)
   - `isActive` ← `TRUE`
   - `createdBy` ← admin's `userId`
3. `AccountRequest.status` is set to `'APPROVED'`
4. `AccountRequest.reviewedBy` is set to the admin's `userId`
5. `AccountRequest.reviewedAt` is set to `NOW()`

When an admin **rejects** a request:

1. `AccountRequest.status` → `'REJECTED'`
2. `AccountRequest.reviewedBy` → admin's `userId`
3. `AccountRequest.reviewNote` → optional note text
4. `AccountRequest.reviewedAt` → `NOW()`
5. No `User` row is created.

---

## 9. New API Endpoints (for Reference)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/request-access` | **Public** | Submit a new registration request |
| `GET` | `/api/admin/account-requests` | ADMIN+ | List all requests (optional `?status=PENDING`) |
| `POST` | `/api/admin/account-requests/:id/approve` | ADMIN+ | Approve → creates `User` |
| `POST` | `/api/admin/account-requests/:id/reject` | ADMIN+ | Reject with optional note |

---

## 10. Periodic Maintenance Queries

```sql
-- Count pending requests (for admin dashboard badge)
SELECT COUNT(*) FROM "AccountRequest" WHERE "status" = 'PENDING';

-- View all pending requests, newest first
SELECT "id", "username", "name", "phone", "role", "createdAt"
FROM "AccountRequest"
WHERE "status" = 'PENDING'
ORDER BY "createdAt" DESC;

-- Clean up old rejected requests (older than 90 days)
DELETE FROM "AccountRequest"
WHERE "status" = 'REJECTED'
  AND "reviewedAt" < NOW() - INTERVAL '90 days';

-- Clean up old approved requests (older than 180 days — optional, for archival)
DELETE FROM "AccountRequest"
WHERE "status" = 'APPROVED'
  AND "reviewedAt" < NOW() - INTERVAL '180 days';

-- Find all requests for a specific username (to check duplicates)
SELECT * FROM "AccountRequest" WHERE "username" = 'some_user';
```

---

## 11. Security Notes for DB Developer

- [ ] The `passwordHash` column contains **BCrypt hashes** — treat as sensitive PII, same as `User.passwordHash`
- [ ] The `phone` column contains **PII** — ensure it is covered by your backup encryption and access controls
- [ ] The `uq_accountrequest_username` constraint prevents username squatting but the backend also checks uniqueness against `User.username` at the application level before inserting
- [ ] The `PENDING` requests accumulate over time — consider adding a **cron job** to auto-expire requests older than 30 days if not reviewed
- [ ] No hard FK from `AccountRequest.reviewedBy` to `User.userId` — this is intentional; do not add one

---

## 12. Future Considerations

| Item | Notes |
|------|-------|
| Add `phone` column to `User` table | Currently phone is only in `AccountRequest`; on approval it's stuffed into `designation`. A future `ALTER TABLE "User" ADD COLUMN "phone" VARCHAR(20)` migration would store it properly. |
| Email notifications | The schema has no email field currently. If email notifications for approval/rejection are needed, an `email` column should be added to `AccountRequest` (and optionally `User`). |
| Auto-expiry of PENDING requests | Add a background cron or DB trigger to auto-reject stale requests after N days. |
| Audit trail | Currently approved/rejected requests are tracked via `reviewedBy` and `reviewedAt`. Consider also writing to `AuditLog` for compliance. |

---

*Document prepared from PatchFlow v2 feature implementation.*  
*For base schema reference, see `DB_SCHEMA.md`.*  
*Contact the application developer before making any schema changes.*
