const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

const getAllComponents = async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM salary_components WHERE is_active = true ORDER BY type DESC, component_name ASC'
    );
    return success(res, 200, 'Salary components fetched successfully', result.rows);
  } catch (error) {
    console.error('Error fetching salary components:', error);
    return errorResponse(res, 500, 'Failed to fetch salary components');
  }
};

const createComponent = async (req, res) => {
  try {
    const { component_name, type, description } = req.body;
    
    if (!component_name || !type) {
      return errorResponse(res, 400, 'Component name and type are required');
    }

    if (!['allowance', 'earning', 'deduction'].includes(type)) {
      return errorResponse(res, 400, 'Type must be either allowance/earning or deduction');
    }

    const createdBy = req.user?.id;

    const result = await query(
      `INSERT INTO salary_components (component_name, type, description, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [component_name, type, description || null, createdBy]
    );

    return success(res, 201, 'Salary component created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating salary component:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'A component with this name already exists');
    }
    return errorResponse(res, 500, 'Failed to create salary component');
  }
};

const updateComponent = async (req, res) => {
  try {
    const { id } = req.params;
    const { component_name, type, description, is_active } = req.body;

    if (type && !['allowance', 'earning', 'deduction'].includes(type)) {
      return errorResponse(res, 400, 'Type must be either allowance/earning or deduction');
    }

    const updatedBy = req.user?.id;

    const result = await query(
      `UPDATE salary_components 
       SET component_name = COALESCE($1, component_name),
           type = COALESCE($2, type),
           description = COALESCE($3, description),
           is_active = COALESCE($4, is_active),
           updated_by = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [component_name, type, description, is_active, updatedBy, id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Salary component not found');
    }

    return success(res, 200, 'Salary component updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating salary component:', error);
    return errorResponse(res, 500, 'Failed to update salary component');
  }
};

const deleteComponent = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete
    const result = await query(
      'UPDATE salary_components SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Salary component not found');
    }

    return success(res, 200, 'Salary component deleted successfully');
  } catch (error) {
    console.error('Error deleting salary component:', error);
    return errorResponse(res, 500, 'Failed to delete salary component');
  }
};

module.exports = {
  getAllComponents,
  createComponent,
  updateComponent,
  deleteComponent,
};
