const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

// Get all designations
const getAllDesignations = async (req, res) => {
  try {
    // Use exact table name: designations (plural)
    const result = await query(`
      SELECT *
      FROM designations
      ORDER BY id ASC
    `);

    return success(res, 200, 'Designations fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching designations:', error);
    return errorResponse(res, 500, 'Failed to fetch designations');
  }
};

// Get designation by ID
const getDesignationById = async (req, res) => {
  try {
    const { id } = req.params;
    // Use exact table name: designations (plural)
    const result = await query(
      `
      SELECT *
      FROM designations
      WHERE id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Designation not found');
    }

    return success(res, 200, 'Designation fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching designation by ID:', error);
    return errorResponse(res, 500, 'Failed to fetch designation');
  }
};

// Update designation (name + status)
const updateDesignation = async (req, res) => {
  try {
    const { id } = req.params;
    const { designation_name, designation, name, is_active } = req.body;

    // Resolve new designation name from possible fields
    const newName = (designation_name || designation || name || '').trim();

    if (!newName) {
      return errorResponse(res, 400, 'Designation name is required');
    }

    // Convert is_active to boolean
    let isActiveBoolean = true; // default keep active
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 't' || is_active === 'T') {
      isActiveBoolean = true;
    } else if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'f' || is_active === 'F') {
      isActiveBoolean = false;
    }

    const result = await query(
      `
      UPDATE designations
      SET designation_name = $1,
          is_active = $2,
          modified_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
      [newName, isActiveBoolean, id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Designation not found');
    }

    return success(res, 200, 'Designation updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating designation:', error);
    return errorResponse(res, 500, 'Failed to update designation');
  }
};

module.exports = {
  getAllDesignations,
  getDesignationById,
  updateDesignation,
};
