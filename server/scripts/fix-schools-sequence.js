/**
 * Align schools.id sequence with current max(id) in master_db.schools.
 *
 * Run with:
 *   cd server
 *   node scripts/fix-schools-sequence.js
 */

const { masterQuery, closePool } = require('../src/config/database');

async function run() {
  try {
    const r = await masterQuery(
      `
      SELECT setval(
        pg_get_serial_sequence('schools', 'id'),
        COALESCE((SELECT MAX(id) FROM schools), 1),
        true
      );
      `
    );
    console.log('✅ schools.id sequence aligned:', r.rows[0]);
  } catch (e) {
    console.error('❌ Failed to fix schools sequence:', e.message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

run();

