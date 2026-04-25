-- V2: Fix type mismatches, drop tech-debt columns, migrate 7 emotion columns → JSONB

-- ── session_alerts: sessionId VARCHAR → BIGINT ──────────────────────────────
ALTER TABLE session_alerts
    ALTER COLUMN session_id TYPE BIGINT USING session_id::BIGINT;

-- ── track_reports: sessionId VARCHAR → BIGINT ───────────────────────────────
ALTER TABLE track_reports
    ALTER COLUMN session_id TYPE BIGINT USING session_id::BIGINT;

-- ── emotion_reports: drop legacy/redundant columns ───────────────────────────
ALTER TABLE emotion_reports DROP COLUMN IF EXISTS session_id_legacy;
ALTER TABLE emotion_reports DROP COLUMN IF EXISTS session_code;

-- Drop the V1 unique constraint that referenced session_code
ALTER TABLE emotion_reports
    DROP CONSTRAINT IF EXISTS uq_report_session_student;

-- Fix session_id type + make NOT NULL
ALTER TABLE emotion_reports
    ALTER COLUMN session_id TYPE BIGINT USING session_id::BIGINT;
ALTER TABLE emotion_reports
    ALTER COLUMN session_id SET NOT NULL;

-- ── emotion_reports: migrate 7 flat columns → JSONB ─────────────────────────
ALTER TABLE emotion_reports ADD COLUMN emotion_means JSONB;

UPDATE emotion_reports
SET emotion_means = jsonb_build_object(
    'angry',    COALESCE(angry_mean,    0.0),
    'disgust',  COALESCE(disgust_mean,  0.0),
    'fear',     COALESCE(fear_mean,     0.0),
    'happy',    COALESCE(happy_mean,    0.0),
    'sad',      COALESCE(sad_mean,      0.0),
    'surprise', COALESCE(surprise_mean, 0.0),
    'neutral',  COALESCE(neutral_mean,  0.0)
);

ALTER TABLE emotion_reports DROP COLUMN angry_mean;
ALTER TABLE emotion_reports DROP COLUMN disgust_mean;
ALTER TABLE emotion_reports DROP COLUMN fear_mean;
ALTER TABLE emotion_reports DROP COLUMN happy_mean;
ALTER TABLE emotion_reports DROP COLUMN sad_mean;
ALTER TABLE emotion_reports DROP COLUMN surprise_mean;
ALTER TABLE emotion_reports DROP COLUMN neutral_mean;
