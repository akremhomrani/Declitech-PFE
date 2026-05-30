ALTER TABLE users
    ADD CONSTRAINT ck_users_phone_format
    CHECK (phone_number IS NULL OR phone_number ~ '^[0-9]{8}$');
