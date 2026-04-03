const { masterQuery, closePool } = require('../src/config/database');

async function run() {
  try {
    const res = await masterQuery(
      `
      INSERT INTO schools (school_name, institute_number, db_name, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING id, school_name, institute_number, db_name, status, created_at
      `,
      ['Test School', '9999', 'school_9999']
    );
    console.log('Insert succeeded:', res.rows);
  } catch (e) {
    console.error('Insert error:', e.message);
  } finally {
    await closePool();
  }
}

run();

