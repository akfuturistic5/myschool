BEGIN;

-- Restore teacher.class_id and teacher.subject_id when they were nulled by reseed cleanup.
-- Safety:
-- 1) Only fills NULL fields; never overwrites existing non-null assignments.
-- 2) Derives from live mappings (class_schedules / sections), then falls back to
--    first subject of resolved class if no teacher schedule subject exists.
WITH class_candidates AS (
  -- Strongest signal: scheduled class allocations.
  SELECT
    cs.teacher_id,
    cs.class_id,
    1 AS priority,
    COUNT(*)::int AS hits,
    MAX(COALESCE(cs.academic_year_id, 0))::int AS latest_year
  FROM class_schedules cs
  WHERE cs.teacher_id IS NOT NULL
    AND cs.class_id IS NOT NULL
  GROUP BY cs.teacher_id, cs.class_id

  UNION ALL

  -- Fallback: section teacher allocations (section_teacher_id maps to teachers.staff_id).
  SELECT
    t.id AS teacher_id,
    s.class_id,
    2 AS priority,
    COUNT(*)::int AS hits,
    MAX(COALESCE(c.academic_year_id, 0))::int AS latest_year
  FROM teachers t
  INNER JOIN sections s ON s.section_teacher_id = t.staff_id
  LEFT JOIN classes c ON c.id = s.class_id
  WHERE s.class_id IS NOT NULL
  GROUP BY t.id, s.class_id
),
class_ranked AS (
  SELECT
    teacher_id,
    class_id,
    ROW_NUMBER() OVER (
      PARTITION BY teacher_id
      ORDER BY priority ASC, hits DESC, latest_year DESC, class_id ASC
    ) AS rn
  FROM class_candidates
),
primary_class AS (
  SELECT teacher_id, class_id
  FROM class_ranked
  WHERE rn = 1
),
subject_ranked AS (
  SELECT
    cs.teacher_id,
    cs.subject_id,
    ROW_NUMBER() OVER (
      PARTITION BY cs.teacher_id
      ORDER BY COUNT(*) DESC, MAX(COALESCE(cs.academic_year_id, 0)) DESC, cs.subject_id ASC
    ) AS rn
  FROM class_schedules cs
  INNER JOIN primary_class pc ON pc.teacher_id = cs.teacher_id
  WHERE cs.subject_id IS NOT NULL
    AND (cs.class_id = pc.class_id OR cs.class_id IS NULL)
  GROUP BY cs.teacher_id, cs.subject_id
),
primary_subject AS (
  SELECT teacher_id, subject_id
  FROM subject_ranked
  WHERE rn = 1
),
fallback_subject AS (
  SELECT
    pc.teacher_id,
    sub.id AS subject_id,
    ROW_NUMBER() OVER (
      PARTITION BY pc.teacher_id
      ORDER BY sub.id ASC
    ) AS rn
  FROM primary_class pc
  INNER JOIN subjects sub ON sub.class_id = pc.class_id
),
final_choice AS (
  SELECT
    t.id AS teacher_id,
    COALESCE(t.class_id, pc.class_id) AS class_id_fill,
    COALESCE(t.subject_id, ps.subject_id, fs.subject_id) AS subject_id_fill
  FROM teachers t
  LEFT JOIN primary_class pc ON pc.teacher_id = t.id
  LEFT JOIN primary_subject ps ON ps.teacher_id = t.id
  LEFT JOIN fallback_subject fs ON fs.teacher_id = t.id AND fs.rn = 1
  WHERE t.class_id IS NULL OR t.subject_id IS NULL
)
UPDATE teachers t
SET
  class_id = COALESCE(t.class_id, fc.class_id_fill),
  subject_id = COALESCE(t.subject_id, fc.subject_id_fill),
  updated_at = NOW()
FROM final_choice fc
WHERE t.id = fc.teacher_id
  AND (t.class_id IS NULL OR t.subject_id IS NULL);

COMMIT;
