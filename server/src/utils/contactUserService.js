/**
 * Contact data lives on users (parent/guardian roles). Replaces parent_persons + parents denormalized rows.
 */
const { ROLES } = require('../config/roles');
const {
  createParentIndividualUser,
  createGuardianUser,
} = require('./createPersonUser');

function normDigits(phone) {
  return String(phone ?? '').replace(/\D/g, '');
}

/**
 * Row shape compatible with former parent_person / form autofill.
 */
async function getContactUserById(client, userId) {
  const r = await client.query(
    `SELECT id, first_name, last_name, email, phone, occupation, current_address, role_id
     FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  if (r.rows.length === 0) return null;
  const u = r.rows[0];
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return {
    id: u.id,
    full_name: full || u.first_name || u.last_name || '',
    phone: u.phone,
    email: u.email,
    occupation: u.occupation,
    address: u.current_address,
    role_id: u.role_id,
  };
}

async function findUserIdByPhoneOrEmail(client, roleId, phone, email) {
  const em = String(email ?? '').trim().toLowerCase();
  const digits = normDigits(phone);
  if (em) {
    const r = await client.query(
      `SELECT id FROM users
       WHERE role_id = $1
         AND email IS NOT NULL
         AND LOWER(TRIM(email)) = $2
       LIMIT 1`,
      [roleId, em]
    );
    if (r.rows.length) return r.rows[0].id;
  }
  if (digits.length >= 4) {
    const r = await client.query(
      `SELECT id FROM users
       WHERE role_id = $1
         AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $2
       LIMIT 1`,
      [roleId, digits]
    );
    if (r.rows.length) return r.rows[0].id;
  }
  return null;
}

/**
 * Ensure a Parent-role user for father/mother contact. Reuses by phone/email.
 */
async function ensureParentContactUser(client, { full_name, email, phone, occupation }, warnings, warnLabel) {
  const { isUserEmailTaken } = require('./createPersonUser');
  const e = String(email ?? '').trim();
  const p = String(phone ?? '').trim();
  const fn = String(full_name ?? '').trim();
  if (!e && !p && !fn) return null;

  const existing = await findUserIdByPhoneOrEmail(client, ROLES.PARENT, p, e);
  if (existing) {
    await client.query(
      `UPDATE users SET
        occupation = COALESCE($1::text, occupation),
        modified_at = NOW()
      WHERE id = $2`,
      [occupation || null, existing]
    );
    return existing;
  }

  const uid = await createParentIndividualUser(client, {
    full_name: full_name || 'Parent',
    email: e || null,
    phone: p || null,
    parent_row_id: 0,
    side: 'p',
  });
  if (!uid && e && (await isUserEmailTaken(client, e)) && warnLabel) {
    warnings.push({
      code: 'EMAIL_IN_USE',
      field: 'parent_email',
      message: `${warnLabel}: Email already in use.`,
    });
  }
  if (uid && occupation) {
    await client.query(`UPDATE users SET occupation = $1, modified_at = NOW() WHERE id = $2`, [
      occupation,
      uid,
    ]);
  }
  return uid;
}

/**
 * Ensure Guardian-role user; reuses by phone/email within guardian role.
 */
async function ensureGuardianContactUser(
  client,
  { first_name, last_name, email, phone, occupation, address },
  warnings
) {
  const { isUserEmailTaken } = require('./createPersonUser');
  const e = String(email ?? '').trim();
  const p = String(phone ?? '').trim();
  const fn = String(first_name ?? '').trim();
  if (!e && !p && !fn) return null;

  const existing = await findUserIdByPhoneOrEmail(client, ROLES.GUARDIAN, p, e);
  if (existing) {
    await client.query(
      `UPDATE users SET
        occupation = COALESCE($1::text, occupation),
        current_address = COALESCE($2::text, current_address),
        modified_at = NOW()
      WHERE id = $3`,
      [occupation || null, address || null, existing]
    );
    return existing;
  }

  const uid = await createGuardianUser(client, {
    first_name: first_name || 'Guardian',
    last_name: last_name || '',
    phone: p || null,
    email: e || null,
  });
  if (!uid && e && (await isUserEmailTaken(client, e))) {
    warnings.push({
      code: 'EMAIL_IN_USE',
      field: 'guardian_email',
      message: 'Guardian: Email already in use.',
    });
  }
  if (uid) {
    await client.query(
      `UPDATE users SET occupation = COALESCE($1::text, occupation), current_address = COALESCE($2::text, current_address), modified_at = NOW() WHERE id = $3`,
      [occupation || null, address || null, uid]
    );
  }
  return uid;
}

module.exports = {
  getContactUserById,
  findUserIdByPhoneOrEmail,
  ensureParentContactUser,
  ensureGuardianContactUser,
  normDigits,
};
