-- =============================================================================
-- Migration: 030_remove_dummy_seed_subjects.sql
-- Purpose:
--   Remove only dummy seeded subjects created by 005/006 migrations.
--   Real/existing school subjects stay untouched.
--
-- Dummy subject code pattern:
--   D<academicYearId>C<classNo><shortCode>
--   Examples: D1C1ENG, D3C2MTH, D2C3CSC
-- =============================================================================

BEGIN;

DO $$
BEGIN
  CREATE TEMP TABLE tmp_dummy_subject_ids AS
  SELECT id
  FROM subjects
  WHERE subject_code ~ '^D[0-9]+C[123](ENG|MTH|EVS|CSC|GK)$';

  -- Null references in known dependent tables before deleting subjects.
  -- All these columns are nullable in current schema.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teachers' AND column_name = 'subject_id'
  ) THEN
    UPDATE teachers
    SET subject_id = NULL
    WHERE subject_id IN (SELECT id FROM tmp_dummy_subject_ids);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'class_schedules' AND column_name = 'subject_id'
  ) THEN
    UPDATE class_schedules
    SET subject_id = NULL
    WHERE subject_id IN (SELECT id FROM tmp_dummy_subject_ids);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exam_results' AND column_name = 'subject_id'
  ) THEN
    UPDATE exam_results
    SET subject_id = NULL
    WHERE subject_id IN (SELECT id FROM tmp_dummy_subject_ids);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'exam_subjects' AND column_name = 'subject_id'
  ) THEN
    DELETE FROM exam_subjects
    WHERE subject_id IN (SELECT id FROM tmp_dummy_subject_ids);
  END IF;

  DELETE FROM subjects
  WHERE id IN (SELECT id FROM tmp_dummy_subject_ids);
END $$;

COMMIT;
