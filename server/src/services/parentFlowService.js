/**
 * User-based parent creation + guardian (father) link. No legacy parent table.
 */
const { ROLES } = require('../config/roles');
const { findUserIdByPhoneOrEmail } = require('../utils/contactUserService');
const { createParentIndividualUser, parseFullName } = require('../utils/createPersonUser');

/**
 * @param {number} schoolId
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
function normalizeTenantProfilePath(schoolId, raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim().replace(/\\/g, '/');
  const m = /^school_(\d+)\/uploads\/[^/]+\.(jpe?g|png|svg)$/i.exec(s);
  if (!m) return null;
  if (Number(m[1]) !== Number(schoolId)) return null;
  return s;
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ fullName: string, phone: string, email?: string|null, avatarRelativePath?: string|null }} input
 * @param {string[]} warnings
 * @returns {Promise<{ userId: number, reused: boolean }>}
 */
async function createOrReuseParentUser(client, { fullName, phone, email, avatarRelativePath }, warnings) {
  const phoneTrim = String(phone || '').trim();
  if (!phoneTrim) {
    const err = new Error('Mobile is required');
    err.statusCode = 400;
    throw err;
  }

  const emailTrim = (email || '').toString().trim() || null;
  const { first_name, last_name } = parseFullName(fullName || 'Parent');

  const existingId = await findUserIdByPhoneOrEmail(client, ROLES.PARENT, phoneTrim, emailTrim || '');
  if (existingId) {
    await client.query(
      `UPDATE users SET
        first_name = COALESCE($1::text, first_name),
        last_name = COALESCE($2::text, last_name),
        email = CASE WHEN $3::text IS NOT NULL AND TRIM($3::text) <> '' THEN $3::text ELSE email END,
        phone = COALESCE(NULLIF(TRIM($4::text), ''), phone),
        avatar = COALESCE(NULLIF(TRIM($5::text), ''), avatar),
        modified_at = NOW()
      WHERE id = $6`,
      [first_name || null, last_name || null, emailTrim, phoneTrim, avatarRelativePath || null, existingId]
    );
    return { userId: existingId, reused: true };
  }

  const uid = await createParentIndividualUser(
    client,
    {
      full_name: fullName || 'Parent',
      email: emailTrim,
      phone: phoneTrim,
      parent_row_id: 0,
      side: 'f',
    },
    warnings,
    'Father'
  );
  if (!uid) {
    const err = new Error('Could not create parent user (check mobile/email uniqueness)');
    err.statusCode = 400;
    throw err;
  }
  if (avatarRelativePath) {
    await client.query(`UPDATE users SET avatar = $1, modified_at = NOW() WHERE id = $2`, [
      avatarRelativePath,
      uid,
    ]);
  }
  return { userId: uid, reused: false };
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{ userId: number, studentId: number }} input
 */
async function assignFatherGuardian(client, { userId, studentId }) {
  const dup = await client.query(
    `SELECT id FROM guardians
     WHERE student_id = $1 AND user_id = $2
       AND LOWER(COALESCE(guardian_type::text, '')) = 'father'
       AND is_active = true
     LIMIT 1`,
    [studentId, userId]
  );
  if (dup.rows.length > 0) {
    return { guardianId: dup.rows[0].id, created: false };
  }

  const ins = await client.query(
    `INSERT INTO guardians (
      student_id, user_id, guardian_type, relation,
      is_primary_contact, is_emergency_contact, is_active, created_at, modified_at
    ) VALUES ($1, $2, 'father', 'Father', true, false, true, NOW(), NOW())
    RETURNING id`,
    [studentId, userId]
  );
  const gid = ins.rows[0].id;
  await client.query(`UPDATE students SET guardian_id = $1, modified_at = NOW() WHERE id = $2`, [gid, studentId]);
  await client.query(
    `UPDATE guardians SET is_primary_contact = (id = $1), modified_at = NOW() WHERE student_id = $2`,
    [gid, studentId]
  );
  return { guardianId: gid, created: true };
}

module.exports = {
  normalizeTenantProfilePath,
  createOrReuseParentUser,
  assignFatherGuardian,
  parseFullName,
};
