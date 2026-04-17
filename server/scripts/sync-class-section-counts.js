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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const classRes = await client.query(`
      UPDATE classes c
      SET
        no_of_students = COALESCE(sub.cnt, 0),
        modified_at = NOW()
      FROM (
        SELECT c2.id, COUNT(s.id)::int AS cnt
        FROM classes c2
        LEFT JOIN students s
          ON s.class_id = c2.id
         AND s.is_active = true
        GROUP BY c2.id
      ) sub
      WHERE c.id = sub.id
      RETURNING c.id
    `);
    const secRes = await client.query(`
      UPDATE sections sct
      SET
        no_of_students = COALESCE(sub.cnt, 0),
        modified_at = NOW()
      FROM (
        SELECT s2.id, COUNT(st.id)::int AS cnt
        FROM sections s2
        LEFT JOIN students st
          ON st.section_id = s2.id
         AND st.is_active = true
        GROUP BY s2.id
      ) sub
      WHERE sct.id = sub.id
      RETURNING sct.id
    `);
    await client.query('COMMIT');
    console.log({
      classesUpdated: classRes.rowCount,
      sectionsUpdated: secRes.rowCount,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

