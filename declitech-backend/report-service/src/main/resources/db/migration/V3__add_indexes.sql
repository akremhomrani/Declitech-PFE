-- V3: Add missing indexes on high-frequency query columns

CREATE INDEX IF NOT EXISTS idx_emotion_reports_session_id
    ON emotion_reports(session_id);

CREATE INDEX IF NOT EXISTS idx_emotion_reports_student
    ON emotion_reports(student_login_identity);

CREATE INDEX IF NOT EXISTS idx_track_reports_session_id
    ON track_reports(session_id);

CREATE INDEX IF NOT EXISTS idx_track_reports_student
    ON track_reports(student_identity);
