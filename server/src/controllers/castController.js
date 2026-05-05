const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { sanitizeChatText } = require('../utils/htmlSanitize');
const { userCanManageMasterData, parseMasterDescription } = require('../utils/masterDataAdminGate');

const normalizeCastName = (value) => sanitizeChatText(value).replace(/\s+/g, ' ');

const parseId = (raw) => {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseOptionalReligionId = (raw) => {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };
  if (raw === 'null' || raw === 'undefined') return { ok: true, value: null };
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, value: null };
  return { ok: true, value: id };
};

const parseBooleanInput = (value, defaultValue = true) => {
  if (value === undefined || value === null) return { ok: true, value: defaultValue };
  if (typeof value === 'boolean') return { ok: true, value };
  if (value === 1 || value === '1' || String(value).toLowerCase() === 'true') return { ok: true, value: true };
  if (value === 0 || value === '0' || String(value).toLowerCase() === 'false') return { ok: true, value: false };
  return { ok: false, value: defaultValue };
};

const getAllCasts = async (req, res) => {
  try {
    const requestedInactive = String(req.query?.include_inactive || '').trim() === '1';
    const includeInactive = userCanManageMasterData(req) && requestedInactive;

    const result = await query(
      `
      SELECT
        c.id,
        c.cast_name,
        c.religion_id,
        r.religion_name AS religion_name,
        c.description,
        c.is_active,
        c.created_at,
        c.updated_at
      FROM casts c
      LEFT JOIN religions r ON r.id = c.religion_id
      ${includeInactive ? '' : 'WHERE c.is_active = true'}
      ORDER BY c.cast_name ASC
    `
    );

    return success(res, 200, 'Casts fetched successfully', result.rows, {
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching casts:', error);
    return errorResponse(res, 500, 'Failed to fetch casts');
  }
};

const getCastById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid cast id');

    const result = await query(
      `
      SELECT
        c.id,
        c.cast_name,
        c.religion_id,
        r.religion_name AS religion_name,
        c.description,
        c.is_active,
        c.created_at,
        c.updated_at
      FROM casts c
      LEFT JOIN religions r ON r.id = c.religion_id
      WHERE c.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Cast not found');
    }

    return success(res, 200, 'Cast fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching cast:', error);
    return errorResponse(res, 500, 'Failed to fetch cast');
  }
};

const createCast = async (req, res) => {
  try {
    const castName = normalizeCastName(req.body?.cast_name);
    const parsedDesc = parseMasterDescription(req.body?.description);
    if (!parsedDesc.ok) return errorResponse(res, 400, parsedDesc.message);
    const description = parsedDesc.value;
    const parsedIsActive = parseBooleanInput(req.body?.is_active, true);
    if (!parsedIsActive.ok) return errorResponse(res, 400, 'is_active must be a boolean');
    const isActive = parsedIsActive.value;
    const parsedReligion = parseOptionalReligionId(req.body?.religion_id);
    if (!parsedReligion.ok) return errorResponse(res, 400, 'religion_id must be a positive integer or empty');
    const religionId = parsedReligion.value;

    if (!castName) return errorResponse(res, 400, 'cast_name is required');
    if (castName.length > 100) return errorResponse(res, 400, 'cast_name must be 100 characters or fewer');

    if (religionId != null) {
      const rel = await query(
        `SELECT id FROM religions WHERE id = $1 AND is_active = true LIMIT 1`,
        [religionId]
      );
      if (rel.rows.length === 0) {
        return errorResponse(res, 400, 'religion_id must reference an active religion');
      }
    }

    const duplicate = await query(
      `SELECT id FROM casts WHERE LOWER(cast_name) = LOWER($1) LIMIT 1`,
      [castName]
    );
    if (duplicate.rows.length > 0) {
      return errorResponse(res, 409, 'A cast with this name already exists');
    }

    const uid = req.user?.id || null;
    const result = await query(
      `INSERT INTO casts (cast_name, religion_id, description, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING id, cast_name, religion_id, description, is_active, created_at, updated_at`,
      [castName, religionId, description, isActive, uid]
    );

    let row = result.rows[0];
    if (row.religion_id != null) {
      const rn = await query(`SELECT religion_name FROM religions WHERE id = $1`, [row.religion_id]);
      row = { ...row, religion_name: rn.rows[0]?.religion_name ?? null };
    } else {
      row = { ...row, religion_name: null };
    }

    return success(res, 201, 'Cast created successfully', row);
  } catch (error) {
    console.error('Error creating cast:', error);
    return errorResponse(res, 500, 'Failed to create cast');
  }
};

const updateCast = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid cast id');

    const castName = normalizeCastName(req.body?.cast_name);
    const parsedDesc = parseMasterDescription(req.body?.description);
    if (!parsedDesc.ok) return errorResponse(res, 400, parsedDesc.message);
    const description = parsedDesc.value;
    const parsedIsActive = parseBooleanInput(req.body?.is_active, true);
    if (!parsedIsActive.ok) return errorResponse(res, 400, 'is_active must be a boolean');
    const isActive = parsedIsActive.value;
    const parsedReligion = parseOptionalReligionId(req.body?.religion_id);
    if (!parsedReligion.ok) return errorResponse(res, 400, 'religion_id must be a positive integer or empty');
    const religionId = parsedReligion.value;

    if (!castName) return errorResponse(res, 400, 'cast_name is required');
    if (castName.length > 100) return errorResponse(res, 400, 'cast_name must be 100 characters or fewer');

    if (religionId != null) {
      const rel = await query(
        `SELECT id FROM religions WHERE id = $1 AND is_active = true LIMIT 1`,
        [religionId]
      );
      if (rel.rows.length === 0) {
        return errorResponse(res, 400, 'religion_id must reference an active religion');
      }
    }

    const duplicate = await query(
      `SELECT id FROM casts WHERE LOWER(cast_name) = LOWER($1) AND id <> $2 LIMIT 1`,
      [castName, id]
    );
    if (duplicate.rows.length > 0) {
      return errorResponse(res, 409, 'A cast with this name already exists');
    }

    const uid = req.user?.id || null;
    const updated = await query(
      `UPDATE casts
       SET cast_name = $1,
           religion_id = $2,
           description = $3,
           is_active = $4,
           updated_at = NOW(),
           updated_by = $5
       WHERE id = $6
       RETURNING id, cast_name, religion_id, description, is_active, created_at, updated_at`,
      [castName, religionId, description, isActive, uid, id]
    );

    if (updated.rows.length === 0) {
      return errorResponse(res, 404, 'Cast not found');
    }

    let row = updated.rows[0];
    if (row.religion_id != null) {
      const rn = await query(`SELECT religion_name FROM religions WHERE id = $1`, [row.religion_id]);
      row = { ...row, religion_name: rn.rows[0]?.religion_name ?? null };
    } else {
      row = { ...row, religion_name: null };
    }

    return success(res, 200, 'Cast updated successfully', row);
  } catch (error) {
    console.error('Error updating cast:', error);
    return errorResponse(res, 500, 'Failed to update cast');
  }
};

const toggleCastStatus = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid cast id');

    const uid = req.user?.id || null;
    const result = await query(
      `UPDATE casts
       SET is_active = NOT is_active,
           updated_at = NOW(),
           updated_by = $2
       WHERE id = $1
       RETURNING id, cast_name, religion_id, description, is_active, created_at, updated_at`,
      [id, uid]
    );
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Cast not found');
    }

    let row = result.rows[0];
    if (row.religion_id != null) {
      const rn = await query(`SELECT religion_name FROM religions WHERE id = $1`, [row.religion_id]);
      row = { ...row, religion_name: rn.rows[0]?.religion_name ?? null };
    } else {
      row = { ...row, religion_name: null };
    }

    return success(res, 200, 'Cast status updated successfully', row);
  } catch (error) {
    console.error('Error toggling cast status:', error);
    return errorResponse(res, 500, 'Failed to update cast status');
  }
};

const deleteCast = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid cast id');

    const exists = await query(`SELECT id FROM casts WHERE id = $1`, [id]);
    if (exists.rows.length === 0) {
      return errorResponse(res, 404, 'Cast not found');
    }

    const studentRef = await query(
      `SELECT COUNT(*)::int AS count FROM students WHERE cast_id = $1`,
      [id]
    );
    const refs = studentRef.rows[0]?.count || 0;
    if (refs > 0) {
      return errorResponse(
        res,
        409,
        'Cast is assigned to students and cannot be deleted. Deactivate it instead.'
      );
    }

    await query(`DELETE FROM casts WHERE id = $1`, [id]);
    return success(res, 200, 'Cast deleted successfully');
  } catch (error) {
    console.error('Error deleting cast:', error);
    return errorResponse(res, 500, 'Failed to delete cast');
  }
};

module.exports = {
  getAllCasts,
  getCastById,
  createCast,
  updateCast,
  toggleCastStatus,
  deleteCast,
};
