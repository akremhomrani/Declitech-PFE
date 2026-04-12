-- DecliTrack Session Service — Initial Schema
-- V1: sessions

CREATE TABLE sessions (
    id                   BIGSERIAL PRIMARY KEY,
    session_code         VARCHAR(50)  NOT NULL UNIQUE,
    title                VARCHAR(200) NOT NULL,
    instructor_id        BIGINT,
    instructor_username  VARCHAR(255),
    instructor_email     VARCHAR(255),
    module_id            BIGINT,
    created_at           TIMESTAMP    NOT NULL,
    expires_at           TIMESTAMP    NOT NULL,
    status               VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE'
);

CREATE INDEX idx_sessions_status      ON sessions (status);
CREATE INDEX idx_sessions_session_code ON sessions (session_code);
