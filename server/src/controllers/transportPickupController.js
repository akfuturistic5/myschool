const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getScopedDriverId, getScopedRouteIdsForDriver } = require('../utils/driverTransportAccess');
const { hasColumn, hasTable } = require('../utils/schemaInspector');

function mapPickupRow(row) {
  return {
    id: row.id,
    point_name: row.point_name || '',
    is_active: row.is_active !== false && row.is_active !== 'f',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

const getAllPickupPoints = async (req, res) => {
  try {
    const hasDeletedAt = await hasColumn('pickup_points', 'deleted_at');
    const hasRouteStops = await hasTable('route_stops');
    const scopedDriverId = await getScopedDriverId(req);
    if (scopedDriverId != null) {
      const routeIds = await getScopedRouteIdsForDriver(scopedDriverId);
      if (routeIds.length === 0) {
        return success(res, 200, 'Pickup points fetched successfully', [], { total: 0, page: 1, limit: 0 });
      }
      const result = hasRouteStops
        ? await query(
            `SELECT DISTINCT pp.*
             FROM pickup_points pp
             JOIN route_stops rs ON rs.pickup_point_id = pp.id
             WHERE ${hasDeletedAt ? 'pp.deleted_at IS NULL' : '1=1'}
               AND rs.route_id = ANY($1::int[])
             ORDER BY pp.point_name ASC`,
            [routeIds]
          )
        : await query(
            `SELECT DISTINCT pp.*
             FROM pickup_points pp
             WHERE ${hasDeletedAt ? 'pp.deleted_at IS NULL' : '1=1'}
               AND pp.route_id = ANY($1::int[])
             ORDER BY pp.point_name ASC`,
            [routeIds]
          );
      const data = result.rows.map(mapPickupRow);
      return success(res, 200, 'Pickup points fetched successfully', data, {
        total: data.length,
        page: 1,
        limit: data.length,
      });
    }

    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = 'all', 
      sortField = 'point_name', 
      sortOrder = 'ASC' 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const validSortFields = ['point_name', 'id', 'created_at', 'is_active'];
    
    const actualSortField = validSortFields.includes(sortField) ? sortField : 'point_name';
    const actualSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    let baseSql = `
      FROM pickup_points
      WHERE ${hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}
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
    const hasDeletedAt = await hasColumn('pickup_points', 'deleted_at');
    const hasRouteStops = await hasTable('route_stops');
    const scopedDriverId = await getScopedDriverId(req);
    const result = await query(`
      SELECT *
      FROM pickup_points
      WHERE id = $1 AND ${hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}
    `, [id]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Pickup point not found');
    }
    if (scopedDriverId != null) {
      const routeIds = await getScopedRouteIdsForDriver(scopedDriverId);
      if (routeIds.length === 0) {
        return errorResponse(res, 403, 'Access denied');
      }
      const scoped = hasRouteStops
        ? await query(
            `SELECT 1
             FROM route_stops
             WHERE pickup_point_id = $1
               AND route_id = ANY($2::int[])
             LIMIT 1`,
            [id, routeIds]
          )
        : await query(
            `SELECT 1
             FROM pickup_points
             WHERE id = $1
               AND route_id = ANY($2::int[])
             LIMIT 1`,
            [id, routeIds]
          );
      if (scoped.rows.length === 0) {
        return errorResponse(res, 403, 'Access denied');
      }
    }
    return success(res, 200, 'Pickup point fetched successfully', mapPickupRow(result.rows[0]));
  } catch (error) {
    console.error('Error fetching pickup point:', error);
    return errorResponse(res, 500, 'Failed to fetch pickup point');
  }
};

const createPickupPoint = async (req, res) => {
  try {
    const hasDeletedAt = await hasColumn('pickup_points', 'deleted_at');
    const { 
      point_name, 
      is_active 
    } = req.body;

    if (!point_name) {
      return errorResponse(res, 400, 'Pickup point name is required');
    }

    // Check for duplicate name
    const existing = await query(
      `SELECT id FROM pickup_points WHERE point_name = $1 AND ${hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}`,
      [point_name]
    );
    if (existing.rows.length > 0) {
      return errorResponse(res, 400, 'A pickup point with this name already exists');
    }

    const result = await query(
      `INSERT INTO pickup_points (point_name, is_active) VALUES ($1, $2)
       RETURNING *`,
      [point_name, is_active !== false]
    );

    return success(res, 201, 'Pickup point created successfully', mapPickupRow(result.rows[0]));
  } catch (error) {
    console.error('Error creating pickup point:', error);
    return errorResponse(res, 500, 'Failed to create pickup point');
  }
};

const updatePickupPoint = async (req, res) => {
  try {
    const hasDeletedAt = await hasColumn('pickup_points', 'deleted_at');
    const { id } = req.params;
    const numericId = parseInt(id);

    if (isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid pickup point ID');
    }

    const { 
      point_name, 
      is_active 
    } = req.body;

    // Check for duplicate name if provided (excluding current ID)
    if (point_name !== undefined) {
      if (!point_name) {
        return errorResponse(res, 400, 'Pickup point name cannot be empty');
      }
      const existing = await query(
        `SELECT id FROM pickup_points WHERE point_name = $1 AND id != $2 AND ${hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}`,
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

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    values.push(numericId);
    const result = await query(`
      UPDATE pickup_points
      SET ${updates.join(', ')}
      WHERE id = $${i} AND ${hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}
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
    const hasDeletedAt = await hasColumn('pickup_points', 'deleted_at');
    const numericId = parseInt(id);

    if (isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid pickup point ID');
    }

    const result = hasDeletedAt
      ? await query(
          'UPDATE pickup_points SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
          [numericId]
        )
      : await query(
          'UPDATE pickup_points SET is_active = false WHERE id = $1 RETURNING id',
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
