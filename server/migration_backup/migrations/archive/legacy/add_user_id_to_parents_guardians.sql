-- Add user_id to parents and guardians tables
-- Run: psql -d schooldb -f migrations/add_user_id_to_parents_guardians.sql

-- Parents: add user_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parents' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE parents ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_parents_user_id ON parents(user_id);
  END IF;
END $$;

-- Guardians: add user_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardians' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE guardians ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_guardians_user_id ON guardians(user_id);
  END IF;
END $$;
