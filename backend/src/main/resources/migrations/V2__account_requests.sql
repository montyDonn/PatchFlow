-- Migration: AccountRequest table
-- Stores self-registration requests from the login page (CLIENT/VIEWER roles only)
-- Must be run manually on the PostgreSQL instance before deploying.

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
