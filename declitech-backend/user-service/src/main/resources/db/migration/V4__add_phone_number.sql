-- V4: Add Tunisian phone number to users (8 local digits, +216 prefix shown in UI).
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
