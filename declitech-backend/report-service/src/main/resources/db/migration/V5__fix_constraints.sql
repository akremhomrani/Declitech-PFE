-- V5: Fix uniqueness constraints

-- ── TrackReport: unique per session + student + exercise ─────────────────────
-- Deduplicate first (keep the latest row by id)
DELETE FROM track_reports t1
USING track_reports t2
WHERE t1.id < t2.id
  AND t1.session_id       IS NOT DISTINCT FROM t2.session_id
  AND t1.student_identity IS NOT DISTINCT FROM t2.student_identity
  AND t1.exercise_name    IS NOT DISTINCT FROM t2.exercise_name;

ALTER TABLE track_reports
    ADD CONSTRAINT uq_track_session_student_exercise
    UNIQUE (session_id, student_identity, exercise_name);

-- ── EmotionReport: partial unique — one COMPLETED report per student per session
CREATE UNIQUE INDEX IF NOT EXISTS uq_emotion_report_completed
    ON emotion_reports(session_id, student_login_identity)
    WHERE status = 'COMPLETED';
