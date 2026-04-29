/**
 * Parent-user matching: guardians.user_id → users (Parent / Guardian roles).
 */
const { query } = require('../config/database');

function isMissingParentsTableError(err) {
  if (!err) return false;
  if (String(err.code || '') !== '42P01') return false;
  return /relation\s+"?parents"?\s+does not exist/i.test(String(err.message || ''));
}

function normalizeEmail(v) {
  const s = String(v || '').trim().toLowerCase();
  return s || null;
}

function normalizePhoneDigits(v) {
  const digits = String(v || '').replace(/\D+/g, '');
  return digits.length >= 7 ? digits : null;
}

function isMissingGuardiansLegacyColumnError(err) {
  if (!err) return false;
  if (String(err.code || '') !== '42703') return false;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('guardians.first_name') || msg.includes('guardians.last_name') || msg.includes('guardians.email') || msg.includes('guardians.phone');
}

function fullName(row) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
}

/**
 * Map a guardian link + user + student to a row shaped like legacy `parents` list items.
 */
function mapGuardianLinkToLegacyParentRow(row) {
  const name = fullName(row) || row.first_name || '';
  const gt = (row.guardian_type || '').toString().toLowerCase();
  const base = {
    id: row.g_id,
    student_id: row.student_id,
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    student_first_name: row.student_first_name,
    student_last_name: row.student_last_name,
    admission_number: row.admission_number,
    roll_number: row.roll_number,
    class_id: row.class_id != null ? Number(row.class_id) : null,
    section_id: row.section_id != null ? Number(row.section_id) : null,
    academic_year_id: row.academic_year_id != null ? Number(row.academic_year_id) : null,
    class_name: row.class_name,
    section_name: row.section_name,
    father_image_url: null,
    mother_image_url: null,
  };
  const empty = {
    father_name: null,
    father_email: null,
    father_phone: null,
    father_occupation: null,
    mother_name: null,
    mother_email: null,
    mother_phone: null,
    mother_occupation: null,
  };
  if (gt === 'father') {
    return {
      ...base,
      ...empty,
      father_name: name,
      father_email: row.email,
      father_phone: row.phone,
      father_occupation: row.occupation,
    };
  }
  if (gt === 'mother') {
    return {
      ...base,
      ...empty,
      mother_name: name,
      mother_email: row.email,
      mother_phone: row.phone,
      mother_occupation: row.occupation,
    };
  }
  return {
    ...base,
    ...empty,
    father_name: name || 'Guardian',
    father_email: row.email,
    father_phone: row.phone,
  };
}

function mapParentsTableRow(row) {
  return {
    id: row.id,
    student_id: row.student_id,
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    student_first_name: row.student_first_name,
    student_last_name: row.student_last_name,
    admission_number: row.admission_number,
    roll_number: row.roll_number,
    class_id: row.class_id != null ? Number(row.class_id) : null,
    section_id: row.section_id != null ? Number(row.section_id) : null,
    academic_year_id: row.academic_year_id != null ? Number(row.academic_year_id) : null,
    class_name: row.class_name,
    section_name: row.section_name,
    father_name: row.father_name || null,
    father_email: row.father_email || null,
    father_phone: row.father_phone || null,
    father_occupation: row.father_occupation || null,
    mother_name: row.mother_name || null,
    mother_email: row.mother_email || null,
    mother_phone: row.mother_phone || null,
    mother_occupation: row.mother_occupation || null,
    father_image_url: row.father_image_url || null,
    mother_image_url: row.mother_image_url || null,
  };
}

function mergeRowsByStudent(rows) {
  const byStudent = new Map();
  for (const row of rows) {
    const sid = row?.student_id;
    if (!sid) continue;
    if (!byStudent.has(sid)) {
      byStudent.set(sid, { ...row });
      continue;
    }
    const prev = byStudent.get(sid);
    const merged = { ...prev };
    for (const [key, val] of Object.entries(row)) {
      if (
        val !== null &&
        val !== undefined &&
        !(typeof val === 'string' && val.trim() === '') &&
        (merged[key] === null || merged[key] === undefined || (typeof merged[key] === 'string' && merged[key].trim() === ''))
      ) {
        merged[key] = val;
      }
    }
    // Keep deterministic id for downstream keys.
    merged.id = prev.id ?? row.id;
    byStudent.set(sid, merged);
  }
  return Array.from(byStudent.values());
}

/**
 * Get guardian-linked rows for the logged-in user (Parent or Guardian role).
 * @returns {Promise<{ parents: Array, studentIds: number[] }>}
 */
async function getParentsForUser(userId) {
  const userResult = await query(
    'SELECT id, username, email, phone FROM users WHERE id = $1 AND is_active = true',
    [userId]
  );
  if (userResult.rows.length === 0) {
    return { parents: [], studentIds: [] };
  }
  const authUser = userResult.rows[0];

  const baseSelect = `
    SELECT
      g.id AS g_id,
      g.student_id,
      g.user_id,
      g.guardian_type,
      u.first_name,
      u.last_name,
      u.email,
      u.phone,
      u.occupation,
      g.created_at,
      g.modified_at AS updated_at,
      s.first_name AS student_first_name,
      s.last_name AS student_last_name,
      s.admission_number,
      s.roll_number,
      s.class_id,
      s.section_id,
      s.academic_year_id,
      c.class_name,
      sec.section_name
    FROM guardians g
    INNER JOIN users u ON u.id = g.user_id
    INNER JOIN students s ON s.id = g.student_id
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    WHERE s.is_active = true
      AND g.is_active = true
      AND u.is_active = true
  `;
  const toPayload = (rows, mapper = mapGuardianLinkToLegacyParentRow) => {
    const parents = mergeRowsByStudent(rows.map(mapper));
    const studentIds = [...new Set(parents.map((p) => p.student_id).filter(Boolean))];
    return { parents, studentIds };
  };

  let directUserMatch = await query(
    `${baseSelect} AND g.user_id = $1
     ORDER BY s.first_name ASC, s.last_name ASC`,
    [userId]
  );
  if (directUserMatch.rows.length > 0) {
    return toPayload(directUserMatch.rows);
  }

  // Legacy fallback: parents table with explicit user-id columns only.
  // NOTE: We intentionally do NOT match by email/phone here to avoid cross-account exposure
  // when multiple users share same contact details.
  {
    const params = [userId];
    const selectSplitCols = `
      SELECT
        p.id,
        p.student_id,
        p.user_id,
        p.father_name,
        p.father_email,
        p.father_phone,
        p.father_occupation,
        p.father_image_url,
        p.mother_name,
        p.mother_email,
        p.mother_phone,
        p.mother_occupation,
        p.mother_image_url,
        p.created_at,
        p.updated_at,
        s.first_name AS student_first_name,
        s.last_name AS student_last_name,
        s.admission_number,
        s.roll_number,
        s.class_id,
        s.section_id,
        s.academic_year_id,
        c.class_name,
        sec.section_name
      FROM parents p
      INNER JOIN students s ON s.id = p.student_id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE s.is_active = true
        AND (
          p.user_id = $1
          OR p.father_user_id = $1
          OR p.mother_user_id = $1
        )
      ORDER BY s.first_name ASC, s.last_name ASC`;
    const selectLegacyCols = `
      SELECT
        p.id,
        p.student_id,
        p.user_id,
        p.father_name,
        p.father_email,
        p.father_phone,
        p.father_occupation,
        p.father_image_url,
        p.mother_name,
        p.mother_email,
        p.mother_phone,
        p.mother_occupation,
        p.mother_image_url,
        p.created_at,
        p.updated_at,
        s.first_name AS student_first_name,
        s.last_name AS student_last_name,
        s.admission_number,
        s.roll_number,
        s.class_id,
        s.section_id,
        s.academic_year_id,
        c.class_name,
        sec.section_name
      FROM parents p
      INNER JOIN students s ON s.id = p.student_id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE s.is_active = true
        AND p.user_id = $1
      ORDER BY s.first_name ASC, s.last_name ASC`;

    try {
      const r = await query(selectSplitCols, params);
      if (r.rows.length > 0) {
        return toPayload(r.rows, mapParentsTableRow);
      }
    } catch (e) {
      if (isMissingParentsTableError(e)) {
        return { parents: [], studentIds: [] };
      }
      if (!/father_user_id|mother_user_id/.test(String(e.message || ''))) throw e;
      const r = await query(selectLegacyCols, params);
      if (r.rows.length > 0) {
        return toPayload(r.rows, mapParentsTableRow);
      }
    }
  }

  // Legacy fallback (secure): deployments where guardians.user_id was never linked.
  // Match only exact normalized identifiers from authenticated user.
  {
    const candidateEmails = new Set();
    const userEmail = normalizeEmail(authUser.email);
    if (userEmail) candidateEmails.add(userEmail);

    const username = String(authUser.username || '').trim().toLowerCase();
    if (username) {
      if (username.includes('@')) {
        candidateEmails.add(username);
      } else {
        candidateEmails.add(`${username}@email.com`);
      }
    }

    const normalizedPhone = normalizePhoneDigits(authUser.phone);
    const emailList = Array.from(candidateEmails).filter(Boolean);
    const canMatchByEmail = emailList.length > 0;
    const canMatchByPhone = !!normalizedPhone;

    if (canMatchByEmail || canMatchByPhone) {
      const params = [];
      const where = ['s.is_active = true', 'g.is_active = true'];

      if (canMatchByEmail && canMatchByPhone) {
        params.push(emailList);
        const emailParam = `$${params.length}`;
        params.push(normalizedPhone);
        const phoneParam = `$${params.length}`;
        where.push(`(
          LOWER(BTRIM(COALESCE(g.email, ''))) = ANY(${emailParam}::text[])
          OR regexp_replace(COALESCE(g.phone, ''), '[^0-9]', '', 'g') = ${phoneParam}
        )`);
      } else if (canMatchByEmail) {
        params.push(emailList);
        const emailParam = `$${params.length}`;
        where.push(`LOWER(BTRIM(COALESCE(g.email, ''))) = ANY(${emailParam}::text[])`);
      } else if (canMatchByPhone) {
        params.push(normalizedPhone);
        const phoneParam = `$${params.length}`;
        where.push(`regexp_replace(COALESCE(g.phone, ''), '[^0-9]', '', 'g') = ${phoneParam}`);
      }

      try {
        const legacyRes = await query(
          `SELECT
            g.id AS g_id,
            g.student_id,
            g.user_id,
            g.guardian_type,
            COALESCE(NULLIF(BTRIM(u.first_name), ''), NULLIF(BTRIM(g.first_name), '')) AS first_name,
            COALESCE(NULLIF(BTRIM(u.last_name), ''), NULLIF(BTRIM(g.last_name), '')) AS last_name,
            COALESCE(NULLIF(BTRIM(u.email), ''), NULLIF(BTRIM(g.email), '')) AS email,
            COALESCE(NULLIF(BTRIM(u.phone), ''), NULLIF(BTRIM(g.phone), '')) AS phone,
            COALESCE(NULLIF(BTRIM(u.occupation), ''), NULLIF(BTRIM(g.occupation), '')) AS occupation,
            g.created_at,
            g.modified_at AS updated_at,
            s.first_name AS student_first_name,
            s.last_name AS student_last_name,
            s.admission_number,
            s.roll_number,
            s.class_id,
            s.section_id,
            s.academic_year_id,
            c.class_name,
            sec.section_name
          FROM guardians g
          LEFT JOIN users u ON u.id = g.user_id
          INNER JOIN students s ON s.id = g.student_id
          LEFT JOIN classes c ON s.class_id = c.id
          LEFT JOIN sections sec ON s.section_id = sec.id
          WHERE ${where.join(' AND ')}
          ORDER BY s.first_name ASC, s.last_name ASC`,
          params
        );

        if (legacyRes.rows.length > 0) {
          return toPayload(legacyRes.rows);
        }
      } catch (legacyErr) {
        if (!isMissingGuardiansLegacyColumnError(legacyErr)) {
          throw legacyErr;
        }
      }
    }
  }

  return { parents: [], studentIds: [] };
}

module.exports = { getParentsForUser };
