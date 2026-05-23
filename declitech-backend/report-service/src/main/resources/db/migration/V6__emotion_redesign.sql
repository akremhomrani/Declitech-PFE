ALTER TABLE emotion_reports
    ADD COLUMN IF NOT EXISTS emotion_means        JSONB,
    ADD COLUMN IF NOT EXISTS model_version        VARCHAR(64),
    ADD COLUMN IF NOT EXISTS class_labels         TEXT[],
    ADD COLUMN IF NOT EXISTS baseline_means       JSONB,
    ADD COLUMN IF NOT EXISTS delta_from_baseline  JSONB,
    ADD COLUMN IF NOT EXISTS dominant_frequency   JSONB,
    ADD COLUMN IF NOT EXISTS engagement_score     REAL,
    ADD COLUMN IF NOT EXISTS stability_score      REAL,
    ADD COLUMN IF NOT EXISTS reliability_score    REAL,
    ADD COLUMN IF NOT EXISTS face_coverage_pct    REAL,
    ADD COLUMN IF NOT EXISTS low_confidence_pct   REAL,
    ADD COLUMN IF NOT EXISTS multi_face_pct       REAL,
    ADD COLUMN IF NOT EXISTS off_task_pct         REAL,
    ADD COLUMN IF NOT EXISTS camera_blocked_pct   REAL,
    ADD COLUMN IF NOT EXISTS n_samples_total      INTEGER,
    ADD COLUMN IF NOT EXISTS n_samples_usable     INTEGER,
    ADD COLUMN IF NOT EXISTS narrative_confidence VARCHAR(16);

UPDATE emotion_reports
SET emotion_means = jsonb_strip_nulls(jsonb_build_object(
    'angry',    angry_mean,
    'disgust',  disgust_mean,
    'fear',     fear_mean,
    'happy',    happy_mean,
    'sad',      sad_mean,
    'surprise', surprise_mean,
    'neutral',  neutral_mean
))
WHERE emotion_means IS NULL
  AND (angry_mean IS NOT NULL OR happy_mean IS NOT NULL OR neutral_mean IS NOT NULL);

ALTER TABLE emotion_reports
    DROP COLUMN IF EXISTS angry_mean,
    DROP COLUMN IF EXISTS disgust_mean,
    DROP COLUMN IF EXISTS fear_mean,
    DROP COLUMN IF EXISTS happy_mean,
    DROP COLUMN IF EXISTS sad_mean,
    DROP COLUMN IF EXISTS surprise_mean,
    DROP COLUMN IF EXISTS neutral_mean;

CREATE INDEX IF NOT EXISTS idx_emotion_reports_session_code ON emotion_reports (session_code);
CREATE INDEX IF NOT EXISTS idx_emotion_reports_student      ON emotion_reports (student_login_identity);
CREATE INDEX IF NOT EXISTS idx_emotion_reports_reliability  ON emotion_reports (reliability_score);
