/**
 * Backfills legacy rows in `drivers` (staff_id IS NULL) into `staff` + `users`
 * and sets `drivers.staff_id` so they appear in HRM staff lists.
 *
 * Prerequisites:
 * - run migrations/012_driver_designation_and_drivers_staff_id.sql
 * - run migrations/013_user_role_driver.sql
 *
 * Password policy: same as createStaff — initial password is derived from phone digits
 * when no env override (see createAdministrativeStaffUser).
 *
 * Usage:
 *   node server/scripts/run-backfill-drivers-to-staff.js
 *
 * Idempotent: skips drivers that already have staff_id or rows that conflict on email/employee_code.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { query, executeTransaction } = require('../src/config/database');
const { createAdministrativeStaffUser, isUserEmailTaken } = require('../src/utils/createPersonUser');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseName(driverName) {
  const s = String(driverName || '').trim();
  if (!s) return { first_name: 'Driver', last_name: 'Staff' };
  const i = s.indexOf(' ');
  if (i === -1) return { first_name: s.slice(0, 50), last_name: 'Staff' };
  const fn = s.slice(0, i).trim().slice(0, 50);
  const ln = s.slice(i + 1).trim().slice(0, 50) || 'Staff';
  return { first_name: fn, last_name: ln };
}

function normalizePhone(phone) {
  return String(phone || '')
    .replace(/\D/g, '')
    .slice(0, 15);
}

async function resolveMeta(client) {
  const des = await client.query(
    `SELECT id FROM designations
     WHERE LOWER(TRIM(designation_name)) IN ('driver', 'drivers') AND (is_active IS NOT FALSE OR is_active IS NULL)
     ORDER BY id ASC LIMIT 1`
  );
  const dept = await client.query(
    `SELECT id FROM departments
     WHERE LOWER(TRIM(department_name)) = 'support staff' LIMIT 1`
  );
  const role = await client.query(
    `SELECT id FROM user_roles
     WHERE LOWER(TRIM(role_name)) = 'driver'
     LIMIT 1`
  );
  return {
    designationId: des.rows[0]?.id ?? null,
    departmentId: dept.rows[0]?.id ?? null,
    driverRoleId: role.rows[0]?.id ?? null,
  };
}

async function pickEmail(client, driver) {
  const raw = String(driver.email || '').trim();
  if (raw && EMAIL_RE.test(raw) && raw.length <= 100) {
    const taken = await isUserEmailTaken(client, raw);
    const staffDup = await client.query(
      `SELECT 1 FROM staff WHERE email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1`,
      [raw]
    );
    if (!taken && staffDup.rows.length === 0) return raw;
  }
  const synthetic = `legacy.driver.${driver.id}@noreply.local`.slice(0, 100);
  if (!(await isUserEmailTaken(client, synthetic))) return synthetic;
  return `legacy.driver.${driver.id}.${Date.now()}@noreply.local`.slice(0, 100);
}

async function pickEmployeeCode(client, driver) {
  const raw = String(driver.employee_code || '').trim().slice(0, 20);
  if (raw) {
    const dup = await client.query('SELECT 1 FROM staff WHERE employee_code = $1 LIMIT 1', [raw]);
    if (dup.rows.length === 0) return raw;
  }
  return `DRV${driver.id}`.slice(0, 20);
}

async function backfillOne(client, driver, meta) {
  if (!meta.designationId || !meta.departmentId) {
    throw new Error('Driver designation or Support Staff department missing — run migration 012 first.');
  }
  if (!meta.driverRoleId) {
    throw new Error('Driver role missing in user_roles — run migration 013 first.');
  }
  if (driver.staff_id != null) return { status: 'skip', reason: 'already_linked' };

  const phoneDigits = normalizePhone(driver.phone);
  if (phoneDigits.length < 7) {
    return { status: 'skip', reason: 'phone_too_short', id: driver.id };
  }
  const phone = String(driver.phone || '').trim().slice(0, 15);

  const { first_name, last_name } = parseName(driver.driver_name);
  const email = await pickEmail(client, driver);
  const employeeCode = await pickEmployeeCode(client, driver);

  const taken = await isUserEmailTaken(client, email);
  if (taken) {
    return { status: 'skip', reason: 'email_unresolved', id: driver.id, email };
  }

  const staffIns = await client.query(
    `INSERT INTO staff (
      user_id, employee_code, first_name, last_name, gender, date_of_birth, blood_group_id,
      phone, email, address, emergency_contact_name, emergency_contact_phone,
      designation_id, department_id, joining_date, salary, qualification, experience_years,
      photo_url, is_active, created_by, created_at, modified_at
    ) VALUES (
      NULL, $1, $2, $3, NULL, NULL, NULL, $4, $5, $6, NULL, NULL, $7, $8, $9, $10, NULL, NULL,
      NULL, $11, NULL, NOW(), NOW()
    ) RETURNING id`,
    [
      employeeCode,
      first_name,
      last_name,
      phone,
      email,
      driver.address || null,
      meta.designationId,
      meta.departmentId,
      driver.joining_date || null,
      driver.salary != null ? driver.salary : null,
      driver.is_active !== false,
    ]
  );
  const staffId = staffIns.rows[0].id;

  const userId = await createAdministrativeStaffUser(client, {
    email,
    phone,
    first_name,
    last_name,
    password: undefined,
  });
  if (!userId) {
    await client.query('DELETE FROM staff WHERE id = $1', [staffId]);
    return { status: 'error', reason: 'user_create_failed', id: driver.id };
  }

  await client.query(`UPDATE staff SET user_id = $1, modified_at = NOW() WHERE id = $2`, [userId, staffId]);
  await client.query(`UPDATE users SET role_id = $1, modified_at = NOW() WHERE id = $2`, [meta.driverRoleId, userId]);
  await client.query(`UPDATE drivers SET staff_id = $1, modified_at = NOW() WHERE id = $2`, [staffId, driver.id]);

  return { status: 'ok', driverId: driver.id, staffId };
}

async function main() {
  const list = await query(
    `SELECT * FROM drivers WHERE staff_id IS NULL ORDER BY id ASC`
  );
  const rows = list.rows || [];
  console.log(`Found ${rows.length} driver row(s) without staff_id.`);

  let ok = 0;
  let skipped = 0;
  let errors = 0;

  for (const driver of rows) {
    try {
      const r = await executeTransaction(async (client) => {
        const meta = await resolveMeta(client);
        return backfillOne(client, driver, meta);
      });
      if (r.status === 'ok') {
        ok += 1;
        console.log(`OK: driver id=${r.driverId} → staff id=${r.staffId}`);
      } else if (r.status === 'skip') {
        skipped += 1;
        console.warn(`Skip: driver id=${driver.id} (${r.reason})`);
      } else {
        errors += 1;
        console.error(`Error: driver id=${driver.id}`, r);
      }
    } catch (e) {
      errors += 1;
      console.error(`Failed driver id=${driver.id}:`, e.message || e);
    }
  }

  console.log(`Done. Linked: ${ok}, skipped: ${skipped}, errors: ${errors}.`);
  if (errors > 0) process.exitCode = 1;
}

main();
