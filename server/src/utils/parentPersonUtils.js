/**
 * Normalized parent_persons helpers — dedupe by phone digits or lower(email).
 */

function normalizePhoneDigits(phone) {
  if (phone == null) return '';
  return String(phone).replace(/\D/g, '');
}

function normalizeEmail(email) {
  if (email == null || String(email).trim() === '') return null;
  return String(email).trim().toLowerCase();
}

/**
 * Find existing parent_person by phone (digit match) or email.
 */
async function findParentPersonIdByContact(client, phone, email) {
  const phoneNorm = normalizePhoneDigits(phone);
  const emailNorm = normalizeEmail(email);
  if (phoneNorm) {
    const r = await client.query(
      `SELECT id FROM parent_persons
       WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
       LIMIT 1`,
      [phoneNorm]
    );
    if (r.rows.length) return r.rows[0].id;
  }
  if (emailNorm) {
    const r = await client.query(
      `SELECT id FROM parent_persons
       WHERE lower(trim(email)) = $1
       LIMIT 1`,
      [emailNorm]
    );
    if (r.rows.length) return r.rows[0].id;
  }
  return null;
}

/**
 * Insert or return existing id. Requires at least one of phone or email (validated by caller).
 */
async function upsertParentPerson(client, { full_name, phone, email, address, occupation }) {
  const emailNorm = normalizeEmail(email);
  const phoneNorm = normalizePhoneDigits(phone);
  const phoneTrim = phone != null && String(phone).trim() !== '' ? String(phone).trim() : null;

  if (!phoneNorm && !emailNorm) {
    const err = new Error('Parent person requires at least mobile or email');
    err.statusCode = 400;
    throw err;
  }

  const existing = await findParentPersonIdByContact(client, phone, email);
  if (existing) {
    await client.query(
      `UPDATE parent_persons SET
        full_name = COALESCE(NULLIF(trim($1), ''), full_name),
        phone = COALESCE(NULLIF($2::text, ''), phone),
        email = COALESCE($3, email),
        address = COALESCE($4, address),
        occupation = COALESCE($5, occupation),
        updated_at = NOW()
      WHERE id = $6`,
      [
        full_name || '',
        phoneTrim,
        emailNorm,
        address || null,
        occupation || null,
        existing,
      ]
    );
    return existing;
  }

  try {
    const ins = await client.query(
      `INSERT INTO parent_persons (full_name, phone, email, address, occupation, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      [
        full_name || '',
        phoneTrim,
        emailNorm,
        address || null,
        occupation || null,
      ]
    );
    return ins.rows[0].id;
  } catch (e) {
    if (e.code === '23505') {
      const retry = await findParentPersonIdByContact(client, phone, email);
      if (retry) return retry;
    }
    throw e;
  }
}

async function getParentPersonById(client, id) {
  const r = await client.query('SELECT * FROM parent_persons WHERE id = $1 LIMIT 1', [id]);
  return r.rows[0] || null;
}

module.exports = {
  normalizePhoneDigits,
  normalizeEmail,
  findParentPersonIdByContact,
  upsertParentPerson,
  getParentPersonById,
};
