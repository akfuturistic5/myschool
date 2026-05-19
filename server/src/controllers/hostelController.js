const { query, executeTransaction } = require('../config/database');
const { success, errorResponse } = require('../utils/responseHelper');

const normalizeGenderFromLegacyType = (t) => {
  if (t == null || t === '') return null;
  const s = String(t).trim().toLowerCase();
  if (['boys', 'girls', 'mixed'].includes(s)) return s;
  return null;
};

const normalizeHostelCategory = (v) => {
  if (v == null || v === '') return 'student';
  const s = String(v).trim().toLowerCase();
  if (s === 'student' || s === 'staff') return s;
  return null;
};

const buildCodeSlug = (name) => {
  const slug = String(name)
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 40)
    .toUpperCase();
  return slug || 'HOSTEL';
};

const allocateUniqueHostelCode = async (base) => {
  for (let i = 0; i < 100; i += 1) {
    const c = i === 0 ? base : `${base}_${i}`;
    const ch = await query(`SELECT id FROM hostels WHERE code = $1 AND deleted_at IS NULL LIMIT 1`, [c]);
    if (ch.rows.length === 0) return c;
  }
  throw new Error('Could not allocate unique hostel code');
};

const listFrom = `
  SELECT
    h.*,
    h.gender AS hostel_type
  FROM hostels h
`;

const getAllHostels = async (req, res) => {
  try {
    const includeInactive =
      req.query.include_inactive === 'true' || req.query.include_inactive === '1';
    const where = includeInactive ? 'WHERE h.deleted_at IS NULL' : 'WHERE h.deleted_at IS NULL AND h.is_active = true';
    const sql = `${listFrom} ${where} ORDER BY h.hostel_name ASC`;
    const result = await query(sql);
    return success(res, 200, 'Hostels fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching hostels:', error);
    return errorResponse(res, 500, 'Failed to fetch hostels');
  }
};

const getHostelById = async (req, res) => {
  try {
    const { id } = req.params;

    const rowResult = await query(
      `
      SELECT
        h.*,
        h.gender AS hostel_type
      FROM hostels h
      WHERE h.id = $1 AND h.deleted_at IS NULL
      `,
      [id]
    );

    if (rowResult.rows.length === 0) {
      return errorResponse(res, 404, 'Hostel not found');
    }

    return success(res, 200, 'Hostel fetched successfully', rowResult.rows[0]);
  } catch (error) {
    console.error('Error fetching hostel:', error);
    return errorResponse(res, 500, 'Failed to fetch hostel');
  }
};

const createHostel = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      hostel_name,
      hostel_category,
      gender,
      hostel_type,
      address,
      intake_capacity,
      description,
      total_floors,
      contact_number,
      email,
      facilities,
      rules,
      warden_user_id,
      code,
      is_active: isActiveBody,
    } = body;

    if (!hostel_name || String(hostel_name).trim() === '') {
      return errorResponse(res, 400, 'hostel_name is required');
    }

    const hc = normalizeHostelCategory(hostel_category ?? body.category);
    if (!hc) {
      return errorResponse(res, 400, 'hostel_category must be student or staff');
    }

    const g = normalizeGenderFromLegacyType(gender ?? hostel_type);
    if (!g) {
      return errorResponse(res, 400, 'gender must be boys, girls, or mixed (or send legacy hostel_type with the same values)');
    }

    const floors =
      total_floors !== undefined && total_floors !== null && total_floors !== ''
        ? Number(total_floors)
        : 1;

    let intake =
      intake_capacity !== undefined && intake_capacity !== null && intake_capacity !== ''
        ? Number(intake_capacity)
        : null;

    let wUid =
      warden_user_id !== undefined && warden_user_id !== null && warden_user_id !== ''
        ? Number(warden_user_id)
        : null;
    if (wUid !== null && Number.isNaN(wUid)) wUid = null;
    if (wUid !== null) {
      const w = await query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [wUid]);
      if (!w.rows.length) return errorResponse(res, 400, 'Invalid warden_user_id');
    }

    const finalCodeRaw = code != null && String(code).trim() !== '' ? String(code).trim().toUpperCase() : null;

    let isActiveCreate = true;
    if (isActiveBody !== undefined && isActiveBody !== null && isActiveBody !== '') {
      const s = String(isActiveBody).trim().toLowerCase();
      if (s === 'false' || s === '0') isActiveCreate = false;
      if (s === 'true' || s === '1') isActiveCreate = true;
    }

    const row = await executeTransaction(async (client) => {
      const finalCode = finalCodeRaw || (await allocateUniqueHostelCode(buildCodeSlug(hostel_name)));
      const ch = await client.query(
        `
        INSERT INTO hostels (
          hostel_name, code, hostel_category, gender, address,
          total_floors, intake_capacity, warden_user_id, contact_number, email,
          description, facilities, rules, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
        `,
        [
          String(hostel_name).trim(),
          finalCode,
          hc,
          g,
          address != null ? String(address) : null,
          floors != null && !Number.isNaN(floors) && floors >= 1 ? floors : 1,
          intake != null && !Number.isNaN(intake) ? intake : null,
          wUid,
          contact_number != null ? String(contact_number) : null,
          email != null ? String(email) : null,
          description != null ? String(description) : null,
          facilities != null ? String(facilities) : null,
          rules != null ? String(rules) : null,
          isActiveCreate,
        ]
      );

      const newHostel = ch.rows[0];
      await client.query(
        `
        INSERT INTO hostel_floors (hostel_id, floor_name, floor_number, is_active)
        VALUES ($1, 'Ground floor', $2, true)
        `,
        [newHostel.id, 0]
      );

      return newHostel;
    });

    const fresh = await query(
      `
      SELECT h.*, h.gender AS hostel_type
      FROM hostels h
      WHERE h.id = $1
      `,
      [row.id]
    );

    return success(res, 201, 'Hostel created successfully', fresh.rows[0]);
  } catch (error) {
    console.error('Error creating hostel:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Hostel name or code already exists');
    }
    return errorResponse(res, 500, 'Failed to create hostel', error.message);
  }
};

const updateHostel = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const updates = [];
    const params = [];
    let idx = 1;

    if (body.hostel_name !== undefined && body.hostel_name !== null) {
      updates.push(`hostel_name = $${idx++}`);
      params.push(String(body.hostel_name).trim());
    }
    if (body.code !== undefined && body.code !== null) {
      updates.push(`code = $${idx++}`);
      params.push(String(body.code).trim().toUpperCase());
    }
    if (body.hostel_category !== undefined || body.category !== undefined) {
      const hc = normalizeHostelCategory(body.hostel_category ?? body.category);
      if (!hc) return errorResponse(res, 400, 'hostel_category must be student or staff');
      updates.push(`hostel_category = $${idx++}`);
      params.push(hc);
    }
    if (body.gender !== undefined || body.hostel_type !== undefined) {
      const g = normalizeGenderFromLegacyType(body.gender ?? body.hostel_type);
      if (!g) return errorResponse(res, 400, 'gender must be boys, girls, or mixed');
      updates.push(`gender = $${idx++}`);
      params.push(g);
    }
    if (body.address !== undefined) {
      updates.push(`address = $${idx++}`);
      params.push(body.address);
    }
    if (body.total_floors !== undefined) {
      const f = Number(body.total_floors);
      updates.push(`total_floors = $${idx++}`);
      params.push(!Number.isNaN(f) && f >= 1 ? f : 1);
    }
    if (body.intake_capacity !== undefined) {
      const intake =
        body.intake_capacity !== null && body.intake_capacity !== ''
          ? Number(body.intake_capacity)
          : null;
      updates.push(`intake_capacity = $${idx++}`);
      params.push(intake != null && !Number.isNaN(intake) ? intake : null);
    }
    if (body.contact_number !== undefined) {
      updates.push(`contact_number = $${idx++}`);
      params.push(body.contact_number);
    }
    if (body.email !== undefined) {
      updates.push(`email = $${idx++}`);
      params.push(body.email);
    }
    if (body.description !== undefined) {
      updates.push(`description = $${idx++}`);
      params.push(body.description);
    }
    if (body.facilities !== undefined) {
      updates.push(`facilities = $${idx++}`);
      params.push(body.facilities);
    }
    if (body.rules !== undefined) {
      updates.push(`rules = $${idx++}`);
      params.push(body.rules);
    }
    if (body.warden_user_id !== undefined) {
      let wUid =
        body.warden_user_id !== null && body.warden_user_id !== '' ? Number(body.warden_user_id) : null;
      if (wUid !== null && Number.isNaN(wUid)) wUid = null;
      if (wUid !== null) {
        const w = await query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [wUid]);
        if (!w.rows.length) return errorResponse(res, 400, 'Invalid warden_user_id');
      }
      updates.push(`warden_user_id = $${idx++}`);
      params.push(wUid);
    }
    if (body.is_active !== undefined && body.is_active !== null && body.is_active !== '') {
      const s = String(body.is_active).trim().toLowerCase();
      const ia = !(s === 'false' || s === '0');
      updates.push(`is_active = $${idx++}`);
      params.push(ia);
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    const result = await query(
      `
      UPDATE hostels
      SET ${updates.join(', ')}
      WHERE id = $${idx} AND deleted_at IS NULL
      RETURNING *
      `,
      params
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Hostel not found');
    }

    const fresh = await query(
      `
      SELECT h.*, h.gender AS hostel_type
      FROM hostels h
      WHERE h.id = $1
      `,
      [id]
    );

    return success(res, 200, 'Hostel updated successfully', fresh.rows[0]);
  } catch (error) {
    console.error('Error updating hostel:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Duplicate hostel name or code');
    }
    return errorResponse(res, 500, 'Failed to update hostel');
  }
};

const deleteHostel = async (req, res) => {
  try {
    const { id } = req.params;

    const assigns = await query(
      `
      SELECT COUNT(*)::int AS c
      FROM hostel_assignments
      WHERE hostel_id = $1 AND assignment_status = 'active' AND deleted_at IS NULL
      `,
      [id]
    );
    if (assigns.rows[0]?.c > 0) {
      return errorResponse(
        res,
        409,
        'Cannot deactivate hostel while there are active hostel assignments'
      );
    }

    await query(`UPDATE hostel_rooms SET is_active = false, updated_at = NOW() WHERE hostel_id = $1 AND deleted_at IS NULL`, [
      id,
    ]);

    const result = await query(
      `
      UPDATE hostels
      SET is_active = false, deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL AND is_active = true
      RETURNING id
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Hostel not found');
    }

    return success(res, 200, 'Hostel deleted successfully', { id: Number(id) });
  } catch (error) {
    console.error('Error deleting hostel:', error);
    return errorResponse(res, 500, 'Failed to delete hostel');
  }
};

module.exports = {
  getAllHostels,
  getHostelById,
  createHostel,
  updateHostel,
  deleteHostel,
};
