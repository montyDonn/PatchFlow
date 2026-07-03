-- Migration: NotificationStack and User notification preferences
-- Must be run manually on the PostgreSQL instance before deploying.

CREATE TABLE IF NOT EXISTS "NotificationStack" (
    "id"            VARCHAR(36)  NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "recipientId"   VARCHAR(36)  NOT NULL,
    "channel"       VARCHAR(20)  NOT NULL, -- 'EMAIL', 'SMS', 'WHATSAPP'
    "recipientInfo" VARCHAR(255) NOT NULL, -- Email address or Phone number
    "subject"       VARCHAR(255),
    "messageText"   TEXT         NOT NULL,
    "status"        VARCHAR(20)  NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'FAILED'
    "errorMessage"  TEXT,
    "retryCount"    INT          NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "processedAt"   TIMESTAMPTZ,

    CONSTRAINT "pk_notificationstack"            PRIMARY KEY ("id"),
    CONSTRAINT "fk_notificationstack_recipient"  FOREIGN KEY ("recipientId") REFERENCES "User"("userId") ON DELETE CASCADE,
    CONSTRAINT "ck_notificationstack_channel"    CHECK ("channel" IN ('EMAIL', 'SMS', 'WHATSAPP')),
    CONSTRAINT "ck_notificationstack_status"     CHECK ("status" IN ('PENDING', 'SENT', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS "idx_notificationstack_status" ON "NotificationStack" ("status");
CREATE INDEX IF NOT EXISTS "idx_notificationstack_createdat" ON "NotificationStack" ("createdAt" DESC);

-- Add notification preference columns to the User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyEmail"    BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifySms"      BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT TRUE;
