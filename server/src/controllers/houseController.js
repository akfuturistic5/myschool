const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { sanitizeChatText } = require('../utils/htmlSanitize');
const { userCanManageMasterData, parseMasterDescription } = require('../utils/masterDataAdminGate');

const normalizeHouseName = (value) => sanitizeChatText(value).replace(/\s+/g, ' ');

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

const getAllHouses = async (req, res) => {
  try {
    const requestedInactive = String(req.query?.include_inactive || '').trim() === '1';
    const includeInactive = userCanManageMasterData(req) && requestedInactive;

    const result = await query(
      `
      SELECT
        id,
        house_name,
        description,
        is_active,
        created_at,
        updated_at
      FROM houses
      ${includeInactive ? '' : 'WHERE is_active = true'}
      ORDER BY house_name ASC
    `
    );

    return success(res, 200, 'Houses fetched successfully', result.rows, {
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching houses:', error);
    return errorResponse(res, 500, 'Failed to fetch houses');
  }
};

const getHouseById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid house id');

    const result = await query(
      `
      SELECT
        id,
        house_name,
        description,
        is_active,
        created_at,
        updated_at
      FROM houses
      WHERE id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'House not found');
    }

    return success(res, 200, 'House fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching house:', error);
    return errorResponse(res, 500, 'Failed to fetch house');
  }
};

const createHouse = async (req, res) => {
  try {
    const houseName = normalizeHouseName(req.body?.house_name);
    const parsedDesc = parseMasterDescription(req.body?.description);
    if (!parsedDesc.ok) return errorResponse(res, 400, parsedDesc.message);
    const description = parsedDesc.value;
    const parsedIsActive = parseBooleanInput(req.body?.is_active, true);
    if (!parsedIsActive.ok) return errorResponse(res, 400, 'is_active must be a boolean');
    const isActive = parsedIsActive.value;

    if (!houseName) return errorResponse(res, 400, 'house_name is required');
    if (houseName.length > 50) return errorResponse(res, 400, 'house_name must be 50 characters or fewer');

    const duplicate = await query(
      `SELECT id FROM houses WHERE LOWER(house_name) = LOWER($1) LIMIT 1`,
      [houseName]
    );
    if (duplicate.rows.length > 0) {
      return errorResponse(res, 409, 'A house with this name already exists');
    }

    const uid = req.user?.id || null;
    const result = await query(
      `INSERT INTO houses (house_name, description, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING id, house_name, description, is_active, created_at, updated_at`,
      [houseName, description, isActive, uid]
    );

    return success(res, 201, 'House created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating house:', error);
    return errorResponse(res, 500, 'Failed to create house');
  }
};

const updateHouse = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid house id');

    const houseName = normalizeHouseName(req.body?.house_name);
    const parsedDesc = parseMasterDescription(req.body?.description);
    if (!parsedDesc.ok) return errorResponse(res, 400, parsedDesc.message);
    const description = parsedDesc.value;
    const parsedIsActive = parseBooleanInput(req.body?.is_active, true);
    if (!parsedIsActive.ok) return errorResponse(res, 400, 'is_active must be a boolean');
    const isActive = parsedIsActive.value;

    if (!houseName) return errorResponse(res, 400, 'house_name is required');
    if (houseName.length > 50) return errorResponse(res, 400, 'house_name must be 50 characters or fewer');

    const duplicate = await query(
      `SELECT id FROM houses WHERE LOWER(house_name) = LOWER($1) AND id <> $2 LIMIT 1`,
      [houseName, id]
    );
    if (duplicate.rows.length > 0) {
      return errorResponse(res, 409, 'A house with this name already exists');
    }

    const uid = req.user?.id || null;
    const updated = await query(
      `UPDATE houses
       SET house_name = $1,
           description = $2,
           is_active = $3,
           updated_at = NOW(),
           updated_by = $4
       WHERE id = $5
       RETURNING id, house_name, description, is_active, created_at, updated_at`,
      [houseName, description, isActive, uid, id]
    );

    if (updated.rows.length === 0) {
      return errorResponse(res, 404, 'House not found');
    }

    return success(res, 200, 'House updated successfully', updated.rows[0]);
  } catch (error) {
    console.error('Error updating house:', error);
    return errorResponse(res, 500, 'Failed to update house');
  }
};

const toggleHouseStatus = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid house id');

    const uid = req.user?.id || null;
    const result = await query(
      `UPDATE houses
       SET is_active = NOT is_active,
           updated_at = NOW(),
           updated_by = $2
       WHERE id = $1
       RETURNING id, house_name, description, is_active, created_at, updated_at`,
      [id, uid]
    );
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'House not found');
    }

    return success(res, 200, 'House status updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error toggling house status:', error);
    return errorResponse(res, 500, 'Failed to update house status');
  }
};

const deleteHouse = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid house id');

    const exists = await query(`SELECT id FROM houses WHERE id = $1`, [id]);
    if (exists.rows.length === 0) {
      return errorResponse(res, 404, 'House not found');
    }

    const studentRef = await query(
      `SELECT COUNT(*)::int AS count FROM students WHERE house_id = $1`,
      [id]
    );
    const refs = studentRef.rows[0]?.count || 0;
    if (refs > 0) {
      return errorResponse(
        res,
        409,
        'House is assigned to students and cannot be deleted. Deactivate it instead.'
      );
    }

    await query(`DELETE FROM houses WHERE id = $1`, [id]);
    return success(res, 200, 'House deleted successfully');
  } catch (error) {
    console.error('Error deleting house:', error);
    return errorResponse(res, 500, 'Failed to delete house');
  }
};

module.exports = {
  getAllHouses,
  getHouseById,
  createHouse,
  updateHouse,
  toggleHouseStatus,
  deleteHouse,
};
