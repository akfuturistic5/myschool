const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { sanitizeChatText } = require('../utils/htmlSanitize');
const { userCanManageMasterData, parseMasterDescription } = require('../utils/masterDataAdminGate');

const normalizeBloodGroupName = (value) => sanitizeChatText(value).replace(/\s+/g, ' ').toUpperCase();

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

const getAllBloodGroups = async (req, res) => {
  try {
    const requestedInactive = String(req.query?.include_inactive || '').trim() === '1';
    const includeInactive = userCanManageMasterData(req) && requestedInactive;

    const result = await query(
      `
      SELECT
        bg.id,
        bg.blood_group_name as blood_group,
        bg.description,
        bg.is_active,
        bg.created_at,
        bg.updated_at
      FROM blood_groups bg
      ${includeInactive ? '' : 'WHERE bg.is_active = true'}
      ORDER BY bg.blood_group_name ASC
    `
    );

    return success(res, 200, 'Blood groups fetched successfully', result.rows, {
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching blood groups:', error);
    return errorResponse(res, 500, 'Failed to fetch blood groups');
  }
};

const getBloodGroupById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid blood group id');

    const result = await query(
      `
      SELECT
        bg.id,
        bg.blood_group_name as blood_group,
        bg.description,
        bg.is_active,
        bg.created_at,
        bg.updated_at
      FROM blood_groups bg
      WHERE bg.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Blood group not found');
    }

    return success(res, 200, 'Blood group fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching blood group:', error);
    return errorResponse(res, 500, 'Failed to fetch blood group');
  }
};

const createBloodGroup = async (req, res) => {
  try {
    const nameRaw = normalizeBloodGroupName(req.body?.blood_group_name ?? req.body?.blood_group);
    const parsedDesc = parseMasterDescription(req.body?.description);
    if (!parsedDesc.ok) return errorResponse(res, 400, parsedDesc.message);
    const description = parsedDesc.value;
    const parsedIsActive = parseBooleanInput(req.body?.is_active, true);
    if (!parsedIsActive.ok) return errorResponse(res, 400, 'is_active must be a boolean');
    const isActive = parsedIsActive.value;

    if (!nameRaw) return errorResponse(res, 400, 'blood_group_name is required');
    if (nameRaw.length > 10) return errorResponse(res, 400, 'blood_group_name must be 10 characters or fewer');

    const duplicate = await query(
      `SELECT id FROM blood_groups WHERE LOWER(blood_group_name) = LOWER($1) LIMIT 1`,
      [nameRaw]
    );
    if (duplicate.rows.length > 0) {
      return errorResponse(res, 409, 'This blood group already exists');
    }

    const uid = req.user?.id || null;
    const result = await query(
      `INSERT INTO blood_groups (blood_group_name, description, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING id, blood_group_name AS blood_group, description, is_active, created_at, updated_at`,
      [nameRaw, description, isActive, uid]
    );

    return success(res, 201, 'Blood group created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating blood group:', error);
    return errorResponse(res, 500, 'Failed to create blood group');
  }
};

const updateBloodGroup = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid blood group id');

    const nameRaw = normalizeBloodGroupName(req.body?.blood_group_name ?? req.body?.blood_group);
    const parsedDesc = parseMasterDescription(req.body?.description);
    if (!parsedDesc.ok) return errorResponse(res, 400, parsedDesc.message);
    const description = parsedDesc.value;
    const parsedIsActive = parseBooleanInput(req.body?.is_active, true);
    if (!parsedIsActive.ok) return errorResponse(res, 400, 'is_active must be a boolean');
    const isActive = parsedIsActive.value;

    if (!nameRaw) return errorResponse(res, 400, 'blood_group_name is required');
    if (nameRaw.length > 10) return errorResponse(res, 400, 'blood_group_name must be 10 characters or fewer');

    const duplicate = await query(
      `SELECT id FROM blood_groups WHERE LOWER(blood_group_name) = LOWER($1) AND id <> $2 LIMIT 1`,
      [nameRaw, id]
    );
    if (duplicate.rows.length > 0) {
      return errorResponse(res, 409, 'This blood group already exists');
    }

    const uid = req.user?.id || null;
    const updated = await query(
      `UPDATE blood_groups
       SET blood_group_name = $1,
           description = $2,
           is_active = $3,
           updated_at = NOW(),
           updated_by = $4
       WHERE id = $5
       RETURNING id, blood_group_name AS blood_group, description, is_active, created_at, updated_at`,
      [nameRaw, description, isActive, uid, id]
    );

    if (updated.rows.length === 0) {
      return errorResponse(res, 404, 'Blood group not found');
    }

    return success(res, 200, 'Blood group updated successfully', updated.rows[0]);
  } catch (error) {
    console.error('Error updating blood group:', error);
    return errorResponse(res, 500, 'Failed to update blood group');
  }
};

const toggleBloodGroupStatus = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid blood group id');

    const uid = req.user?.id || null;
    const result = await query(
      `UPDATE blood_groups
       SET is_active = NOT is_active,
           updated_at = NOW(),
           updated_by = $2
       WHERE id = $1
       RETURNING id, blood_group_name AS blood_group, description, is_active, created_at, updated_at`,
      [id, uid]
    );
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Blood group not found');
    }

    return success(res, 200, 'Blood group status updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error toggling blood group status:', error);
    return errorResponse(res, 500, 'Failed to update blood group status');
  }
};

const deleteBloodGroup = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid blood group id');

    const exists = await query(`SELECT id FROM blood_groups WHERE id = $1`, [id]);
    if (exists.rows.length === 0) {
      return errorResponse(res, 404, 'Blood group not found');
    }

    const userRef = await query(
      `SELECT COUNT(*)::int AS count FROM users WHERE blood_group_id = $1`,
      [id]
    );
    const studentRef = await query(
      `SELECT COUNT(*)::int AS count FROM students WHERE blood_group_id = $1`,
      [id]
    );
    const refs = (userRef.rows[0]?.count || 0) + (studentRef.rows[0]?.count || 0);
    if (refs > 0) {
      return errorResponse(
        res,
        409,
        'Blood group is in use and cannot be deleted. Deactivate it instead.'
      );
    }

    await query(`DELETE FROM blood_groups WHERE id = $1`, [id]);
    return success(res, 200, 'Blood group deleted successfully');
  } catch (error) {
    console.error('Error deleting blood group:', error);
    return errorResponse(res, 500, 'Failed to delete blood group');
  }
};

module.exports = {
  getAllBloodGroups,
  getBloodGroupById,
  createBloodGroup,
  updateBloodGroup,
  toggleBloodGroupStatus,
  deleteBloodGroup,
};
