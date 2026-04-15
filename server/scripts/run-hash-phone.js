/**
 * Populate password_hash for existing users (phone = password)
 * Run manually: node scripts/run-hash-phone.js
 */
require('dotenv').config();
const { query } = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function updateHashPasswords() {
  const res = await query('SELECT id, phone FROM users WHERE phone IS NOT NULL AND phone != \'\'');
  let updated = 0;
  for (const row of res.rows) {
    const phone = (row.phone || '').toString().trim();
    if (!phone) continue;
    const hash = bcrypt.hashSync(phone, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, row.id]);
    updated++;
    console.log('Updated user id:', row.id, 'phone:', row.phone);
  }
  console.log('Done. Updated', updated, 'users.');
}

updateHashPasswords()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
