-- Separate login accounts for father and mother (both use Parent role).
-- Legacy parents.user_id remains for backward compatibility; new rows set it to father or first available.

ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS father_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS mother_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parents_father_user_id ON parents (father_user_id);
CREATE INDEX IF NOT EXISTS idx_parents_mother_user_id ON parents (mother_user_id);

-- Backfill legacy single parents.user_id onto father_user_id so direct FK match keeps working
UPDATE parents
SET father_user_id = user_id
WHERE user_id IS NOT NULL AND father_user_id IS NULL;
