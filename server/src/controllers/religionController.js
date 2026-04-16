const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { sanitizeChatText } = require('../utils/htmlSanitize');
const { ADMIN_ROLE_IDS } = require('../config/roles');

const normalizeReligionName = (value) => sanitizeChatText(value).replace(/\s+/g, ' ');

const parseId = (raw) => {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const parseBooleanInput = (value, defaultValue = true) => {
  if (value === undefined || value === null) return { ok: true, value: defaultValue };
  if (typeof value === 'boolean') return { ok: true, value };
  if (value === 1 || value === '1' || String(value).toLowerCase() === 'true') return { ok: true, value: true };
  if (value === 0 || value === '0' || String(value).toLowerCase() === 'false') return { ok: true, value: false };
  return { ok: false, value: defaultValue };
};

// Get all religions
const getAllReligions = async (req, res) => {
  try {
    const roleId = Number.parseInt(req.user?.role_id, 10);
    const isAdmin = Number.isInteger(roleId) && ADMIN_ROLE_IDS.includes(roleId);
    const requestedInactive = String(req.query?.include_inactive || '').trim() === '1';
    const includeInactive = isAdmin && requestedInactive;
    const result = await query(`
      SELECT
        r.id,
        r.religion_name,
        r.description,
        r.is_active,
        r.created_at
      FROM religions r
      ${includeInactive ? '' : 'WHERE r.is_active = true'}
      ORDER BY r.religion_name ASC
    `);

    return success(res, 200, 'Religions fetched successfully', result.rows, {
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching religions:', error);
    return errorResponse(res, 500, 'Failed to fetch religions');
  }
};

// Get religion by ID
const getReligionById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid religion id');

    const result = await query(`
      SELECT
        r.id,
        r.religion_name,
        r.description,
        r.is_active,
        r.created_at
      FROM religions r
      WHERE r.id = $1 AND r.is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Religion not found');
    }

    return success(res, 200, 'Religion fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching religion:', error);
    return errorResponse(res, 500, 'Failed to fetch religion');
  }
};

// Create religion
const createReligion = async (req, res) => {
  try {
    const religionName = normalizeReligionName(req.body?.religion_name);
    const description = sanitizeChatText(req.body?.description || '');
    const parsedIsActive = parseBooleanInput(req.body?.is_active, true);
    if (!parsedIsActive.ok) return errorResponse(res, 400, 'is_active must be a boolean');
    const isActive = parsedIsActive.value;

    if (!religionName) return errorResponse(res, 400, 'religion_name is required');
    if (religionName.length > 50) return errorResponse(res, 400, 'religion_name must be 50 characters or fewer');
    if (description.length > 200) return errorResponse(res, 400, 'description must be 200 characters or fewer');

    const duplicate = await query(
      `SELECT id FROM religions WHERE LOWER(religion_name) = LOWER($1) LIMIT 1`,
      [religionName]
    );
    if (duplicate.rows.length > 0) {
      return errorResponse(res, 409, 'Religion with this name already exists');
    }

    const result = await query(
      `INSERT INTO religions (religion_name, description, is_active, created_by, modified_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, religion_name, description, is_active, created_at`,
      [religionName, description || null, isActive, req.user?.id || null]
    );

    return success(res, 201, 'Religion created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating religion:', error);
    return errorResponse(res, 500, 'Failed to create religion');
  }
};

// Update religion
const updateReligion = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid religion id');

    const religionName = normalizeReligionName(req.body?.religion_name);
    const description = sanitizeChatText(req.body?.description || '');
    const parsedIsActive = parseBooleanInput(req.body?.is_active, true);
    if (!parsedIsActive.ok) return errorResponse(res, 400, 'is_active must be a boolean');
    const isActive = parsedIsActive.value;

    if (!religionName) return errorResponse(res, 400, 'religion_name is required');
    if (religionName.length > 50) return errorResponse(res, 400, 'religion_name must be 50 characters or fewer');
    if (description.length > 200) return errorResponse(res, 400, 'description must be 200 characters or fewer');

    const duplicate = await query(
      `SELECT id FROM religions WHERE LOWER(religion_name) = LOWER($1) AND id <> $2 LIMIT 1`,
      [religionName, id]
    );
    if (duplicate.rows.length > 0) {
      return errorResponse(res, 409, 'Religion with this name already exists');
    }

    const updated = await query(
      `UPDATE religions
       SET religion_name = $1,
           description = $2,
           is_active = $3,
           modified_at = NOW()
       WHERE id = $4
       RETURNING id, religion_name, description, is_active, created_at`,
      [religionName, description || null, isActive, id]
    );

    if (updated.rows.length === 0) {
      return errorResponse(res, 404, 'Religion not found');
    }

    return success(res, 200, 'Religion updated successfully', updated.rows[0]);
  } catch (error) {
    console.error('Error updating religion:', error);
    return errorResponse(res, 500, 'Failed to update religion');
  }
};

const toggleReligionStatus = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid religion id');

    const result = await query(
      `UPDATE religions
       SET is_active = NOT is_active,
           modified_at = NOW()
       WHERE id = $1
       RETURNING id, religion_name, description, is_active, created_at`,
      [id]
    );
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Religion not found');
    }

    return success(res, 200, 'Religion status updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error toggling religion status:', error);
    return errorResponse(res, 500, 'Failed to update religion status');
  }
};

// Delete religion safely (blocked if referenced)
const deleteReligion = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid religion id');

    const exists = await query(`SELECT id FROM religions WHERE id = $1`, [id]);
    if (exists.rows.length === 0) {
      return errorResponse(res, 404, 'Religion not found');
    }

    const studentRef = await query(
      `SELECT COUNT(*)::int AS count FROM students WHERE religion_id = $1`,
      [id]
    );
    const castRef = await query(
      `SELECT COUNT(*)::int AS count FROM casts WHERE religion_id = $1`,
      [id]
    );
    const refs = (studentRef.rows[0]?.count || 0) + (castRef.rows[0]?.count || 0);
    if (refs > 0) {
      return errorResponse(
        res,
        409,
        'Religion is in use and cannot be deleted. Deactivate it instead.'
      );
    }

    await query(`DELETE FROM religions WHERE id = $1`, [id]);
    return success(res, 200, 'Religion deleted successfully');
  } catch (error) {
    console.error('Error deleting religion:', error);
    return errorResponse(res, 500, 'Failed to delete religion');
  }
};

module.exports = {
  getAllReligions,
  getReligionById,
  createReligion,
  updateReligion,
  toggleReligionStatus,
  deleteReligion,
};
