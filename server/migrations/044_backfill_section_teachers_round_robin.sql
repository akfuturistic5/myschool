-- =============================================================================
-- Migration: 027_backfill_section_teachers_round_robin.sql
-- Purpose:
--   Set sections.section_teacher_id (section teacher) only where it is NULL.
--   Uses existing teachers -> staff_id only (no new users/staff).
--   Round-robin across distinct active staff rows so load spreads across teachers.
--
-- Scope:
--   Active sections on active classes only.
--   Re-run safe: only NULL section_teacher_id rows are updated.
-- =============================================================================

BEGIN;

WITH teacher_pool AS (
  SELECT
    x.staff_id,
    ROW_NUMBER() OVER (ORDER BY x.min_teacher_id) AS rn
  FROM (
    SELECT
      t.staff_id::integer AS staff_id,
      MIN(t.id) AS min_teacher_id
    FROM teachers t
    INNER JOIN staff s ON s.id = t.staff_id
    WHERE t.staff_id IS NOT NULL
      AND COALESCE(s.is_active, true) = true
    GROUP BY t.staff_id
  ) x
),
n_teachers AS (
  SELECT COUNT(*)::int AS c FROM teacher_pool
),
section_needy AS (
  SELECT
    sec.id,
    ROW_NUMBER() OVER (ORDER BY sec.class_id NULLS LAST, sec.section_name, sec.id) AS sn
  FROM sections sec
  INNER JOIN classes c ON c.id = sec.class_id
  WHERE sec.section_teacher_id IS NULL
    AND COALESCE(sec.is_active, true) = true
    AND COALESCE(c.is_active, true) = true
),
mapping AS (
  SELECT
    s.id AS section_id,
    tp.staff_id
  FROM section_needy s
  CROSS JOIN n_teachers nt
  INNER JOIN teacher_pool tp
    ON nt.c > 0
   AND tp.rn = ((s.sn - 1) % nt.c) + 1
)
UPDATE sections sec
SET
  section_teacher_id = m.staff_id,
  modified_at = NOW()
FROM mapping m
WHERE sec.id = m.section_id;

COMMIT;
