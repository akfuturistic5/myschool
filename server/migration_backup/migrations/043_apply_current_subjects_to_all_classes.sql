-- =============================================================================
-- Migration: 026_apply_current_subjects_to_all_classes.sql
-- Purpose:
--   Apply current active subject catalog to every active class.
--   This makes all subjects available across all classes (and therefore all sections
--   of those classes in existing app flow).
--
-- Notes:
--   - Uses first 8 active subjects (by id) as source catalog.
--     This preserves the "currently 8 subjects" expectation.
--   - Idempotent: won't duplicate same subject_name for same class.
--   - Only subject module touched.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_source_count INTEGER;
BEGIN
  CREATE TEMP TABLE tmp_subject_source AS
  SELECT
    s.id AS source_subject_id,
    s.subject_name,
    s.subject_code,
    COALESCE(s.theory_hours, 0) AS theory_hours,
    COALESCE(s.practical_hours, 0) AS practical_hours,
    COALESCE(s.total_marks, 100) AS total_marks,
    COALESCE(s.passing_marks, 35) AS passing_marks,
    s.description,
    COALESCE(s.is_active, true) AS is_active
  FROM subjects s
  WHERE COALESCE(s.is_active, true) = true
  ORDER BY s.id
  LIMIT 8;

  SELECT COUNT(*) INTO v_source_count FROM tmp_subject_source;

  -- Fallback when no active subject rows exist.
  IF v_source_count = 0 THEN
    INSERT INTO tmp_subject_source (
      source_subject_id, subject_name, subject_code, theory_hours, practical_hours,
      total_marks, passing_marks, description, is_active
    )
    SELECT
      s.id,
      s.subject_name,
      s.subject_code,
      COALESCE(s.theory_hours, 0),
      COALESCE(s.practical_hours, 0),
      COALESCE(s.total_marks, 100),
      COALESCE(s.passing_marks, 35),
      s.description,
      COALESCE(s.is_active, true)
    FROM subjects s
    WHERE COALESCE(s.is_active, true) = true
    ORDER BY s.id;
  END IF;

  INSERT INTO subjects (
    subject_name,
    subject_code,
    class_id,
    teacher_id,
    theory_hours,
    practical_hours,
    total_marks,
    passing_marks,
    description,
    is_active
  )
  SELECT
    z.subject_name,
    z.gen_subject_code,
    z.class_id,
    NULL::integer AS teacher_id,
    z.theory_hours,
    z.practical_hours,
    z.total_marks,
    z.passing_marks,
    z.description,
    z.is_active
  FROM (
    SELECT
      src.subject_name,
      -- Unique, <=10 chars, deterministic per source subject + class.
      CASE
        WHEN src.subject_code IS NULL OR trim(src.subject_code) = '' THEN
          ('S' || LPAD(src.source_subject_id::text, 3, '0') || LPAD(c.id::text, 6, '0'))
        ELSE
          (LEFT(src.subject_code, 4) || LPAD(src.source_subject_id::text, 2, '0') || LPAD(c.id::text, 4, '0'))
      END AS gen_subject_code,
      c.id AS class_id,
      src.theory_hours,
      src.practical_hours,
      src.total_marks,
      src.passing_marks,
      src.description,
      src.is_active
    FROM classes c
    CROSS JOIN tmp_subject_source src
    WHERE COALESCE(c.is_active, true) = true
  ) z
  WHERE NOT EXISTS (
    SELECT 1
    FROM subjects s
    WHERE s.subject_code = z.gen_subject_code
  );
END $$;

COMMIT;
