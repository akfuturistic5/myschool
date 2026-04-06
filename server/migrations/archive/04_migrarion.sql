-- Teacher documents + timestamp alignment (user DBs may use modified_at instead of updated_at)

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS resume VARCHAR(512);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS joining_letter VARCHAR(512);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ;

-- Backfill modified_at when missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teachers' AND column_name = 'updated_at'
  ) THEN
    UPDATE teachers SET modified_at = COALESCE(modified_at, updated_at) WHERE modified_at IS NULL;
  ELSE
    UPDATE teachers SET modified_at = COALESCE(modified_at, created_at, NOW()) WHERE modified_at IS NULL;
  END IF;
END $$;

ALTER TABLE teachers ALTER COLUMN modified_at SET DEFAULT NOW();


-- ============================================================================ 

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

