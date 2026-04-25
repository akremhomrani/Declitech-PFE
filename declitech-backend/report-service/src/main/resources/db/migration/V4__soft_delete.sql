-- V4: Soft delete columns for RGPD compliance
--     Deleted records are filtered by @SQLRestriction on entities, never physically removed

ALTER TABLE emotion_reports ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE track_reports   ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
