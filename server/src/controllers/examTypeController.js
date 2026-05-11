const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { sanitizeChatText } = require('../utils/htmlSanitize');
const { userCanManageMasterData, parseMasterDescription } = require('../utils/masterDataAdminGate');

const normalizeTypeName = (value) => sanitizeChatText(value).replace(/\s+/g, ' ');

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

const getAllExamTypes = async (req, res) => {
  try {
    const requestedInactive = String(req.query?.include_inactive || '').trim() === '1';
    const includeInactive = userCanManageMasterData(req) && requestedInactive;

    const result = await query(
      `
      SELECT
        id,
        type_name,
        description,
        is_active,
        created_at,
        updated_at
      FROM exam_types
      ${includeInactive ? '' : 'WHERE is_active = true'}
      ORDER BY type_name ASC
    `
    );

    return success(res, 200, 'Exam types fetched successfully', result.rows, {
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching exam types:', error);
    return errorResponse(res, 500, 'Failed to fetch exam types');
  }
};

const getExamTypeById = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid exam type id');

    const result = await query(
      `
      SELECT
        id,
        type_name,
        description,
        is_active,
        created_at,
        updated_at
      FROM exam_types
      WHERE id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Exam type not found');
    }

    return success(res, 200, 'Exam type fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching exam type:', error);
    return errorResponse(res, 500, 'Failed to fetch exam type');
  }
};

const createExamType = async (req, res) => {
  try {
    const typeName = normalizeTypeName(req.body?.type_name);
    const parsedDesc = parseMasterDescription(req.body?.description);
    if (!parsedDesc.ok) return errorResponse(res, 400, parsedDesc.message);
    const description = parsedDesc.value;
    const parsedIsActive = parseBooleanInput(req.body?.is_active, true);
    if (!parsedIsActive.ok) return errorResponse(res, 400, 'is_active must be a boolean');
    const isActive = parsedIsActive.value;

    if (!typeName) return errorResponse(res, 400, 'type_name is required');
    if (typeName.length > 100) return errorResponse(res, 400, 'type_name must be 100 characters or fewer');

    const duplicate = await query(
      `SELECT id FROM exam_types WHERE LOWER(type_name) = LOWER($1) LIMIT 1`,
      [typeName]
    );
    if (duplicate.rows.length > 0) {
      return errorResponse(res, 409, 'An exam type with this name already exists');
    }

    const uid = req.user?.id || null;
    const result = await query(
      `INSERT INTO exam_types (type_name, description, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING id, type_name, description, is_active, created_at, updated_at`,
      [typeName, description, isActive, uid]
    );

    return success(res, 201, 'Exam type created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating exam type:', error);
    return errorResponse(res, 500, 'Failed to create exam type');
  }
};

const updateExamType = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid exam type id');

    const typeName = normalizeTypeName(req.body?.type_name);
    const parsedDesc = parseMasterDescription(req.body?.description);
    if (!parsedDesc.ok) return errorResponse(res, 400, parsedDesc.message);
    const description = parsedDesc.value;
    const parsedIsActive = parseBooleanInput(req.body?.is_active, true);
    if (!parsedIsActive.ok) return errorResponse(res, 400, 'is_active must be a boolean');
    const isActive = parsedIsActive.value;

    if (!typeName) return errorResponse(res, 400, 'type_name is required');
    if (typeName.length > 100) return errorResponse(res, 400, 'type_name must be 100 characters or fewer');

    const duplicate = await query(
      `SELECT id FROM exam_types WHERE LOWER(type_name) = LOWER($1) AND id <> $2 LIMIT 1`,
      [typeName, id]
    );
    if (duplicate.rows.length > 0) {
      return errorResponse(res, 409, 'An exam type with this name already exists');
    }

    const uid = req.user?.id || null;
    const updated = await query(
      `UPDATE exam_types
       SET type_name = $1,
           description = $2,
           is_active = $3,
           updated_at = NOW(),
           updated_by = $4
       WHERE id = $5
       RETURNING id, type_name, description, is_active, created_at, updated_at`,
      [typeName, description, isActive, uid, id]
    );

    if (updated.rows.length === 0) {
      return errorResponse(res, 404, 'Exam type not found');
    }

    return success(res, 200, 'Exam type updated successfully', updated.rows[0]);
  } catch (error) {
    console.error('Error updating exam type:', error);
    return errorResponse(res, 500, 'Failed to update exam type');
  }
};

const toggleExamTypeStatus = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid exam type id');

    const uid = req.user?.id || null;
    const result = await query(
      `UPDATE exam_types
       SET is_active = NOT is_active,
           updated_at = NOW(),
           updated_by = $2
       WHERE id = $1
       RETURNING id, type_name, description, is_active, created_at, updated_at`,
      [id, uid]
    );
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Exam type not found');
    }

    return success(res, 200, 'Exam type status updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error toggling exam type status:', error);
    return errorResponse(res, 500, 'Failed to update exam type status');
  }
};

const deleteExamType = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, 400, 'Invalid exam type id');

    const typeRecord = await query(`SELECT type_name FROM exam_types WHERE id = $1`, [id]);
    if (typeRecord.rows.length === 0) {
      return errorResponse(res, 404, 'Exam type not found');
    }
    const typeName = typeRecord.rows[0].type_name;

    const examRef = await query(
      `SELECT COUNT(*)::int AS count FROM exams WHERE exam_type = $1`,
      [typeName]
    );
    const refs = examRef.rows[0]?.count || 0;
    if (refs > 0) {
      return errorResponse(
        res,
        409,
        'Exam type is assigned to exams and cannot be deleted. Deactivate it instead.'
      );
    }

    await query(`DELETE FROM exam_types WHERE id = $1`, [id]);
    return success(res, 200, 'Exam type deleted successfully');
  } catch (error) {
    console.error('Error deleting exam type:', error);
    return errorResponse(res, 500, 'Failed to delete exam type');
  }
};

module.exports = {
  getAllExamTypes,
  getExamTypeById,
  createExamType,
  updateExamType,
  toggleExamTypeStatus,
  deleteExamType,
};
