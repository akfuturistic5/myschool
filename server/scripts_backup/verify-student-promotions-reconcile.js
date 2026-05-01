require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = (process.env.DATABASE_URL || '').trim()
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'schooldb',
    });

(async () => {
  const enrollment = await pool.query(`
    WITH latest AS (
      SELECT DISTINCT ON (student_id)
        student_id, to_class_id, to_section_id, to_academic_year_id, id
      FROM student_promotions
      WHERE COALESCE(status, 'promoted') = 'promoted'
      ORDER BY student_id, id DESC
    )
    SELECT COUNT(*)::int AS mismatches
    FROM latest l
    JOIN students s ON s.id = l.student_id
    WHERE (l.to_class_id IS NOT NULL AND s.class_id IS DISTINCT FROM l.to_class_id)
       OR (l.to_section_id IS NOT NULL AND s.section_id IS DISTINCT FROM l.to_section_id)
       OR (l.to_academic_year_id IS NOT NULL AND s.academic_year_id IS DISTINCT FROM l.to_academic_year_id)
  `);

  const classCounts = await pool.query(`
    SELECT COUNT(*)::int AS mismatches
    FROM classes c
    WHERE COALESCE(c.no_of_students, 0) <> (
      SELECT COUNT(*)::int FROM students s WHERE s.class_id = c.id AND s.is_active = true
    )
  `);
  const classMismatchRows = await pool.query(`
    SELECT
      c.id,
      c.class_name,
      COALESCE(c.no_of_students, 0) AS stored_count,
      (
        SELECT COUNT(*)::int
        FROM students s
        WHERE s.class_id = c.id AND s.is_active = true
      ) AS actual_count
    FROM classes c
    WHERE COALESCE(c.no_of_students, 0) <> (
      SELECT COUNT(*)::int FROM students s WHERE s.class_id = c.id AND s.is_active = true
    )
    ORDER BY c.id
  `);

  const sectionCounts = await pool.query(`
    SELECT COUNT(*)::int AS mismatches
    FROM sections sct
    WHERE COALESCE(sct.no_of_students, 0) <> (
      SELECT COUNT(*)::int FROM students s WHERE s.section_id = sct.id AND s.is_active = true
    )
  `);

  console.log({
    studentEnrollmentMismatches: enrollment.rows[0].mismatches,
    classCountMismatches: classCounts.rows[0].mismatches,
    sectionCountMismatches: sectionCounts.rows[0].mismatches,
  });
  if (classMismatchRows.rows.length > 0) {
    console.log('classMismatchesDetail', classMismatchRows.rows);
  }
  await pool.end();
})().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});

