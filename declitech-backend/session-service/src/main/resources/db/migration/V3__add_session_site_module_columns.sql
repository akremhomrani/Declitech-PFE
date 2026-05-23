-- V3: Embed site/module context into sessions
--     Source = JWT claims `siteModules` (INSTRUCTEUR/FREELANCE) and `site` (COLLABORATEUR)
--     introduced by IAM v6 (cf. INTEGRATION_SSO §Claims siteModules / site, 2026-05-04).
--     Avoids re-resolving site/module names at read time and lets us keep historical
--     context if the IAM affectation changes later.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS site_id          BIGINT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS site_name        VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS module_name      VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS module_code      VARCHAR(50);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS instructor_site  VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_sessions_site_id   ON sessions (site_id);
CREATE INDEX IF NOT EXISTS idx_sessions_module_id ON sessions (module_id);
