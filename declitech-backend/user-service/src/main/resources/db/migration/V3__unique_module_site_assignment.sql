-- V3: Each (module_id, site_name) pair can be owned by only one user at a time.
ALTER TABLE user_modules
    ADD CONSTRAINT user_modules_module_site_unique UNIQUE (module_id, site_name);
