const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { sanitizeChatText } = require('../utils/htmlSanitize');
const { userCanManageMasterData, parseMasterDescription } = require('../utils/masterDataAdminGate');

const normalizeLanguageName = (value) => sanitizeChatText(value).replace(/\s+/g, ' ');

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

const getAllMotherTongues = async (req, res) => {
  try {
    const requestedInactive = String(req.query?.include_inactive || '').trim() === '1';
    const includeInactive = userCanManageMasterData(req) && requestedInactive;

    const result = await query(
      `
      SELECT
        mt.id,
        mt.language_name,
        NULL::varchar AS language_code,
        mt.description,
        mt.is_active,
        mt.created_at,
        mt.updated_at
      FROM mother_tongues mt
      ${includeInactive ? '' : 'WHERE mt.is_active = true'}
      ORDER BY mt.language_name ASC
    `
    );

    return success(res, 200, 'Mother tongues fetched successfully', result.rows, {
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching mother tongues:', error);
    return errorResponse(res, 500, 'Failed to fetch mother tongues');
  }
};

const getMotherTongueById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid mother tongue id');

    const result = await query(
      `
      SELECT
        mt.id,
        mt.language_name,
        NULL::varchar AS language_code,
        mt.description,
        mt.is_active,
        mt.created_at,
        mt.updated_at
      FROM mother_tongues mt
      WHERE mt.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Mother tongue not found');
    }

    return success(res, 200, 'Mother tongue fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching mother tongue:', error);
    return errorResponse(res, 500, 'Failed to fetch mother tongue');
  }
};

const createMotherTongue = async (req, res) => {
  try {
    const languageName = normalizeLanguageName(req.body?.language_name);
    const parsedDesc = parseMasterDescription(req.body?.description);
    if (!parsedDesc.ok) return errorResponse(res, 400, parsedDesc.message);
    const description = parsedDesc.value;
    const parsedIsActive = parseBooleanInput(req.body?.is_active, true);
    if (!parsedIsActive.ok) return errorResponse(res, 400, 'is_active must be a boolean');
    const isActive = parsedIsActive.value;

    if (!languageName) return errorResponse(res, 400, 'language_name is required');
    if (languageName.length > 50) return errorResponse(res, 400, 'language_name must be 50 characters or fewer');

    const duplicate = await query(
      `SELECT id FROM mother_tongues WHERE LOWER(language_name) = LOWER($1) LIMIT 1`,
      [languageName]
    );
    if (duplicate.rows.length > 0) {
      return errorResponse(res, 409, 'This language already exists');
    }

    const uid = req.user?.id || null;
    const result = await query(
      `INSERT INTO mother_tongues (language_name, description, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING id, language_name, description, is_active, created_at, updated_at`,
      [languageName, description, isActive, uid]
    );

    const row = { ...result.rows[0], language_code: null };
    return success(res, 201, 'Mother tongue created successfully', row);
  } catch (error) {
    console.error('Error creating mother tongue:', error);
    return errorResponse(res, 500, 'Failed to create mother tongue');
  }
};

const updateMotherTongue = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid mother tongue id');

    const languageName = normalizeLanguageName(req.body?.language_name);
    const parsedDesc = parseMasterDescription(req.body?.description);
    if (!parsedDesc.ok) return errorResponse(res, 400, parsedDesc.message);
    const description = parsedDesc.value;
    const parsedIsActive = parseBooleanInput(req.body?.is_active, true);
    if (!parsedIsActive.ok) return errorResponse(res, 400, 'is_active must be a boolean');
    const isActive = parsedIsActive.value;

    if (!languageName) return errorResponse(res, 400, 'language_name is required');
    if (languageName.length > 50) return errorResponse(res, 400, 'language_name must be 50 characters or fewer');

    const duplicate = await query(
      `SELECT id FROM mother_tongues WHERE LOWER(language_name) = LOWER($1) AND id <> $2 LIMIT 1`,
      [languageName, id]
    );
    if (duplicate.rows.length > 0) {
      return errorResponse(res, 409, 'This language already exists');
    }

    const uid = req.user?.id || null;
    const updated = await query(
      `UPDATE mother_tongues
       SET language_name = $1,
           description = $2,
           is_active = $3,
           updated_at = NOW(),
           updated_by = $4
       WHERE id = $5
       RETURNING id, language_name, description, is_active, created_at, updated_at`,
      [languageName, description, isActive, uid, id]
    );

    if (updated.rows.length === 0) {
      return errorResponse(res, 404, 'Mother tongue not found');
    }

    const row = { ...updated.rows[0], language_code: null };
    return success(res, 200, 'Mother tongue updated successfully', row);
  } catch (error) {
    console.error('Error updating mother tongue:', error);
    return errorResponse(res, 500, 'Failed to update mother tongue');
  }
};

const toggleMotherTongueStatus = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid mother tongue id');

    const uid = req.user?.id || null;
    const result = await query(
      `UPDATE mother_tongues
       SET is_active = NOT is_active,
           updated_at = NOW(),
           updated_by = $2
       WHERE id = $1
       RETURNING id, language_name, description, is_active, created_at, updated_at`,
      [id, uid]
    );
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Mother tongue not found');
    }

    const row = { ...result.rows[0], language_code: null };
    return success(res, 200, 'Mother tongue status updated successfully', row);
  } catch (error) {
    console.error('Error toggling mother tongue status:', error);
    return errorResponse(res, 500, 'Failed to update mother tongue status');
  }
};

const deleteMotherTongue = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid mother tongue id');

    const exists = await query(`SELECT id FROM mother_tongues WHERE id = $1`, [id]);
    if (exists.rows.length === 0) {
      return errorResponse(res, 404, 'Mother tongue not found');
    }

    const studentRef = await query(
      `SELECT COUNT(*)::int AS count FROM students WHERE mother_tongue_id = $1`,
      [id]
    );
    const refs = studentRef.rows[0]?.count || 0;
    if (refs > 0) {
      return errorResponse(
        res,
        409,
        'Mother tongue is assigned to students and cannot be deleted. Deactivate it instead.'
      );
    }

    await query(`DELETE FROM mother_tongues WHERE id = $1`, [id]);
    return success(res, 200, 'Mother tongue deleted successfully');
  } catch (error) {
    console.error('Error deleting mother tongue:', error);
    return errorResponse(res, 500, 'Failed to delete mother tongue');
  }
};

module.exports = {
  getAllMotherTongues,
  getMotherTongueById,
  createMotherTongue,
  updateMotherTongue,
  toggleMotherTongueStatus,
  deleteMotherTongue,
};
