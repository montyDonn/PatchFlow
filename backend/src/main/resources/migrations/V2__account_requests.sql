-- Migration: AccountRequest table (MySQL Version)
-- Stores self-registration requests from the login page (CLIENT/VIEWER roles only)
-- Must be run manually on the MySQL instance before deploying.

CREATE TABLE change_req_AccountRequest (
    id           VARCHAR(36)  NOT NULL,
    username     VARCHAR(255) NOT NULL,
    passwordHash VARCHAR(255) NOT NULL,
    name         VARCHAR(255) NOT NULL,
    phone        VARCHAR(20),
    role         VARCHAR(50)  NOT NULL DEFAULT 'CLIENT',
    status       VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    reviewedBy   VARCHAR(36),
    reviewNote   TEXT,
    createdAt    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewedAt   TIMESTAMP    NULL DEFAULT NULL,

    CONSTRAINT pk_accountrequest          PRIMARY KEY (id),
    CONSTRAINT uq_accountrequest_username UNIQUE      (username),
    CONSTRAINT ck_accountrequest_role     CHECK       (role   IN ('CLIENT', 'VIEWER')),
    CONSTRAINT ck_accountrequest_status   CHECK       (status IN ('PENDING', 'APPROVED', 'REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_accountrequest_status    ON change_req_AccountRequest (status);
CREATE INDEX idx_accountrequest_createdat ON change_req_AccountRequest (createdAt DESC);
