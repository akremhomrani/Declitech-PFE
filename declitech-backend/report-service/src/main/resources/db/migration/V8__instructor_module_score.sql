CREATE TABLE instructor_module_score (
    id                  BIGSERIAL PRIMARY KEY,
    instructor_username VARCHAR(100) NOT NULL,
    module_id           BIGINT       NOT NULL,
    module_name         VARCHAR(255),
    site_name           VARCHAR(255),
    score               REAL         NOT NULL,
    confidence          REAL         NOT NULL,
    sample_size         INTEGER      NOT NULL,
    sessions_count      INTEGER      NOT NULL,
    worked_well_rate    REAL,
    avg_engagement      REAL,
    avg_errors          REAL,
    difficulty_factor   REAL,
    computed_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_instructor_module_site UNIQUE (instructor_username, module_id, site_name)
);

CREATE INDEX idx_ims_module     ON instructor_module_score (module_id);
CREATE INDEX idx_ims_instructor ON instructor_module_score (instructor_username);
CREATE INDEX idx_ims_module_score ON instructor_module_score (module_id, score DESC);
