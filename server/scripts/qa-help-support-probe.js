/**
 * Probe schools/admins for Help & Support QA (read-only).
 * Run: node scripts/qa-help-support-probe.js
 */
require('dotenv').config();
const { masterQuery, runWithTenant, query, closePool } = require('../src/config/database');

async function main() {
  const schools = await masterQuery(
    `SELECT id, school_name, institute_number, db_name
     FROM schools WHERE deleted_at IS NULL ORDER BY id LIMIT 5`
  );
  console.log('SCHOOLS:', JSON.stringify(schools.rows, null, 2));

  const tickets = await masterQuery(
    `SELECT t.id, t.ticket_number, t.school_id, s.institute_number, t.subject, t.status
     FROM support_tickets t
     JOIN schools s ON s.id = t.school_id
     WHERE t.deleted_at IS NULL
     ORDER BY t.id DESC LIMIT 10`
  );
  console.log('RECENT_TICKETS:', JSON.stringify(tickets.rows, null, 2));

  for (const s of schools.rows.slice(0, 2)) {
    await runWithTenant(s.db_name, async () => {
      const admins = await query(
        `SELECT u.id, u.username, u.email, ur.role_name, u.role_id
         FROM users u
         LEFT JOIN user_roles ur ON ur.id = u.role_id
         WHERE u.role_id IN (1, 6) AND COALESCE(u.is_active, true) = true
         ORDER BY u.role_id, u.id LIMIT 3`
      );
      console.log(`ADMINS_${s.institute_number}:`, JSON.stringify(admins.rows, null, 2));
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closePool().catch(() => {}));
