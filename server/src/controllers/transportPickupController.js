const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { resolveAcademicYearId, toPositiveInt } = require('../utils/academicYear');

function mapPickupRow(row) {
  return {
    id: row.id,
    point_name: row.point_name || '',
    academic_year_id: row.academic_year_id || null,
    is_active: row.is_active !== false && row.is_active !== 'f',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

const getAllPickupPoints = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = 'all', 
      academic_year_id,
      sortField = 'point_name', 
      sortOrder = 'ASC' 
    } = req.query;
    const scopedAcademicYearId = await resolveAcademicYearId(academic_year_id);

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const validSortFields = ['point_name', 'id', 'created_at', 'is_active'];
    
    const actualSortField = validSortFields.includes(sortField) ? sortField : 'point_name';
    const actualSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    let baseSql = `
      FROM pickup_points
      WHERE deleted_at IS NULL
    `;
    
    const params = [];
    let sqlFilters = '';

    if (search) {
      params.push(`%${search}%`);
      sqlFilters += ` AND point_name ILIKE $${params.length}`;
    }

    if (status !== 'all') {
      params.push(status === 'active');
      sqlFilters += ` AND is_active = $${params.length}`;
    }
    if (scopedAcademicYearId) {
      params.push(scopedAcademicYearId);
      sqlFilters += ` AND academic_year_id = $${params.length}`;
    }

    const countSql = `SELECT COUNT(*) ${baseSql} ${sqlFilters}`;
    const dataSql = `
      SELECT *
      ${baseSql} 
      ${sqlFilters} 
      ORDER BY ${actualSortField} ${actualSortOrder} 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const queryParams = [...params, parseInt(limit), offset];

    const [result, countResult] = await Promise.all([
      query(dataSql, queryParams),
      query(countSql, params)
    ]);

    const data = result.rows.map(mapPickupRow);
    const totalCount = parseInt(countResult.rows[0].count);

    return success(res, 200, 'Pickup points fetched successfully', data, { 
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching pickup points:', error);
    return errorResponse(res, 500, 'Failed to fetch pickup points');
  }
};

const getPickupPointById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT *
      FROM pickup_points
      WHERE id = $1 AND deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Pickup point not found');
    }
    return success(res, 200, 'Pickup point fetched successfully', mapPickupRow(result.rows[0]));
  } catch (error) {
    console.error('Error fetching pickup point:', error);
    return errorResponse(res, 500, 'Failed to fetch pickup point');
  }
};

const createPickupPoint = async (req, res) => {
  try {
    const { 
      point_name, 
      academic_year_id,
      is_active 
    } = req.body;

    if (!point_name) {
      return errorResponse(res, 400, 'Pickup point name is required');
    }

    const scopedAcademicYearId = await resolveAcademicYearId(academic_year_id || req.query?.academic_year_id);

    // Check for duplicate name
    const existing = await query(
      'SELECT id FROM pickup_points WHERE point_name = $1 AND deleted_at IS NULL AND academic_year_id = $2',
      [point_name, scopedAcademicYearId]
    );
    if (existing.rows.length > 0) {
      return errorResponse(res, 400, 'A pickup point with this name already exists');
    }

    const result = await query(`
      INSERT INTO pickup_points (point_name, is_active, academic_year_id) VALUES ($1, $2, $3) 
      RETURNING *
    `, [point_name, is_active !== false, scopedAcademicYearId]);

    return success(res, 201, 'Pickup point created successfully', mapPickupRow(result.rows[0]));
  } catch (error) {
    console.error('Error creating pickup point:', error);
    return errorResponse(res, 500, 'Failed to create pickup point');
  }
};

const updatePickupPoint = async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id);

    if (isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid pickup point ID');
    }

    const { 
      point_name, 
      academic_year_id,
      is_active 
    } = req.body;

    // Check for duplicate name if provided (excluding current ID)
    if (point_name !== undefined) {
      if (!point_name) {
        return errorResponse(res, 400, 'Pickup point name cannot be empty');
      }
      const existing = await query(
        'SELECT id FROM pickup_points WHERE point_name = $1 AND id != $2 AND deleted_at IS NULL',
        [point_name, numericId]
      );
      if (existing.rows.length > 0) {
        return errorResponse(res, 400, 'Another pickup point with this name already exists');
      }
    }

    const updates = [];
    const values = [];
    let i = 1;

    if (point_name !== undefined) {
      updates.push(`point_name = $${i++}`);
      values.push(point_name);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${i++}`);
      values.push(is_active !== false);
    }
    if (academic_year_id !== undefined) {
      updates.push(`academic_year_id = $${i++}`);
      values.push(toPositiveInt(academic_year_id));
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    values.push(numericId);
    const result = await query(`
      UPDATE pickup_points
      SET ${updates.join(', ')}
      WHERE id = $${i} AND deleted_at IS NULL
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Pickup point not found');
    }

    return success(res, 200, 'Pickup point updated successfully', mapPickupRow(result.rows[0]));
  } catch (error) {
    console.error('Error updating pickup point:', error);
    return errorResponse(res, 500, error.message || 'Failed to update pickup point');
  }
};

const deletePickupPoint = async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id);

    if (isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid pickup point ID');
    }

    const result = await query(
      'UPDATE pickup_points SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [numericId]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Pickup point not found or already deleted');
    }

    return success(res, 200, 'Pickup point deleted successfully');
  } catch (error) {
    console.error('Error deleting pickup point:', error);
    return errorResponse(res, 500, 'Failed to delete pickup point');
  }
};

module.exports = { 
  getAllPickupPoints, 
  getPickupPointById, 
  createPickupPoint, 
  updatePickupPoint, 
  deletePickupPoint 
};
