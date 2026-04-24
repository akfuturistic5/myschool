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
  const readFromUnifiedGuardians = async () => {
    try {
      return await query(
        `SELECT g.guardian_type, g.relation,
                u.first_name, u.last_name, u.email, u.phone, u.occupation, u.current_address
         FROM guardians g
         INNER JOIN users u ON u.id = g.user_id
         WHERE g.student_id = $1 AND g.is_active = true
         ORDER BY g.id ASC`,
        [studentId]
      );
    } catch (_) {
      // Backward-compatible fallback for older users schema.
      return await query(
        `SELECT g.guardian_type, g.relation,
                u.first_name, u.last_name, u.email, u.phone,
                NULL::text AS occupation,
                COALESCE(u.current_address, u.permanent_address) AS current_address
         FROM guardians g
         INNER JOIN users u ON u.id = g.user_id
         WHERE g.student_id = $1 AND g.is_active = true
         ORDER BY g.id ASC`,
        [studentId]
      );
    }
  };

  let merged = {
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

  const unifiedRows = await readFromUnifiedGuardians();
  if (Array.isArray(unifiedRows?.rows) && unifiedRows.rows.length > 0) {
    merged = { ...merged, ...mapGuardianRowsToLegacyFields(unifiedRows.rows) };
  }

  // Legacy fallback: pull father/mother from old parents table when present.
  try {
    const pr = await query(
      `SELECT
          father_name, father_email, father_phone, father_occupation,
          mother_name, mother_email, mother_phone, mother_occupation
       FROM parents
       WHERE student_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [studentId]
    );
    if (pr.rows.length > 0) {
      const p = pr.rows[0];
      merged.father_name = merged.father_name || p.father_name || '';
      merged.father_email = merged.father_email || p.father_email || '';
      merged.father_phone = merged.father_phone || p.father_phone || '';
      merged.father_occupation = merged.father_occupation || p.father_occupation || '';
      merged.mother_name = merged.mother_name || p.mother_name || '';
      merged.mother_email = merged.mother_email || p.mother_email || '';
      merged.mother_phone = merged.mother_phone || p.mother_phone || '';
      merged.mother_occupation = merged.mother_occupation || p.mother_occupation || '';
    }
  } catch (_) {
    // parents table may not exist in fully unified deployments.
  }

  // Legacy fallback: old guardians schema where contact fields were stored directly in guardians.
  try {
    const gr = await query(
      `SELECT
          guardian_type,
          relation,
          first_name,
          last_name,
          email,
          phone,
          occupation,
          address AS current_address
       FROM guardians
       WHERE student_id = $1 AND is_active = true
       ORDER BY id ASC`,
      [studentId]
    );
    if (gr.rows.length > 0) {
      const legacyMapped = mapGuardianRowsToLegacyFields(gr.rows);
      merged = {
        ...legacyMapped,
        ...merged,
        father_name: merged.father_name || legacyMapped.father_name || '',
        father_email: merged.father_email || legacyMapped.father_email || '',
        father_phone: merged.father_phone || legacyMapped.father_phone || '',
        father_occupation: merged.father_occupation || legacyMapped.father_occupation || '',
        mother_name: merged.mother_name || legacyMapped.mother_name || '',
        mother_email: merged.mother_email || legacyMapped.mother_email || '',
        mother_phone: merged.mother_phone || legacyMapped.mother_phone || '',
        mother_occupation: merged.mother_occupation || legacyMapped.mother_occupation || '',
        guardian_first_name: merged.guardian_first_name || legacyMapped.guardian_first_name || '',
        guardian_last_name: merged.guardian_last_name || legacyMapped.guardian_last_name || '',
        guardian_relation: merged.guardian_relation || legacyMapped.guardian_relation || '',
        guardian_phone: merged.guardian_phone || legacyMapped.guardian_phone || '',
        guardian_email: merged.guardian_email || legacyMapped.guardian_email || '',
        guardian_occupation: merged.guardian_occupation || legacyMapped.guardian_occupation || '',
        guardian_address: merged.guardian_address || legacyMapped.guardian_address || '',
      };
    }
  } catch (_) {
    // Legacy columns are absent in slim schema; ignore.
  }

  const hasAny =
    merged.father_name ||
    merged.father_email ||
    merged.father_phone ||
    merged.mother_name ||
    merged.mother_email ||
    merged.mother_phone ||
    merged.guardian_first_name ||
    merged.guardian_last_name ||
    merged.guardian_phone ||
    merged.guardian_email;
  return hasAny ? merged : null;
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

  // --- Cross-entity duplicate email check ---
  // Emails must be unique across father / mother / guardian slots.
  // If two slots share the same email we throw immediately so the transaction
  // rolls back and the caller gets a 409 rather than silently corrupting data.
  const emailSlots = [
    { label: 'Father', email: (effFatherEmail || '').trim().toLowerCase() },
    { label: 'Mother', email: (effMotherEmail || '').trim().toLowerCase() },
    { label: 'Guardian', email: (effGEmail || '').trim().toLowerCase() },
  ].filter(s => s.email !== '');

  const seenEmails = new Map();
  for (const { label, email } of emailSlots) {
    if (seenEmails.has(email)) {
      const firstLabel = seenEmails.get(email);
      const err = new Error(
        `Email "${email}" is already used for ${firstLabel}. Each contact (Father, Mother, Guardian) must have a unique email.`
      );
      err.statusCode = 409;
      throw err;
    }
    seenEmails.set(email, label);
  }
  // --- End cross-entity duplicate email check ---

  if (hasFather) {
    fatherUserId = await ensureParentContactUser(
      client,
      {
        id: fatherUserId,
        full_name: effFatherName || 'Father',
        email: effFatherEmail,
        phone: effFatherPhone,
        occupation: effFatherOcc,
      },
      warnings,
      'Father'
    );
  }
  if (hasMother) {
    motherUserId = await ensureParentContactUser(
      client,
      {
        id: motherUserId,
        full_name: effMotherName || 'Mother',
        email: effMotherEmail,
        phone: effMotherPhone,
        occupation: effMotherOcc,
      },
      warnings,
      'Mother'
    );
  }
  if (hasG) {
    guardianUserId = await ensureGuardianContactUser(
      client,
      {
        id: guardianUserId,
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

  // Nullify current link first to avoid FK constraint on delete
  await client.query(`UPDATE students SET guardian_id = NULL WHERE id = $1`, [studentId]);
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
      father_u.user_id AS father_person_id,
      COALESCE(
        NULLIF(TRIM(CONCAT(COALESCE(father_u.first_name,''), ' ', COALESCE(father_u.last_name,''))), ''),
        NULLIF(TRIM(COALESCE(legacy_parent.father_name, '')), '')
      ) AS father_name,
      COALESCE(father_u.email, legacy_parent.father_email) AS father_email,
      COALESCE(father_u.phone, legacy_parent.father_phone) AS father_phone,
      COALESCE(father_u.occupation, legacy_parent.father_occupation) AS father_occupation,
      COALESCE(father_u.avatar, legacy_parent.father_image_url) AS father_image_url,
      mother_u.user_id AS mother_person_id,
      COALESCE(
        NULLIF(TRIM(CONCAT(COALESCE(mother_u.first_name,''), ' ', COALESCE(mother_u.last_name,''))), ''),
        NULLIF(TRIM(COALESCE(legacy_parent.mother_name, '')), '')
      ) AS mother_name,
      COALESCE(mother_u.email, legacy_parent.mother_email) AS mother_email,
      COALESCE(mother_u.phone, legacy_parent.mother_phone) AS mother_phone,
      COALESCE(mother_u.occupation, legacy_parent.mother_occupation) AS mother_occupation,
      COALESCE(mother_u.avatar, legacy_parent.mother_image_url) AS mother_image_url,
      gu_u.user_id AS guardian_person_id,
      gu_u.first_name AS guardian_first_name,
      gu_u.last_name AS guardian_last_name,
      gu_u.phone AS guardian_phone,
      gu_u.email AS guardian_email,
      gu_u.occupation AS guardian_occupation,
      gu_u.relation AS guardian_relation,
      gu_u.current_address AS guardian_address,
      gu_u.avatar AS guardian_image_url`;

const STUDENT_CONTACT_LATERAL_JOINS = `
      LEFT JOIN LATERAL (
        SELECT
          p.father_name,
          p.father_email,
          p.father_phone,
          p.father_occupation,
          p.father_image_url,
          p.mother_name,
          p.mother_email,
          p.mother_phone,
          p.mother_occupation,
          p.mother_image_url
        FROM parents p
        WHERE p.student_id = s.id
        ORDER BY p.id DESC
        LIMIT 1
      ) legacy_parent ON true
      LEFT JOIN LATERAL (
        SELECT u.id AS user_id, u.first_name, u.last_name, u.email, u.phone, u.occupation, u.avatar
        FROM guardians g
        JOIN users u ON u.id = g.user_id
        WHERE g.student_id = s.id
          AND g.is_active = true
          AND (
            LOWER(BTRIM(COALESCE(g.guardian_type::text,''))) IN ('father', 'dad', 'papa', 'abbu')
            OR LOWER(BTRIM(COALESCE(g.relation::text,''))) IN ('father', 'dad', 'papa', 'abbu')
            OR u.role_id = ${ROLES.PARENT}
          )
        ORDER BY
          CASE
            WHEN LOWER(BTRIM(COALESCE(g.guardian_type::text,''))) IN ('father', 'dad', 'papa', 'abbu') THEN 0
            WHEN LOWER(BTRIM(COALESCE(g.relation::text,''))) IN ('father', 'dad', 'papa', 'abbu') THEN 1
            WHEN u.role_id = ${ROLES.PARENT} THEN 2
            ELSE 9
          END,
          g.id ASC
        LIMIT 1
      ) father_u ON true
      LEFT JOIN LATERAL (
        SELECT u.id AS user_id, u.first_name, u.last_name, u.email, u.phone, u.occupation, u.avatar
        FROM guardians g
        JOIN users u ON u.id = g.user_id
        WHERE g.student_id = s.id
          AND g.is_active = true
          AND (
            LOWER(BTRIM(COALESCE(g.guardian_type::text,''))) IN ('mother', 'mom', 'mummy', 'ammi')
            OR LOWER(BTRIM(COALESCE(g.relation::text,''))) IN ('mother', 'mom', 'mummy', 'ammi')
          )
        ORDER BY g.id ASC LIMIT 1
      ) mother_u ON true
      LEFT JOIN LATERAL (
        SELECT u.id AS user_id, u.first_name, u.last_name, u.email, u.phone, u.occupation, g.relation, u.current_address, u.avatar
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
