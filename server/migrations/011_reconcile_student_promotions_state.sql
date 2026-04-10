-- Reconcile students table from latest promotion history.
-- Safe to rerun.

BEGIN;

-- 1) For each student, take latest promoted target and sync core enrollment fields.
WITH latest_promote AS (
  SELECT DISTINCT ON (sp.student_id)
    sp.student_id,
    sp.to_class_id,
    sp.to_section_id,
    sp.to_academic_year_id
  FROM student_promotions sp
  WHERE sp.student_id IS NOT NULL
    AND COALESCE(sp.status, 'promoted') = 'promoted'
  ORDER BY sp.student_id, sp.id DESC
)
UPDATE students s
SET
  class_id = COALESCE(lp.to_class_id, s.class_id),
  section_id = COALESCE(lp.to_section_id, s.section_id),
  academic_year_id = COALESCE(lp.to_academic_year_id, s.academic_year_id),
  modified_at = NOW()
FROM latest_promote lp
WHERE s.id = lp.student_id
  AND (
    (lp.to_class_id IS NOT NULL AND s.class_id IS DISTINCT FROM lp.to_class_id)
    OR (lp.to_section_id IS NOT NULL AND s.section_id IS DISTINCT FROM lp.to_section_id)
    OR (lp.to_academic_year_id IS NOT NULL AND s.academic_year_id IS DISTINCT FROM lp.to_academic_year_id)
  );

-- 2) Recompute class aggregates (active students only).
WITH counts AS (
  SELECT class_id, COUNT(*)::int AS cnt
  FROM students
  WHERE is_active = true
    AND class_id IS NOT NULL
  GROUP BY class_id
)
UPDATE classes c
SET
  no_of_students = COALESCE(cnts.cnt, 0),
  modified_at = NOW()
FROM (
  SELECT c2.id, counts.cnt
  FROM classes c2
  LEFT JOIN counts ON counts.class_id = c2.id
) cnts
WHERE c.id = cnts.id;

-- 3) Recompute section aggregates (active students only).
WITH counts AS (
  SELECT section_id, COUNT(*)::int AS cnt
  FROM students
  WHERE is_active = true
    AND section_id IS NOT NULL
  GROUP BY section_id
)
UPDATE sections sct
SET
  no_of_students = COALESCE(cnts.cnt, 0),
  modified_at = NOW()
FROM (
  SELECT s2.id, counts.cnt
  FROM sections s2
  LEFT JOIN counts ON counts.section_id = s2.id
) cnts
WHERE sct.id = cnts.id;

COMMIT;
