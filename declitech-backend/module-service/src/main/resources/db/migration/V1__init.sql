-- DecliTrack Module Service — Initial Schema
-- V1: modules, module_sites, module_sessions

CREATE TABLE modules (
    id                  BIGSERIAL PRIMARY KEY,
    title               VARCHAR(200) NOT NULL,
    description         TEXT,
    status              VARCHAR(50),
    created_by          BIGINT       NOT NULL,
    created_by_username VARCHAR(255),
    created_by_email    VARCHAR(255),
    created_at          TIMESTAMP    NOT NULL,
    updated_at          TIMESTAMP
);

-- @ElementCollection for Module.sites
CREATE TABLE module_sites (
    module_id BIGINT       NOT NULL REFERENCES modules (id) ON DELETE CASCADE,
    site      VARCHAR(255)
);

CREATE TABLE module_sessions (
    id            BIGSERIAL PRIMARY KEY,
    module_id     BIGINT       NOT NULL REFERENCES modules (id) ON DELETE CASCADE,
    session_id    BIGINT       NOT NULL,
    session_code  VARCHAR(255) NOT NULL,
    session_title VARCHAR(255),
    added_at      TIMESTAMP    NOT NULL
);

CREATE INDEX idx_module_sessions_module_id ON module_sessions (module_id);
