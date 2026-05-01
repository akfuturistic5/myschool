
const { query } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function run() {
  console.log('Applying migration: 048_fix_classes_uniqueness.sql...');
  const sqlPath = path.join(__dirname, '../migrations/048_fix_classes_uniqueness.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  try {
    // split statements if necessary, but simple query often works for ALTERs
    await query(sql);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Failed to apply migration:', err);
    process.exit(1);
  }
}

run();
