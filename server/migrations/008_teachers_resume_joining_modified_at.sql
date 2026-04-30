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
