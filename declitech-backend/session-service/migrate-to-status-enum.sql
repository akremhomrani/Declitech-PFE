-- Migration script to add status enum column and remove deprecated columns
-- Execute this script on your PostgreSQL database

-- Step 1: Add the status column
ALTER TABLE sessions ADD COLUMN status VARCHAR(20);

-- Step 2: Migrate existing data from is_active to status
-- ACTIVE: sessions that are currently active (is_active = true)
-- EXPIRED: sessions that are inactive and past their expiry time (is_active = false AND expires_at < now)
-- ENDED: sessions that were manually ended (is_active = false AND expires_at >= now)
UPDATE sessions 
SET status = CASE 
    WHEN is_active = true THEN 'ACTIVE'
    WHEN is_active = false AND expires_at < NOW() THEN 'EXPIRED'
    ELSE 'ENDED'
END;

-- Step 3: Make status column non-nullable (now that all rows have values)
ALTER TABLE sessions ALTER COLUMN status SET NOT NULL;

-- Step 4: Drop the old is_active column
ALTER TABLE sessions DROP COLUMN IF EXISTS is_active;

-- Step 5: Drop the participant_count column (now calculated dynamically)
ALTER TABLE sessions DROP COLUMN IF EXISTS participant_count;

-- Step 6: Drop the report_count column (now calculated dynamically)
ALTER TABLE sessions DROP COLUMN IF EXISTS report_count;

-- Step 7: Drop the description column if exists (mentioned as unused)
ALTER TABLE sessions DROP COLUMN IF EXISTS description;

-- Verify the migration
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sessions' 
ORDER BY ordinal_position;
