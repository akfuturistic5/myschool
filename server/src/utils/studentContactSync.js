/**
 * Sync student ↔ guardian links (users as single source of contact data).
 * Replaces parents table + parent_persons FKs.
 */
const { ROLES } = require('../config/roles');
const {
  getContactUserById,
  ensureParentContactUser,
  ensureGuardianContactUser,
} = require('./contactUserService');

async function guardiansIsSlimSchema(client) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'guardians' AND column_name = 'first_name'
     LIMIT 1`
  );
  return r.rows.length === 0;
}

/**
 * Map guardian rows + users to legacy API field names for forms.
 */
function mapGuardianRowsToLegacyFields(rows) {
  const out = {
    father_name: '',
    father_email: '',
    father_phone: '',
    father_occupation: '',
    mother_name: '',
    mother_email: '',
    mother_phone: '',
    mother_occupation: '',
    guardian_first_name: '',
    guardian_last_name: '',
    guardian_relation: '',
    guardian_phone: '',
    guardian_email: '',
    guardian_occupation: '',
    guardian_address: '',
  };
  for (const row of rows) {
    const fn = (row.first_name || '').toString().trim();
    const ln = (row.last_name || '').toString().trim();
    const name = [fn, ln].filter(Boolean).join(' ').trim();
    const gt = (row.guardian_type || '').toString().toLowerCase();
    if (gt === 'father') {
      out.father_name = name;
      out.father_email = row.email || '';
      out.father_phone = row.phone || '';
      out.father_occupation = row.occupation || '';
    } else if (gt === 'mother') {
      out.mother_name = name;
      out.mother_email = row.email || '';
      out.mother_phone = row.phone || '';
      out.mother_occupation = row.occupation || '';
    } else {
      out.guardian_first_name = fn;
      out.guardian_last_name = ln;
      out.guardian_relation = row.relation || '';
      out.guardian_phone = row.phone || '';
      out.guardian_email = row.email || '';
      out.guardian_occupation = row.occupation || '';
      out.guardian_address = row.current_address || '';
    }
  }
  return out;
}

/**
 * Load guardian-linked users for a student (for GET /students/:id).
 * @param {function} query - db query(text, params)
 */
async function loadStudentContactLegacyFields(query, studentId) {
  const r = await query(
    `SELECT g.guardian_type, g.relation,
            u.first_name, u.last_name, u.email, u.phone, u.occupation, u.current_address
     FROM guardians g
     INNER JOIN users u ON u.id = g.user_id
     WHERE g.student_id = $1 AND g.is_active = true
     ORDER BY g.id ASC`,
    [studentId]
  );
  if (!r.rows.length) return null;
  return mapGuardianRowsToLegacyFields(r.rows);
}

/**
 * Resolve linked user id (father_person_id / mother_person_id / guardian_person_id in API = users.id).
 */
async function resolveLinkedUser(client, personId, allowedRoleIds) {
  if (!personId) return null;
  const prow = await getContactUserById(client, personId);
  if (!prow) {
    const err = new Error('Invalid contact user id');
    err.statusCode = 400;
    throw err;
  }
  if (allowedRoleIds.length && !allowedRoleIds.includes(Number(prow.role_id))) {
    const err = new Error('Contact user has wrong role for this slot');
    err.statusCode = 400;
    throw err;
  }
  return prow;
}

/**
 * Create or replace guardian rows for a student. Sets students.guardian_id to primary row.
 */
async function syncStudentGuardians(client, studentId, payload, warnings) {
  const slim = await guardiansIsSlimSchema(client);
  if (!slim) {
    const err = new Error(
      'Database not migrated: run npm run db:migrate:unify (guardians still has legacy columns)'
    );
    err.statusCode = 503;
    throw err;
  }

  const {
    effFatherName,
    effFatherEmail,
    effFatherPhone,
    effFatherOcc,
    effMotherName,
    effMotherEmail,
    effMotherPhone,
    effMotherOcc,
    effGFirst,
    effGLast,
    effGPhone,
    effGEmail,
    effGOcc,
    effGAddr,
    effGRel,
    fatherUserId: inFatherUid,
    motherUserId: inMotherUid,
    guardianUserId: inGuardianUid,
  } = payload;

  let fatherUserId = inFatherUid || null;
  let motherUserId = inMotherUid || null;
  let guardianUserId = inGuardianUid || null;

  const hasFather =
    effFatherName || effFatherEmail || effFatherPhone || effFatherOcc;
  const hasMother =
    effMotherName || effMotherEmail || effMotherPhone || effMotherOcc;
  const gFull = [effGFirst, effGLast].filter(Boolean).join(' ').trim();
  const hasG = gFull || effGPhone || effGEmail || effGOcc || effGRel;

  if (hasFather && !fatherUserId) {
    fatherUserId = await ensureParentContactUser(
      client,
      {
        full_name: effFatherName || 'Father',
        email: effFatherEmail,
        phone: effFatherPhone,
        occupation: effFatherOcc,
      },
      warnings,
      'Father'
    );
  }
  if (hasMother && !motherUserId) {
    motherUserId = await ensureParentContactUser(
      client,
      {
        full_name: effMotherName || 'Mother',
        email: effMotherEmail,
        phone: effMotherPhone,
        occupation: effMotherOcc,
      },
      warnings,
      'Mother'
    );
  }
  if (hasG && !guardianUserId) {
    guardianUserId = await ensureGuardianContactUser(
      client,
      {
        first_name: effGFirst || 'Guardian',
        last_name: effGLast || '',
        email: effGEmail,
        phone: effGPhone,
        occupation: effGOcc,
        address: effGAddr,
      },
      warnings
    );
  }

  await client.query(`DELETE FROM guardians WHERE student_id = $1`, [studentId]);

  const rows = [];
  if (fatherUserId) {
    rows.push({
      uid: fatherUserId,
      type: 'father',
      rel: 'Father',
    });
  }
  if (motherUserId) {
    rows.push({
      uid: motherUserId,
      type: 'mother',
      rel: 'Mother',
    });
  }
  if (guardianUserId) {
    rows.push({
      uid: guardianUserId,
      type: 'guardian',
      rel: effGRel || 'Guardian',
    });
  }

  const primaryType = guardianUserId ? 'guardian' : fatherUserId ? 'father' : motherUserId ? 'mother' : null;

  let primaryId = null;
  for (const row of rows) {
    const isPrimary = primaryType ? row.type === primaryType : rows.length === 1;
    const ins = await client.query(
      `INSERT INTO guardians (
        student_id, user_id, guardian_type, relation,
        is_primary_contact, is_emergency_contact, is_active, created_at, modified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      RETURNING id`,
      [studentId, row.uid, row.type, row.rel, isPrimary, false]
    );
    if (isPrimary) primaryId = ins.rows[0].id;
  }
  if (!primaryId && rows.length > 0) {
    const firstG = await client.query(
      `SELECT id FROM guardians WHERE student_id = $1 ORDER BY id ASC LIMIT 1`,
      [studentId]
    );
    primaryId = firstG.rows[0]?.id || null;
  }

  if (primaryId) {
    await client.query(
      `UPDATE students SET guardian_id = $1, modified_at = NOW() WHERE id = $2`,
      [primaryId, studentId]
    );
    await client.query(
      `UPDATE guardians SET is_primary_contact = (id = $1), modified_at = NOW() WHERE student_id = $2`,
      [primaryId, studentId]
    );
  } else {
    await client.query(
      `UPDATE students SET guardian_id = NULL, modified_at = NOW() WHERE id = $1`,
      [studentId]
    );
  }

  return {
    fatherUserId,
    motherUserId,
    guardianUserId,
    primaryGuardianId: primaryId,
  };
}

/**
 * For edit form: father_person_id / mother_person_id / guardian_person_id = users.id
 */
async function loadStudentLinkedUserIds(query, studentId) {
  const r = await query(
    `SELECT guardian_type, user_id FROM guardians WHERE student_id = $1 AND is_active = true`,
    [studentId]
  );
  const out = {
    father_person_id: null,
    mother_person_id: null,
    guardian_person_id: null,
  };
  for (const row of r.rows) {
    const t = (row.guardian_type || '').toString().toLowerCase();
    if (t === 'father') out.father_person_id = row.user_id;
    else if (t === 'mother') out.mother_person_id = row.user_id;
    else if (t === 'guardian' || t === 'other') out.guardian_person_id = row.user_id;
  }
  return out;
}

/** List/detail SQL: contact fields from guardians + users (post-unify schema). */
const STUDENT_CONTACT_LATERAL_SELECT = `
      NULLIF(TRIM(CONCAT(COALESCE(father_u.first_name,''), ' ', COALESCE(father_u.last_name,''))), '') AS father_name,
      father_u.email AS father_email,
      father_u.phone AS father_phone,
      father_u.occupation AS father_occupation,
      NULLIF(TRIM(CONCAT(COALESCE(mother_u.first_name,''), ' ', COALESCE(mother_u.last_name,''))), '') AS mother_name,
      mother_u.email AS mother_email,
      mother_u.phone AS mother_phone,
      mother_u.occupation AS mother_occupation,
      gu_u.first_name AS guardian_first_name,
      gu_u.last_name AS guardian_last_name,
      gu_u.phone AS guardian_phone,
      gu_u.email AS guardian_email,
      gu_u.occupation AS guardian_occupation,
      gu_u.relation AS guardian_relation,
      gu_u.current_address AS guardian_address`;

const STUDENT_CONTACT_LATERAL_JOINS = `
      LEFT JOIN LATERAL (
        SELECT u.first_name, u.last_name, u.email, u.phone, u.occupation
        FROM guardians g
        JOIN users u ON u.id = g.user_id
        WHERE g.student_id = s.id AND g.is_active = true AND LOWER(COALESCE(g.guardian_type::text,'')) = 'father'
        ORDER BY g.id ASC LIMIT 1
      ) father_u ON true
      LEFT JOIN LATERAL (
        SELECT u.first_name, u.last_name, u.email, u.phone, u.occupation
        FROM guardians g
        JOIN users u ON u.id = g.user_id
        WHERE g.student_id = s.id AND g.is_active = true AND LOWER(COALESCE(g.guardian_type::text,'')) = 'mother'
        ORDER BY g.id ASC LIMIT 1
      ) mother_u ON true
      LEFT JOIN LATERAL (
        SELECT u.first_name, u.last_name, u.email, u.phone, u.occupation, g.relation, u.current_address
        FROM guardians g
        JOIN users u ON u.id = g.user_id
        WHERE g.student_id = s.id AND g.is_active = true AND LOWER(COALESCE(g.guardian_type::text,'')) = 'guardian'
        ORDER BY g.id ASC LIMIT 1
      ) gu_u ON true`;

module.exports = {
  guardiansIsSlimSchema,
  loadStudentContactLegacyFields,
  loadStudentLinkedUserIds,
  mapGuardianRowsToLegacyFields,
  resolveLinkedUser,
  syncStudentGuardians,
  STUDENT_CONTACT_LATERAL_SELECT,
  STUDENT_CONTACT_LATERAL_JOINS,
};
