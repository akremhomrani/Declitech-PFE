-- V2: Module assignments now carry a specific site (couple module+site)
ALTER TABLE user_modules ADD COLUMN IF NOT EXISTS site_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE user_modules DROP CONSTRAINT IF EXISTS user_modules_pkey;
ALTER TABLE user_modules ADD CONSTRAINT user_modules_pkey PRIMARY KEY (user_id, module_id, site_name);
