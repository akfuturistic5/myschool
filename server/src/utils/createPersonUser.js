/**
 * Create a user account for a person (student, parent, guardian) and return user id.
 * Used when creating/updating students, parents, guardians - so they can login to the app.
 *
 * Login: auth accepts username OR email OR phone — store real email in users.email so
 * parents/students/guardians sign in with email + initial password (phone).
 * users.username is a stable handle: firstname.lastname (lowercase), unique with numeric suffix if needed.
 */
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/roles');

const USERS_USERNAME_MAX_LEN = 50;

/**
 * Find active user row by email (case-insensitive). Used to avoid users_email_key violations inside a transaction.
 */
async function findUserRowByEmail(client, email, { includeInactive = true } = {}) {
  const e = (email || '').toString().trim();
  if (!e) return null;
  const activeClause = includeInactive ? '' : ' AND is_active = true';
  const r = await client.query(
    `SELECT id, role_id FROM users
     WHERE email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM($1))${activeClause}
     LIMIT 1`,
    [e]
  );
  return r.rows[0] || null;
}

/** True if any active user already owns this email (one email → one user). */
async function isUserEmailTaken(client, email) {
  const row = await findUserRowByEmail(client, email);
  return Boolean(row);
}

async function findGuardianUserRowByPhone(client, phone, { includeInactive = true } = {}) {
  const p = (phone || '').toString().trim();
  if (!p) return null;
  const activeClause = includeInactive ? '' : ' AND is_active = true';
  const r = await client.query(
    `SELECT id, role_id FROM users
     WHERE phone IS NOT NULL
       AND TRIM(phone) = TRIM($1)
       AND role_id = $2${activeClause}
     LIMIT 1`,
    [p, ROLES.GUARDIAN]
  );
  return r.rows[0] || null;
}

async function runPersonInsertWithSavepoint(client, fn) {
  await client.query('SAVEPOINT sp_person_user_insert');
  try {
    const id = await fn();
    await client.query('RELEASE SAVEPOINT sp_person_user_insert');
    return id;
  } catch (e) {
    await client.query('ROLLBACK TO SAVEPOINT sp_person_user_insert');
    throw e;
  }
}

/** Lowercase alphanumeric segment from a name part (no spaces). */
function nameSegment(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);
}

/**
 * Human-readable username base: first.last (e.g. aabid.khan). Falls back to single segment if one name missing.
 */
function usernameBaseFromFirstLast(first, last) {
  const f = nameSegment(first);
  const l = nameSegment(last);
  if (f && l) return `${f}.${l}`;
  if (f) return f;
  if (l) return l;
  return '';
}

/**
 * Pick a username not yet in users.username (varchar 50). Never reuses another person's row on collision.
 */
async function allocateUniqueUsername(client, base, extraSuffixes = []) {
  const maxLen = USERS_USERNAME_MAX_LEN;
  const bases = [];
  const trimmedBase = (base || '').toString().trim().slice(0, maxLen);
  if (trimmedBase.length > 0) bases.push(trimmedBase);

  for (const ex of extraSuffixes) {
    const raw = String(ex ?? '').trim();
    if (!raw || !trimmedBase) continue;
    const digits = raw.replace(/\D/g, '');
    const seg = (digits.length >= 2 ? digits.slice(-6) : '') || raw.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8);
    if (seg) bases.push(`${trimmedBase}.${seg}`.slice(0, maxLen));
  }

  if (bases.length === 0) {
    bases.push(`u${Date.now()}`.slice(0, maxLen));
  }

  for (const b of bases) {
    const candidate = b.slice(0, maxLen);
    const check = await client.query('SELECT 1 FROM users WHERE username = $1 LIMIT 1', [candidate]);
    if (check.rows.length === 0) return candidate;
  }

  const root = bases[0].slice(0, Math.max(1, maxLen - 6));
  for (let i = 1; i < 5000; i++) {
    const candidate = `${root}.${i}`.slice(0, maxLen);
    const check = await client.query('SELECT 1 FROM users WHERE username = $1 LIMIT 1', [candidate]);
    if (check.rows.length === 0) return candidate;
  }

  return `u${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(0, maxLen);
}

/**
 * Create user for student/parent/guardian/teacher
 * @param {Object} client - PG client (from transaction)
 * @param {number} roleId
 * @param {Object} opts - { username, email, phone, first_name, last_name, password? }
 * @param {Object} [insertOptions]
 * @param {boolean} [insertOptions.rejectUsernameConflict] - If true, duplicate username/email throws (required for teacher create; avoids linking staff to wrong user)
 * @param {boolean} [insertOptions.reuseUsernameOnConflict] - If true (default), duplicate username returns existing user id (legacy). If false, throws on duplicate username.
 * @returns {Promise<number|null>} user id
 */
async function createPersonUser(client, roleId, opts, insertOptions = {}) {
  const { rejectUsernameConflict = false, reuseUsernameOnConflict = true } = insertOptions;
  const username = (opts.username || opts.phone || opts.email || '').toString().trim();
  if (!username) return null;

  const email = (opts.email || '').toString().trim() || null;
  const phone = (opts.phone || '').toString().trim() || null;
  const firstName = (opts.first_name || opts.firstName || '').toString().trim() || null;
  const lastName = (opts.last_name || opts.lastName || '').toString().trim() || null;
  const rawPassword = (opts.password || opts.phone || '123456').toString().trim();

  let passwordHash;
  try {
    passwordHash = await bcrypt.hash(rawPassword, 12);
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
    if (
      reuseUsernameOnConflict &&
      !rejectUsernameConflict &&
      e.code === '23505' &&
      e.constraint &&
      String(e.constraint).includes('username')
    ) {
      const existing = await client.query('SELECT id FROM users WHERE username = $1', [username]);
      if (existing.rows.length > 0) return existing.rows[0].id;
    }
    throw e;
  }
  if (!r || r.rows.length === 0) return null;
  return r.rows[0].id;
}

/**
 * Create user for student — users.username = unique first.last; login via users.email or phone; password = phone (else admission fallback).
 */
async function createStudentUser(client, { admission_number, first_name, last_name, phone, email }) {
  const emailTrim = (email || '').toString().trim();
  const phoneTrim = (phone || '').toString().trim();
  const firstName = (first_name || '').toString().trim();
  const lastName = (last_name || '').toString().trim();
  const admission = (admission_number || '').toString().trim();
  const admissionSlug = admission.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 14);

  let base = usernameBaseFromFirstLast(firstName, lastName);
  if (!base && admissionSlug) base = `stu.${admissionSlug}`.replace(/\.+/g, '.').slice(0, 40);
  if (!base && phoneTrim) {
    const d = phoneTrim.replace(/\D/g, '');
    if (d.length >= 2) base = `stu.${d.slice(-8)}`;
  }
  if (!base) base = `stu.${Date.now()}`;

  const phoneDigits = phoneTrim.replace(/\D/g, '');
  const username = await allocateUniqueUsername(client, base, [phoneDigits, admissionSlug]);

  if (emailTrim) {
    const existing = await findUserRowByEmail(client, emailTrim);
    if (existing) {
      console.warn(
        `createStudentUser: email already in use (user id=${existing.id}), skipping student user link`
      );
      return null;
    }
  }

  try {
    return await runPersonInsertWithSavepoint(client, () =>
      createPersonUser(
        client,
        ROLES.STUDENT,
        {
          username,
          email: emailTrim || null,
          phone: phoneTrim || null,
          first_name: firstName || null,
          last_name: lastName || null,
          password: phoneTrim || admission || '123456',
        },
        { reuseUsernameOnConflict: false }
      )
    );
  } catch (e) {
    if (e.code === '23505' && emailTrim && String(e.constraint || '').includes('email')) {
      console.warn('createStudentUser: duplicate email (concurrent), skipping student user link');
      return null;
    }
    throw e;
  }
}

function parseFullName(fullName) {
  const s = (fullName || '').toString().trim();
  if (!s) return { first_name: null, last_name: null };
  const i = s.indexOf(' ');
  if (i === -1) return { first_name: s, last_name: null };
  return { first_name: s.slice(0, i).trim(), last_name: s.slice(i + 1).trim() || null };
}

/**
 * One Parent-role user for either father or mother (same app role as legacy single parent).
 * users.username = unique first.last from full name; login with email (and phone as initial password).
 */
async function createParentIndividualUser(client, { full_name, email, phone, parent_row_id, side }) {
  const emailTrim = (email || '').toString().trim();
  const phoneTrim = (phone || '').toString().trim();
  if (!emailTrim && !phoneTrim) return null;

  const { first_name, last_name } = parseFullName(full_name);
  let base = usernameBaseFromFirstLast(first_name, last_name);
  if (!base) base = `par.${side}.${parent_row_id}`;

  const phoneDigits = phoneTrim.replace(/\D/g, '');
  const username = await allocateUniqueUsername(client, base, [phoneDigits, `p${parent_row_id}${String(side).charAt(0)}`]);

  if (emailTrim) {
    const existing = await findUserRowByEmail(client, emailTrim);
    if (existing) {
      console.warn(`createParentIndividualUser: email already in use, skip user (${side})`);
      return null;
    }
  }

  try {
    return await runPersonInsertWithSavepoint(client, () =>
      createPersonUser(
        client,
        ROLES.PARENT,
        {
          username,
          email: emailTrim || null,
          phone: phoneTrim || null,
          first_name,
          last_name,
          password: phoneTrim || '123456',
        },
        { reuseUsernameOnConflict: false }
      )
    );
  } catch (e) {
    if (e.code === '23505' && emailTrim && String(e.constraint || '').includes('email')) {
      console.warn(`createParentIndividualUser: duplicate email (race), skip user (${side})`);
      return null;
    }
    throw e;
  }
}

/**
 * Create user for parent - username = email (name+email for login), password = phone
 * Parent logs in with email/username and phone number as password.
 * @deprecated Prefer createParentIndividualUser per father/mother; kept for callers that still merge contacts.
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
 * Create user for guardian — users.username = unique first.last; login with email or phone; password = phone.
 */
async function createGuardianUser(client, { first_name, last_name, phone, email }) {
  const emailTrim = (email || '').toString().trim();
  const phoneTrim = (phone || '').toString().trim();
  if (!emailTrim && !phoneTrim) return null;

  const fn = (first_name || 'Guardian').toString().trim();
  const ln = (last_name || '').toString().trim();
  let base = usernameBaseFromFirstLast(fn, ln);
  if (!base) base = 'guardian';

  const phoneDigits = phoneTrim.replace(/\D/g, '');
  const username = await allocateUniqueUsername(client, base, [phoneDigits]);

  if (emailTrim) {
    const existing = await findUserRowByEmail(client, emailTrim);
    if (existing) {
      if (Number(existing.role_id) !== Number(ROLES.GUARDIAN)) {
        const err = new Error('Email is already linked to another account type');
        err.code = 'EMAIL_IN_USE_BY_DIFFERENT_ROLE';
        throw err;
      }
      return existing.id;
    }
  } else if (phoneTrim) {
    const existingByPhone = await findGuardianUserRowByPhone(client, phoneTrim);
    if (existingByPhone) return existingByPhone.id;
  }

  try {
    return await runPersonInsertWithSavepoint(client, () =>
      createPersonUser(
        client,
        ROLES.GUARDIAN,
        {
          username,
          email: emailTrim || null,
          phone: phoneTrim || null,
          first_name: fn || null,
          last_name: ln || null,
          password: phoneTrim || '123456',
        },
        { reuseUsernameOnConflict: false }
      )
    );
  } catch (e) {
    if (e.code === '23505' && emailTrim && String(e.constraint || '').includes('email')) {
      const existing = await findUserRowByEmail(client, emailTrim);
      if (existing && Number(existing.role_id) === Number(ROLES.GUARDIAN)) {
        return existing.id;
      }
      const conflict = new Error('Email is already linked to another account type');
      conflict.code = 'EMAIL_IN_USE_BY_DIFFERENT_ROLE';
      throw conflict;
    }
    throw e;
  }
}

const crypto = require('crypto');

function generateTeacherInitialPassword() {
  return crypto.randomBytes(18).toString('base64url');
}

/**
 * Teacher app login — username prefers email, then phone.
 * Password: explicit → else phone digits → else cryptographically secure random (never weak default).
 * Duplicate username/email always fails the transaction (rejectUsernameConflict).
 */
async function createTeacherUser(client, { email, phone, first_name, last_name, password }) {
  const emailTrim = (email || '').toString().trim();
  const phoneTrim = (phone || '').toString().trim();
  const username = (emailTrim || phoneTrim || `tch_${Date.now()}`).toString().trim().slice(0, 50);

  let rawPassword;
  if (password != null && String(password).trim() !== '') {
    rawPassword = String(password).trim();
  } else if (phoneTrim) {
    rawPassword = phoneTrim.replace(/\D/g, '') || phoneTrim;
  } else {
    rawPassword = generateTeacherInitialPassword();
  }

  const userId = await createPersonUser(
    client,
    ROLES.TEACHER,
    {
      username,
      email: emailTrim || null,
      phone: phoneTrim || null,
      first_name: (first_name || '').toString().trim() || null,
      last_name: (last_name || '').toString().trim() || null,
      password: rawPassword,
    },
    { rejectUsernameConflict: true }
  );

  return userId;
}

module.exports = {
  createPersonUser,
  createStudentUser,
  createParentUser,
  createParentIndividualUser,
  createGuardianUser,
  createTeacherUser,
  isUserEmailTaken,
};
