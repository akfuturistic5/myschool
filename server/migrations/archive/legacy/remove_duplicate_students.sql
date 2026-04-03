-- =============================================================================
-- REMOVE DUPLICATE STUDENTS
-- Run this manually in your database (psql or pgAdmin) after backing up your data.
-- =============================================================================
-- Duplicates are identified by admission_number. For each group, we keep the
-- row with the smallest id (original) and delete the rest after updating FKs.
-- =============================================================================

-- STEP 1: Find duplicates (run first to verify)
-- -----------------------------------------------------------------------------
SELECT admission_number, COUNT(*) as cnt, array_agg(id ORDER BY id) as student_ids
FROM students
WHERE admission_number IS NOT NULL AND admission_number != ''
GROUP BY admission_number
HAVING COUNT(*) > 1;

-- STEP 2: Preview what will be kept vs deleted
-- -----------------------------------------------------------------------------
WITH dupes AS (
  SELECT id, admission_number,
         ROW_NUMBER() OVER (PARTITION BY admission_number ORDER BY id) as rn
  FROM students
  WHERE admission_number IN (
    SELECT admission_number FROM students
    WHERE admission_number IS NOT NULL AND admission_number != ''
    GROUP BY admission_number HAVING COUNT(*) > 1
  )
)
SELECT id, admission_number,
       CASE WHEN rn = 1 THEN 'KEEP' ELSE 'DELETE' END as action
FROM dupes
ORDER BY admission_number, id;

-- STEP 3: Run in a transaction - update references then delete duplicates
-- -----------------------------------------------------------------------------
BEGIN;

-- Create temp mapping: duplicate_id -> original_id (min id per admission_number)
CREATE TEMP TABLE dup_map AS
SELECT s.id as dup_id, d.keep_id as orig_id
FROM students s
INNER JOIN (
  SELECT admission_number, MIN(id) as keep_id
  FROM students
  WHERE admission_number IS NOT NULL AND admission_number != ''
  GROUP BY admission_number
  HAVING COUNT(*) > 1
) d ON s.admission_number = d.admission_number AND s.id != d.keep_id;

-- Update parents to point to original
UPDATE parents p SET student_id = m.orig_id
FROM dup_map m WHERE p.student_id = m.dup_id;

-- Update guardians to point to original
UPDATE guardians g SET student_id = m.orig_id
FROM dup_map m WHERE g.student_id = m.dup_id;

-- Update fee_collections to point to original (if table exists)
UPDATE fee_collections fc SET student_id = m.orig_id
FROM dup_map m WHERE fc.student_id = m.dup_id;

-- Update leave_applications to point to original (if table exists)
UPDATE leave_applications la SET student_id = m.orig_id
FROM dup_map m WHERE la.student_id = m.dup_id;

-- Update student_attendance if it exists (check your schema)
-- UPDATE student_attendance sa SET student_id = m.orig_id FROM dup_map m WHERE sa.student_id = m.dup_id;

-- Delete duplicate students
DELETE FROM students WHERE id IN (SELECT dup_id FROM dup_map);

-- Verify no duplicates remain
SELECT admission_number, COUNT(*) as cnt FROM students
WHERE admission_number IS NOT NULL AND admission_number != ''
GROUP BY admission_number HAVING COUNT(*) > 1;
-- Should return 0 rows

COMMIT;
-- If any error occurs, run: ROLLBACK;
