/**
 * One-time helper to create a default Super Admin user in master_db.super_admin_users.
 *
 * Run with:
 *   cd server
 *   node scripts/create-default-super-admin.js
 */

const bcrypt = require('bcryptjs');
const { masterQuery, closePool } = require('../src/config/database');

async function main() {
  const username = 'superadmin';
  const email = 'superadmin@example.com';
  const password = 'SuperAdmin@123';

  try {
    const hash = await bcrypt.hash(password, 10);
    await masterQuery(
      `
      INSERT INTO super_admin_users (username, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, 'super_admin', true)
      ON CONFLICT (email) DO NOTHING
      `,
      [username, email, hash]
    );
    console.log('✅ Default Super Admin ensured:');
    console.log(`   username: ${username}`);
    console.log(`   email   : ${email}`);
    console.log(`   password: ${password}`);
  } catch (err) {
    console.error('❌ Failed to create default Super Admin:', err);
    process.exitCode = 1;
  } finally {
    try {
      await closePool();
    } catch {
      // ignore
    }
  }
}

main();

