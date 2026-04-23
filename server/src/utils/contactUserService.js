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
async function ensureParentContactUser(client, { id, full_name, email, phone, occupation }, warnings, warnLabel) {
  const { isUserEmailTaken, parseFullName, findUserRowByEmail } = require('./createPersonUser');
  const e = String(email ?? '').trim();
  const p = String(phone ?? '').trim();
  const fn = String(full_name ?? '').trim();

  // 1. If we have an ID, we are updating an EXISTING linked user
  if (id) {
    const userId = parseInt(id, 10);
    if (!Number.isNaN(userId) && userId > 0) {
      const { first_name, last_name } = parseFullName(fn);
      // Update email if provided in request
      const targetEmail = e || null;
      if (targetEmail) {
        const conflict = await findUserRowByEmail(client, targetEmail, { excludeId: userId });
        if (conflict) {
          const err = new Error(`${warnLabel}: Email "${targetEmail}" is already linked to another account.`);
          err.statusCode = 409;
          throw err;
        }
      }
      await client.query(`UPDATE users SET email = $1 WHERE id = $2`, [targetEmail, userId]);
      
      await client.query(
        `UPDATE users SET
          first_name = COALESCE($1::text, first_name),
          last_name = $2::text,
          phone = $3::text,
          occupation = $4::text,
          current_address = COALESCE(current_address, 'Not Provided'),
          permanent_address = COALESCE(permanent_address, 'Not Provided'),
          modified_at = NOW()
        WHERE id = $5`,
        [first_name || null, last_name || null, p || null, occupation || null, userId]
      );
      return userId;
    }
  }

  if (!e && !p && !fn) return null;

  // 2. Try to reuse existing Parent by phone or email
  const existing = await findUserIdByPhoneOrEmail(client, ROLES.PARENT, p, e);
  if (existing) {
    const { first_name, last_name } = parseFullName(fn);
    if (e) {
      const conflict = await findUserRowByEmail(client, e, { excludeId: existing });
      if (conflict) {
        const err = new Error(`${warnLabel}: Email "${e}" is already linked to another account.`);
        err.statusCode = 409;
        throw err;
      }
      await client.query(`UPDATE users SET email = $1 WHERE id = $2`, [e, existing]);
    }
    await client.query(
      `UPDATE users SET
        first_name = COALESCE($1::text, first_name),
        last_name = $2::text,
        occupation = COALESCE($3::text, occupation),
        current_address = COALESCE(current_address, 'Not Provided'),
        permanent_address = COALESCE(permanent_address, 'Not Provided'),
        modified_at = NOW()
      WHERE id = $4`,
      [first_name || null, last_name || null, occupation || null, existing]
    );
    return existing;
  }

  // 3. Create new user
  const uid = await createParentIndividualUser(client, {
    full_name: full_name || 'Parent',
    email: e || null,
    phone: p || null,
    parent_row_id: 0,
    side: 'p',
  });
  
  if (!uid && e && (await isUserEmailTaken(client, e))) {
    const err = new Error(`${warnLabel || 'Parent'}: Email "${e}" is already used by another account.`);
    err.statusCode = 409;
    throw err;
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
  { id, first_name, last_name, email, phone, occupation, address },
  warnings
) {
  const { isUserEmailTaken, findUserRowByEmail } = require('./createPersonUser');
  const e = String(email ?? '').trim();
  const p = String(phone ?? '').trim();
  const fn = String(first_name ?? '').trim();

  // 1. If we have an ID, we are updating an EXISTING linked user
  if (id) {
    const userId = parseInt(id, 10);
    if (!Number.isNaN(userId) && userId > 0) {
      // Update email if provided in request
      const targetEmail = e || null;
      if (targetEmail) {
        const conflict = await findUserRowByEmail(client, targetEmail, { excludeId: userId });
        if (conflict) {
          const err = new Error(`Guardian: Email "${targetEmail}" is already used by another account.`);
          err.statusCode = 409;
          throw err;
        }
      }
      await client.query(`UPDATE users SET email = $1 WHERE id = $2`, [targetEmail, userId]);
      
      await client.query(
        `UPDATE users SET
          first_name = COALESCE($1::text, first_name),
          last_name = $2::text,
          phone = $3::text,
          occupation = $4::text,
          current_address = $5::text,
          permanent_address = COALESCE(permanent_address, 'Not Provided'),
          modified_at = NOW()
        WHERE id = $6`,
        [fn || null, last_name || null, p || null, occupation || null, address || 'Not Provided', userId]
      );
      return userId;
    }
  }

  if (!e && !p && !fn) return null;

  // 2. Try to reuse existing Guardian by phone or email
  const existing = await findUserIdByPhoneOrEmail(client, ROLES.GUARDIAN, p, e);
  if (existing) {
    if (e) {
      const conflict = await findUserRowByEmail(client, e, { excludeId: existing });
      if (conflict) {
        const err = new Error(`Guardian: Email "${e}" is already used by another account.`);
        err.statusCode = 409;
        throw err;
      }
      await client.query(`UPDATE users SET email = $1 WHERE id = $2`, [e, existing]);
    }
    await client.query(
      `UPDATE users SET
        first_name = COALESCE($1::text, first_name),
        last_name = $2::text,
        occupation = COALESCE($3::text, occupation),
        current_address = COALESCE($4::text, current_address),
        permanent_address = COALESCE(permanent_address, 'Not Provided'),
        modified_at = NOW()
      WHERE id = $5`,
      [fn || null, last_name || null, occupation || null, address || 'Not Provided', existing]
    );
    return existing;
  }

  // 3. Create new user
  const uid = await createGuardianUser(client, {
    first_name: first_name || 'Guardian',
    last_name: last_name || '',
    phone: p || null,
    email: e || null,
  });
  
  if (!uid && e && (await isUserEmailTaken(client, e))) {
    const err = new Error(`Guardian: Email "${e}" is already used by another account.`);
    err.statusCode = 409;
    throw err;
  }
  
  if (uid) {
    await client.query(
      `UPDATE users SET occupation = COALESCE($1::text, occupation), current_address = COALESCE($2::text, current_address), permanent_address = COALESCE(permanent_address, 'Not Provided'), modified_at = NOW() WHERE id = $3`,
      [occupation || null, address || 'Not Provided', uid]
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
