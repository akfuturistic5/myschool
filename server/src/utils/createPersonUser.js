/**
 * Create a user account for a person (student, parent, guardian) and return user id.
 * Used when creating/updating students, parents, guardians - so they can login to the app.
 */
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/roles');

/**
 * Create user for student/parent/guardian
 * @param {Object} client - PG client (from transaction)
 * @param {number} roleId - ROLES.STUDENT | ROLES.PARENT | ROLES.GUARDIAN
 * @param {Object} opts - { username, email, phone, first_name, last_name, password? }
 * @returns {Promise<number>} user id
 */
async function createPersonUser(client, roleId, opts) {
  const username = (opts.username || opts.phone || opts.email || '').toString().trim();
  if (!username) return null;

  const email = (opts.email || '').toString().trim() || null;
  const phone = (opts.phone || '').toString().trim() || null;
  const firstName = (opts.first_name || opts.firstName || '').toString().trim() || null;
  const lastName = (opts.last_name || opts.lastName || '').toString().trim() || null;
  const rawPassword = (opts.password || opts.phone || '123456').toString().trim();

  let passwordHash;
  try {
    passwordHash = await bcrypt.hash(rawPassword, 10);
  } catch (e) {
    console.error('createPersonUser: bcrypt hash failed', e.message);
    return null;
  }

  let r;
  try {
    r = await client.query(
      `INSERT INTO users (username, email, phone, password_hash, role_id, first_name, last_name, is_active, created_at, modified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
       RETURNING id`,
      [username, email, phone, passwordHash, roleId, firstName, lastName]
    );
  } catch (e) {
    if (e.code === '23505' && e.constraint && e.constraint.includes('username')) {
      const existing = await client.query('SELECT id FROM users WHERE username = $1', [username]);
      if (existing.rows.length > 0) return existing.rows[0].id;
    }
    throw e;
  }
  if (!r || r.rows.length === 0) return null;
  return r.rows[0].id;
}

/**
 * Create user for student - username = email or name+admission (for login), password = primary contact (phone)
 * Student logs in with email/username and primary contact number as password.
 */
async function createStudentUser(client, { admission_number, first_name, last_name, phone, email }) {
  const emailTrim = (email || '').toString().trim();
  const phoneTrim = (phone || '').toString().trim();
  const firstName = (first_name || '').toString().trim();
  const lastName = (last_name || '').toString().trim();
  const admission = (admission_number || '').toString().trim();
  const namePart = [firstName, lastName].filter(Boolean).join('_');
  const username = emailTrim || (namePart && admission ? `${namePart}_${admission}` : null) || admission || phoneTrim || 'stu_' + Date.now();
  return createPersonUser(client, ROLES.STUDENT, {
    username: username.toString().trim(),
    email: emailTrim || null,
    phone: phoneTrim || null,
    first_name: firstName || null,
    last_name: lastName || null,
    password: phoneTrim || admission || '123456'
  });
}

/**
 * Create user for parent - username = email (name+email for login), password = phone
 * Parent logs in with email/username and phone number as password.
 */
async function createParentUser(client, { father_name, father_email, father_phone, mother_name, mother_email, mother_phone, student_id }) {
  const email = (father_email || mother_email || '').toString().trim();
  const phone = (father_phone || mother_phone || '').toString().trim();
  const username = email || (phone ? 'par_' + student_id + '_' + phone : 'par_' + student_id + '_' + Date.now());
  const firstName = (father_name || mother_name || '').toString().trim() || null;
  const lastName = null;
  return createPersonUser(client, ROLES.PARENT, {
    username: username.toString().trim(),
    email: email || null,
    phone: phone || null,
    first_name: firstName,
    last_name: lastName,
    password: phone || '123456'
  });
}

/**
 * Create user for guardian - username = email (name+email for login), password = phone
 * Guardian logs in with email/username and phone number as password.
 */
async function createGuardianUser(client, { first_name, last_name, phone, email }) {
  const emailTrim = (email || '').toString().trim();
  const phoneTrim = (phone || '').toString().trim();
  const username = emailTrim || phoneTrim || 'grd_' + Date.now();
  return createPersonUser(client, ROLES.GUARDIAN, {
    username: username.toString().trim(),
    email: emailTrim || null,
    phone: phoneTrim || null,
    first_name: (first_name || 'Guardian').toString().trim(),
    last_name: (last_name || '').toString().trim() || null,
    password: phoneTrim || '123456'
  });
}

module.exports = {
  createPersonUser,
  createStudentUser,
  createParentUser,
  createGuardianUser
};
