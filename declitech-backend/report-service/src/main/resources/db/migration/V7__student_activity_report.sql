CREATE TABLE IF NOT EXISTS student_activity_report (
    id                     BIGSERIAL PRIMARY KEY,
    session_code           VARCHAR(255),
    student_login_identity VARCHAR(255),
    activities_count       INTEGER     NOT NULL DEFAULT 0,
    total_executions       INTEGER     NOT NULL DEFAULT 0,
    total_errors           INTEGER     NOT NULL DEFAULT 0,
    difficulty             VARCHAR(255),
    worked_well            BOOLEAN     NOT NULL DEFAULT FALSE,
    summary                TEXT,
    details                TEXT,
    generated_at           TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_activity_report_session_student
    ON student_activity_report (session_code, student_login_identity, generated_at DESC);
