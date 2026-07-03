-- Migration: NotificationStack and User notification preferences (MySQL Version)
-- Must be run manually on the MySQL instance before deploying.

CREATE TABLE IF NOT EXISTS change_req_NotificationStack (
    id            VARCHAR(36)  NOT NULL,
    recipientId   VARCHAR(36)  NOT NULL,
    channel       VARCHAR(20)  NOT NULL, -- 'EMAIL', 'SMS', 'WHATSAPP'
    recipientInfo VARCHAR(255) NOT NULL, -- Email address or Phone number
    subject       VARCHAR(255),
    messageText   TEXT         NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'FAILED'
    errorMessage  TEXT,
    retryCount    INT          NOT NULL DEFAULT 0,
    createdAt     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processedAt   TIMESTAMP    NULL DEFAULT NULL,

    CONSTRAINT pk_notificationstack            PRIMARY KEY (id),
    CONSTRAINT fk_notificationstack_recipient  FOREIGN KEY (recipientId) REFERENCES change_req_User(userId) ON DELETE CASCADE,
    CONSTRAINT ck_notificationstack_channel    CHECK (channel IN ('EMAIL', 'SMS', 'WHATSAPP')),
    CONSTRAINT ck_notificationstack_status     CHECK (status IN ('PENDING', 'SENT', 'FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_notificationstack_status ON change_req_NotificationStack (status);
CREATE INDEX idx_notificationstack_createdat ON change_req_NotificationStack (createdAt DESC);

-- Add notification preference columns to the User table
ALTER TABLE change_req_User ADD COLUMN notifyEmail    BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE change_req_User ADD COLUMN notifySms      BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE change_req_User ADD COLUMN notifyWhatsapp BOOLEAN NOT NULL DEFAULT TRUE;
