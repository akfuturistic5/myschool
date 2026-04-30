-- Normalized parent/guardian contacts (dedupe by phone digits or email).
-- Run manually against tenant DBs: psql "$DATABASE_URL" -f server/migrations/010_parent_persons.sql

CREATE TABLE IF NOT EXISTS parent_persons (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL DEFAULT '',
  phone VARCHAR(30),
  email VARCHAR(255),
  address TEXT,
  occupation VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Unique non-empty normalized phone (digits only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_persons_phone_digits
  ON parent_persons (regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'))
  WHERE length(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')) > 0;

-- Unique non-empty email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_persons_email_lower
  ON parent_persons (lower(trim(email)))
  WHERE email IS NOT NULL AND length(trim(email)) > 0;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS father_person_id INTEGER REFERENCES parent_persons(id) ON DELETE SET NULL;
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS mother_person_id INTEGER REFERENCES parent_persons(id) ON DELETE SET NULL;
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS guardian_person_id INTEGER REFERENCES parent_persons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_father_person ON students (father_person_id);
CREATE INDEX IF NOT EXISTS idx_students_mother_person ON students (mother_person_id);
CREATE INDEX IF NOT EXISTS idx_students_guardian_person ON students (guardian_person_id);
