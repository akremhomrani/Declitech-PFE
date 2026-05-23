CREATE TABLE IF NOT EXISTS modules (
    module_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_by BIGINT NOT NULL,
    created_by_username VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS module_sites (
    module_id BIGINT NOT NULL REFERENCES modules(module_id) ON DELETE CASCADE,
    site VARCHAR(200) NOT NULL,
    PRIMARY KEY (module_id, site)
);

CREATE INDEX IF NOT EXISTS idx_modules_status ON modules(status);
CREATE INDEX IF NOT EXISTS idx_modules_created_by ON modules(created_by);
