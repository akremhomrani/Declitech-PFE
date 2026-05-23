-- V2: Drop unused instructor_id (always null — IAM JWT provides username/email only)
--     Add soft-delete column (RGPD compliance)
--     Add optimistic locking version column

ALTER TABLE sessions DROP COLUMN IF EXISTS instructor_id;

ALTER TABLE sessions ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE sessions ADD COLUMN version     BIGINT NOT NULL DEFAULT 0;
