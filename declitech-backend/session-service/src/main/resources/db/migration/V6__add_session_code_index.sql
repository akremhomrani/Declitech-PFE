CREATE INDEX IF NOT EXISTS idx_sessions_instructor_status_expires
    ON sessions (instructor_username, status, expires_at);
