const { query } = require('../src/config/database');

async function run() {
  const summarySql = `
    WITH parent_users AS (
      SELECT id
      FROM users
      WHERE role_id = 4 AND COALESCE(is_active, true) = true
    ),
    parent_links AS (
      SELECT pu.id AS parent_user_id, p.student_id
      FROM parent_users pu
      LEFT JOIN parents p
        ON (p.user_id = pu.id OR p.father_user_id = pu.id OR p.mother_user_id = pu.id)
    ),
    parent_students AS (
      SELECT
        pl.parent_user_id,
        s.id AS student_id,
        s.user_id,
        s.admission_number,
        s.roll_number,
        s.class_id,
        s.section_id,
        (SELECT COUNT(*)::int FROM exam_results er WHERE er.student_id = s.id) AS result_rows,
        (SELECT COUNT(*)::int FROM exam_subjects es WHERE es.class_id = s.class_id AND es.section_id = s.section_id) AS timetable_rows
      FROM parent_links pl
      LEFT JOIN students s ON s.id = pl.student_id
    ),
    by_roll AS (
      SELECT
        ps.*,
        (SELECT MAX(s2.id) FROM students s2 WHERE s2.roll_number = ps.roll_number) AS latest_roll_student_id
      FROM parent_students ps
    )
    SELECT
      COUNT(DISTINCT parent_user_id)::int AS parent_count,
      COUNT(*) FILTER (WHERE student_id IS NULL)::int AS missing_student_link,
      COUNT(*) FILTER (WHERE student_id IS NOT NULL AND timetable_rows = 0)::int AS no_timetable_on_linked,
      COUNT(*) FILTER (WHERE student_id IS NOT NULL AND result_rows = 0)::int AS no_results_on_linked,
      COUNT(*) FILTER (WHERE latest_roll_student_id IS NOT NULL AND latest_roll_student_id <> student_id)::int AS linked_not_latest_roll
    FROM by_roll
  `;

  const sampleSql = `
    WITH parent_users AS (
      SELECT id
      FROM users
      WHERE role_id = 4 AND COALESCE(is_active, true) = true
    ),
    parent_links AS (
      SELECT pu.id AS parent_user_id, p.student_id
      FROM parent_users pu
      LEFT JOIN parents p
        ON (p.user_id = pu.id OR p.father_user_id = pu.id OR p.mother_user_id = pu.id)
    ),
    parent_students AS (
      SELECT
        pl.parent_user_id,
        s.id AS student_id,
        s.user_id,
        s.admission_number,
        s.roll_number,
        s.class_id,
        s.section_id,
        (SELECT COUNT(*)::int FROM exam_results er WHERE er.student_id = s.id) AS result_rows,
        (SELECT COUNT(*)::int FROM exam_subjects es WHERE es.class_id = s.class_id AND es.section_id = s.section_id) AS timetable_rows
      FROM parent_links pl
      LEFT JOIN students s ON s.id = pl.student_id
    ),
    by_roll AS (
      SELECT
        ps.*,
        (SELECT MAX(s2.id) FROM students s2 WHERE s2.roll_number = ps.roll_number) AS latest_roll_student_id
      FROM parent_students ps
    )
    SELECT *
    FROM by_roll
    WHERE student_id IS NOT NULL
      AND latest_roll_student_id IS NOT NULL
      AND latest_roll_student_id <> student_id
    ORDER BY parent_user_id
    LIMIT 20
  `;

  const summary = await query(summarySql);
  const sample = await query(sampleSql);
  console.log('parent audit summary', summary.rows[0]);
  console.log('sample linked-not-latest-roll rows', sample.rows);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
