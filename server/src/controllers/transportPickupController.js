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
    
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      route_id,
      sortField = 'point_name', 
      sortOrder = 'ASC' 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const validSortFields = ['point_name', 'id', 'created_at', 'sequence_order'];
    
    const actualSortField = validSortFields.includes(sortField) ? sortField : 'point_name';
    const actualSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    let whereClause = `WHERE ${hasDeletedAt ? 'pp.deleted_at IS NULL' : '1=1'}`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND pp.point_name ILIKE $${params.length}`;
    }

    if (route_id && route_id !== 'all') {
      params.push(Number(route_id));
      whereClause += ` AND pp.route_id = $${params.length}`;
    }

    if (req.query.status && req.query.status !== 'all') {
      const isActive = req.query.status === 'active' || req.query.status === 'true' || req.query.status === true;
      params.push(isActive);
      whereClause += ` AND pp.is_active = $${params.length}`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM pickup_points pp ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    const dataResult = await query(
      `SELECT pp.*, r.route_name
       FROM pickup_points pp
       LEFT JOIN routes r ON pp.route_id = r.id
       ${whereClause} 
       ORDER BY pp.${actualSortField} ${actualSortOrder} 
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const data = dataResult.rows.map(mapPickupRow);

    return success(res, 200, 'Pickup points fetched successfully', data, { 
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / parseInt(limit))
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
    const { 
      route_id,
      point_name, 
      address,
      landmark,
      pickup_time,
      drop_time,
      distance_from_school,
      sequence_order
    } = req.body;

    if (!route_id || !point_name || sequence_order === undefined) {
      return errorResponse(res, 400, 'Route, point name and sequence order are required');
    }

    const result = await query(
      `INSERT INTO pickup_points (
        route_id, point_name, address, landmark, 
        pickup_time, drop_time, distance_from_school, sequence_order, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        Number(route_id), 
        String(point_name).trim(), 
        address || null,
        landmark || null,
        pickup_time || null,
        drop_time || null,
        distance_from_school || 0,
        Number(sequence_order),
        req.body.is_active !== false
      ]
    );

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
      route_id,
      point_name, 
      address,
      landmark,
      pickup_time,
      drop_time,
      distance_from_school,
      sequence_order
    } = req.body;

    const updates = [];
    const values = [];
    let i = 1;

    if (route_id !== undefined) {
      updates.push(`route_id = $${i++}`);
      values.push(Number(route_id));
    }
    if (point_name !== undefined) {
      updates.push(`point_name = $${i++}`);
      values.push(String(point_name).trim());
    }
    if (address !== undefined) {
      updates.push(`address = $${i++}`);
      values.push(address);
    }
    if (landmark !== undefined) {
      updates.push(`landmark = $${i++}`);
      values.push(landmark);
    }
    if (pickup_time !== undefined) {
      updates.push(`pickup_time = $${i++}`);
      values.push(pickup_time);
    }
    if (drop_time !== undefined) {
      updates.push(`drop_time = $${i++}`);
      values.push(drop_time);
    }
    if (distance_from_school !== undefined) {
      updates.push(`distance_from_school = $${i++}`);
      values.push(distance_from_school);
    }
    if (sequence_order !== undefined) {
      updates.push(`sequence_order = $${i++}`);
      values.push(Number(sequence_order));
    }
    if (req.body.is_active !== undefined) {
      updates.push(`is_active = $${i++}`);
      values.push(req.body.is_active !== false);
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
