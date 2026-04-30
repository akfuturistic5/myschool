-- 009_guardian_registry_hardening.sql
-- Purpose:
-- 1) Backfill and normalize guardians.user_id using existing users by email/phone.
-- 2) Remove duplicate guardian rows for same student contact key.
-- 3) Keep students.guardian_id aligned to surviving guardian rows.
-- 4) Enforce DB-level uniqueness for (student_id,email) and (student_id,phone).
-- 5) Enforce at most one primary guardian per student.

BEGIN;

-- 1) Backfill user links by exact contact match (prefer email, then guardian phone).
UPDATE guardians g
SET user_id = u.id,
    modified_at = NOW()
FROM users u
WHERE g.user_id IS NULL
  AND u.id IS NOT NULL
  AND COALESCE(LOWER(TRIM(g.email)), '') <> ''
  AND COALESCE(LOWER(TRIM(u.email)), '') = LOWER(TRIM(g.email));

UPDATE guardians g
SET user_id = u.id,
    modified_at = NOW()
FROM users u
WHERE g.user_id IS NULL
  AND u.id IS NOT NULL
  AND u.role_id = 5
  AND COALESCE(TRIM(g.phone), '') <> ''
  AND COALESCE(TRIM(u.phone), '') = TRIM(g.phone);

-- 2) Normalize same-email guardians to same user_id where possible.
WITH canonical AS (
  SELECT LOWER(TRIM(email)) AS email_key, MIN(user_id) AS canonical_user_id
  FROM guardians
  WHERE COALESCE(LOWER(TRIM(email)), '') <> ''
    AND user_id IS NOT NULL
  GROUP BY LOWER(TRIM(email))
)
UPDATE guardians g
SET user_id = c.canonical_user_id,
    modified_at = NOW()
FROM canonical c
WHERE COALESCE(LOWER(TRIM(g.email)), '') = c.email_key
  AND (g.user_id IS NULL OR g.user_id <> c.canonical_user_id);

-- 3) Dedupe same student + email guardians (keep most relevant row).
DROP TABLE IF EXISTS _tmp_guardian_dedupe_email;
CREATE TEMP TABLE _tmp_guardian_dedupe_email AS
WITH ranked AS (
  SELECT
    g.id,
    g.student_id,
    LOWER(TRIM(g.email)) AS email_key,
    FIRST_VALUE(g.id) OVER (
      PARTITION BY g.student_id, LOWER(TRIM(g.email))
      ORDER BY g.is_primary_contact DESC, g.modified_at DESC NULLS LAST, g.id DESC
    ) AS keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY g.student_id, LOWER(TRIM(g.email))
      ORDER BY g.is_primary_contact DESC, g.modified_at DESC NULLS LAST, g.id DESC
    ) AS rn
  FROM guardians g
  WHERE COALESCE(LOWER(TRIM(g.email)), '') <> ''
)
SELECT id, student_id, keep_id
FROM ranked
WHERE rn > 1;

UPDATE students s
SET guardian_id = d.keep_id
FROM _tmp_guardian_dedupe_email d
WHERE s.guardian_id = d.id;

DELETE FROM guardians g
USING _tmp_guardian_dedupe_email d
WHERE g.id = d.id;

-- 4) Dedupe same student + phone guardians.
DROP TABLE IF EXISTS _tmp_guardian_dedupe_phone;
CREATE TEMP TABLE _tmp_guardian_dedupe_phone AS
WITH ranked AS (
  SELECT
    g.id,
    g.student_id,
    TRIM(g.phone) AS phone_key,
    FIRST_VALUE(g.id) OVER (
      PARTITION BY g.student_id, TRIM(g.phone)
      ORDER BY g.is_primary_contact DESC, g.modified_at DESC NULLS LAST, g.id DESC
    ) AS keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY g.student_id, TRIM(g.phone)
      ORDER BY g.is_primary_contact DESC, g.modified_at DESC NULLS LAST, g.id DESC
    ) AS rn
  FROM guardians g
  WHERE COALESCE(TRIM(g.phone), '') <> ''
)
SELECT id, student_id, keep_id
FROM ranked
WHERE rn > 1;

UPDATE students s
SET guardian_id = d.keep_id
FROM _tmp_guardian_dedupe_phone d
WHERE s.guardian_id = d.id;

DELETE FROM guardians g
USING _tmp_guardian_dedupe_phone d
WHERE g.id = d.id;

-- 5) Ensure one primary guardian per student:
--    a) mark students.guardian_id row as primary where available
UPDATE guardians g
SET is_primary_contact = true,
    modified_at = NOW()
FROM students s
WHERE s.guardian_id = g.id
  AND COALESCE(g.is_primary_contact, false) = false;

--    b) if still none primary for a student, choose deterministic latest row
WITH per_student AS (
  SELECT
    student_id,
    id,
    ROW_NUMBER() OVER (
      PARTITION BY student_id
      ORDER BY is_primary_contact DESC, modified_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM guardians
)
UPDATE guardians g
SET is_primary_contact = (ps.rn = 1),
    modified_at = NOW()
FROM per_student ps
WHERE g.id = ps.id;

-- 6) DB-level integrity constraints via unique indexes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_guardians_student_email
  ON guardians (student_id, LOWER(TRIM(email)))
  WHERE COALESCE(LOWER(TRIM(email)), '') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_guardians_student_phone
  ON guardians (student_id, TRIM(phone))
  WHERE COALESCE(TRIM(phone), '') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_guardians_one_primary_per_student
  ON guardians (student_id)
  WHERE is_primary_contact = true;

COMMIT;

