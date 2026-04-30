-- Assign section_teacher_id for every section row where it is currently NULL.
-- Uses active staff linked to the teachers table; distributes round-robin so
-- consecutive sections get different teachers when enough teachers exist.
-- Re-run safe: only updates rows with section_teacher_id IS NULL.

WITH teacher_pool AS (
  SELECT
    t.staff_id::integer AS staff_id,
    ROW_NUMBER() OVER (ORDER BY t.id) AS rn
  FROM teachers t
  INNER JOIN staff s ON s.id = t.staff_id
  WHERE t.staff_id IS NOT NULL
    AND COALESCE(s.is_active, true) = true
),
n_teachers AS (
  SELECT COUNT(*)::int AS c FROM teacher_pool
),
section_needy AS (
  SELECT
    sec.id,
    ROW_NUMBER() OVER (ORDER BY sec.class_id NULLS LAST, sec.section_name, sec.id) AS sn
  FROM sections sec
  WHERE sec.section_teacher_id IS NULL
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
