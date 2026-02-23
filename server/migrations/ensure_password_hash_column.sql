-- Ensure password_hash column exists for bcrypt storage
-- Run once before deploying security update
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Optional: Populate password_hash for existing users (phone = password)
-- Run node scripts/run-hash-phone.js after this migration
-- Or users will be migrated on first successful login (lazy migration)
