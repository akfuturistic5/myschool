-- GR number (General Register) per student. Each tenant DB is one school; uniqueness is per database.
-- Run on every school tenant database, e.g.: psql "$TENANT_DATABASE_URL" -f migrations/add_students_gr_number.sql

ALTER TABLE students ADD COLUMN IF NOT EXISTS gr_number character varying(30);

-- Assign deterministic unique values (GR000001, GR000002, …) to every row, ordered by primary key
UPDATE students AS s
SET gr_number = v.gr
FROM (
  SELECT id, 'GR' || LPAD(ROW_NUMBER() OVER (ORDER BY id)::text, 6, '0') AS gr
  FROM students
) AS v
WHERE s.id = v.id;

-- Safety: should not be needed after the bulk update
UPDATE students
SET gr_number = 'GR' || LPAD(id::text, 6, '0')
WHERE gr_number IS NULL OR TRIM(gr_number) = '';

ALTER TABLE students ALTER COLUMN gr_number SET NOT NULL;

-- Prevent duplicate GR numbers within the same school (same DB)
DROP INDEX IF EXISTS idx_students_gr_number_unique;
CREATE UNIQUE INDEX idx_students_gr_number_unique ON students (gr_number);
