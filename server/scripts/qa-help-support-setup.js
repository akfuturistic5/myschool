/**
 * DEV/QA ONLY: Set known passwords for Help & Support manual QA accounts.
 * Requires: NODE_ENV !== 'production' AND HELP_SUPPORT_QA_RESET=1
 *
 *   set HELP_SUPPORT_QA_RESET=1 && node scripts/qa-help-support-setup.js
 *
 * Passwords are written to qa-help-support-creds.json (gitignored) for the API harness.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { masterQuery, runWithTenant, query, closePool } = require('../src/config/database');

const QA_PASSWORD = 'HelpSupportQa!2026';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset QA passwords in production');
  }
  if (String(process.env.HELP_SUPPORT_QA_RESET || '') !== '1') {
    throw new Error('Set HELP_SUPPORT_QA_RESET=1 to run this script');
  }

  const hash = await bcrypt.hash(QA_PASSWORD, 10);

  const creds = {
    qaPasswordNote: 'Local QA only — rotate after testing',
    schoolA: { institute: '1111', username: 'admin.st.xaviers', password: QA_PASSWORD },
    schoolB: { institute: '112211', username: 'hm_2222', password: QA_PASSWORD },
    schoolAAdmin: { institute: '1111', username: 'dmy_staff_01', password: QA_PASSWORD },
    superAdmin: { email: 'admin@eschool.com', username: 'superadmin', password: 'SuperAdmin@123' },
  };

  await runWithTenant('sxis_school_db', async () => {
    await query('UPDATE users SET password_hash = $1 WHERE username = ANY($2::text[])', [
      hash,
      ['admin.st.xaviers', 'dmy_staff_01'],
    ]);
    const t = await query(
      `SELECT username FROM users WHERE role_id = 2 AND is_active = true ORDER BY id LIMIT 1`
    );
    if (t.rows[0]?.username) {
      await query('UPDATE users SET password_hash = $1 WHERE username = $2', [hash, t.rows[0].username]);
      creds.schoolA.teacherUsername = t.rows[0].username;
      creds.schoolA.teacherPassword = QA_PASSWORD;
    }
  });

  await runWithTenant('eschool_db', async () => {
    await query('UPDATE users SET password_hash = $1 WHERE username = $2', [hash, 'hm_2222']);
  });

  const saHash = await bcrypt.hash('SuperAdmin@123', 10);
  await masterQuery(
    `UPDATE super_admin_users SET password_hash = $1 WHERE email = $2 OR username = $3`,
    [saHash, 'admin@eschool.com', 'superadmin']
  );

  const outPath = path.join(__dirname, 'qa-help-support-creds.json');
  fs.writeFileSync(outPath, JSON.stringify(creds, null, 2));
  console.log('QA credentials file written:', outPath);
  console.log('School accounts password:', QA_PASSWORD);
  console.log('Super Admin password: SuperAdmin@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closePool().catch(() => {}));
