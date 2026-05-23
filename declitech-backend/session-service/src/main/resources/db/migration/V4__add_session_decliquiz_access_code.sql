-- V4: Persist the DecliQuiz access code attached to a DecliTrack session.
--     The DecliTrack extension auto-creates a quiz on DecliQuiz 30s after the
--     teacher starts a session, then POSTs the resulting accessCode here so
--     student devices can pick it up and pre-fill the participant join page.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS decliquiz_access_code VARCHAR(16);
