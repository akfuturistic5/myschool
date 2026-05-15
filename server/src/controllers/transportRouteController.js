const { query, executeTransaction } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getScopedDriverId, getScopedRouteIdsForDriver } = require('../utils/driverTransportAccess');
const { hasColumn, hasTable } = require('../utils/schemaInspector');

function mapRouteRow(row, stops = []) {
  return {
    id: row.id,
    route_name: row.route_name || '',
    route_code: row.route_code || null,
    start_time: row.start_time || row.start_point || null,
    end_time: row.end_time || row.end_point || null,
    distance_km: row.distance_km ?? row.total_distance ?? 0,
    total_distance: row.total_distance ?? row.distance_km ?? 0,
    estimated_time: row.estimated_time ?? null,
    is_active: row.is_active !== false && row.is_active !== 'f',
    created_at: row.created_at,
    updated_at: row.updated_at,
    stops: stops.map(s => ({
      id: s.id,
      pickup_point_id: s.pickup_point_id,
      point_name: s.point_name,
      pickup_time: s.pickup_time,
      drop_time: s.drop_time,
      order_index: s.order_index
    })).sort((a, b) => a.order_index - b.order_index)
  };
}

const getAllRoutes = async (req, res) => {
  try {
    const hasDeletedAt = await hasColumn('routes', 'deleted_at');
    const hasRouteStops = await hasTable('route_stops');
    const hasRouteCode = await hasColumn('routes', 'route_code');
    const hasStartTime = await hasColumn('routes', 'start_time');
    const hasEndTime = await hasColumn('routes', 'end_time');
    const hasStartPoint = await hasColumn('routes', 'start_point');
    const hasEndPoint = await hasColumn('routes', 'end_point');
    const hasEstimatedTime = await hasColumn('routes', 'estimated_time');
    const hasTotalDistance = await hasColumn('routes', 'total_distance');
    const scopedDriverId = await getScopedDriverId(req);
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = 'all', 
      pickup_point_id = 'all',
      sortField = 'route_name', 
      sortOrder = 'ASC' 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const validSortFields = ['route_name', 'distance_km', 'created_at', 'id'];
    if (hasRouteCode) validSortFields.push('route_code');
    if (hasStartTime) validSortFields.push('start_time');
    if (hasEndTime) validSortFields.push('end_time');
    if (hasStartPoint) validSortFields.push('start_point');
    if (hasEndPoint) validSortFields.push('end_point');
    if (hasEstimatedTime) validSortFields.push('estimated_time');
    if (hasTotalDistance) validSortFields.push('total_distance');
    
    let actualSortField = validSortFields.includes(sortField) ? sortField : 'route_name';
    actualSortField = `r.${actualSortField}`;

    const actualSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    let baseSql = `
      FROM routes r
      WHERE ${hasDeletedAt ? 'r.deleted_at IS NULL' : '(r.is_active IS NOT FALSE OR r.is_active IS NULL)'}
    `;
    
    const params = [];
    let sqlFilters = '';

    if (search) {
      params.push(`%${search}%`);
      const searchParts = [`r.route_name ILIKE $${params.length}`];
      if (hasRouteCode) searchParts.push(`r.route_code ILIKE $${params.length}`);
      if (hasStartTime) searchParts.push(`CAST(r.start_time AS TEXT) ILIKE $${params.length}`);
      if (hasEndTime) searchParts.push(`CAST(r.end_time AS TEXT) ILIKE $${params.length}`);
      if (hasStartPoint) searchParts.push(`r.start_point ILIKE $${params.length}`);
      if (hasEndPoint) searchParts.push(`r.end_point ILIKE $${params.length}`);
      sqlFilters += ` AND (${searchParts.join(' OR ')})`;
    }

    if (status !== 'all') {
      const isActive = status === 'active' || status === 'true' || status === true;
      params.push(isActive);
      sqlFilters += ` AND r.is_active = $${params.length}`;
    }

    // If filtering by pickup_point_id, we need a subquery or join
    if (pickup_point_id !== 'all') {
      params.push(parseInt(pickup_point_id));
      sqlFilters += hasRouteStops
        ? ` AND EXISTS (SELECT 1 FROM route_stops rs WHERE rs.route_id = r.id AND rs.pickup_point_id = $${params.length})`
        : ` AND EXISTS (SELECT 1 FROM pickup_points pp WHERE pp.route_id = r.id AND pp.id = $${params.length})`;
    }

    if (scopedDriverId != null) {
      const routeIds = await getScopedRouteIdsForDriver(scopedDriverId);
      if (routeIds.length === 0) {
        return success(res, 200, 'Transport routes fetched successfully', [], {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
        });
      }
      params.push(routeIds);
      sqlFilters += ` AND r.id = ANY($${params.length}::int[])`;
    }

    const countSql = `SELECT COUNT(*) ${baseSql} ${sqlFilters}`;
    const dataSql = `
      SELECT r.*
      ${baseSql} 
      ${sqlFilters} 
      ORDER BY ${actualSortField} ${actualSortOrder} 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [result, countResult] = await Promise.all([
      query(dataSql, [...params, parseInt(limit), offset]),
      query(countSql, params)
    ]);

    const routes = result.rows;
    const totalCount = parseInt(countResult.rows[0].count);

    if (routes.length === 0) {
      return success(res, 200, 'Transport routes fetched successfully', [], { 
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    }

    // Fetch stops for all routes in the current page
    const routeIds = routes.map(r => r.id);
    const stopsResult = hasRouteStops
      ? await query(`
          SELECT rs.*, pp.point_name
          FROM route_stops rs
          JOIN pickup_points pp ON rs.pickup_point_id = pp.id
          WHERE rs.route_id = ANY($1)
          ORDER BY rs.route_id, rs.order_index
        `, [routeIds])
      : await query(`
          SELECT
            pp.id,
            pp.route_id,
            pp.id AS pickup_point_id,
            pp.point_name,
            pp.pickup_time,
            pp.drop_time,
            COALESCE(pp.sequence_order, 0) AS order_index
          FROM pickup_points pp
          WHERE pp.route_id = ANY($1)
          ORDER BY pp.route_id, COALESCE(pp.sequence_order, 0), pp.id
        `, [routeIds]);

    const stopsByRoute = {};
    stopsResult.rows.forEach(stop => {
      if (!stopsByRoute[stop.route_id]) {
        stopsByRoute[stop.route_id] = [];
      }
      stopsByRoute[stop.route_id].push(stop);
    });

    const data = routes.map(r => mapRouteRow(r, stopsByRoute[r.id] || []));

    return success(res, 200, 'Transport routes fetched successfully', data, { 
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Error fetching transport routes:', error);
    return errorResponse(res, 500, 'Failed to fetch transport routes');
  }
};

const getRouteById = async (req, res) => {
  try {
    const { id } = req.params;
    const hasDeletedAt = await hasColumn('routes', 'deleted_at');
    const hasRouteStops = await hasTable('route_stops');
    const scopedDriverId = await getScopedDriverId(req);
    if (scopedDriverId != null) {
      const routeIds = await getScopedRouteIdsForDriver(scopedDriverId);
      if (!routeIds.map(Number).includes(Number(id))) {
        return errorResponse(res, 403, 'Access denied');
      }
    }
    const routeResult = await query(`
      SELECT * FROM routes
      WHERE id = $1 AND ${hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}
    `, [id]);

    if (routeResult.rows.length === 0) {
      return errorResponse(res, 404, 'Route not found');
    }

    const stopsResult = hasRouteStops
      ? await query(`
          SELECT rs.*, pp.point_name
          FROM route_stops rs
          JOIN pickup_points pp ON rs.pickup_point_id = pp.id
          WHERE rs.route_id = $1
          ORDER BY rs.order_index
        `, [id])
      : await query(`
          SELECT
            pp.id,
            pp.route_id,
            pp.id AS pickup_point_id,
            pp.point_name,
            pp.pickup_time,
            pp.drop_time,
            COALESCE(pp.sequence_order, 0) AS order_index
          FROM pickup_points pp
          WHERE pp.route_id = $1
          ORDER BY COALESCE(pp.sequence_order, 0), pp.id
        `, [id]);

    return success(res, 200, 'Transport route fetched successfully', mapRouteRow(routeResult.rows[0], stopsResult.rows));
  } catch (error) {
    console.error('Error fetching transport route:', error);
    return errorResponse(res, 500, 'Failed to fetch transport route');
  }
};

const createRoute = async (req, res) => {
  try {
    const hasDistanceKm = await hasColumn('routes', 'distance_km');
    const hasTotalDistance = await hasColumn('routes', 'total_distance');
    const hasRouteCode = await hasColumn('routes', 'route_code');
    const hasStartTime = await hasColumn('routes', 'start_time');
    const hasEndTime = await hasColumn('routes', 'end_time');
    const hasStartPoint = await hasColumn('routes', 'start_point');
    const hasEndPoint = await hasColumn('routes', 'end_point');
    const hasEstimatedTime = await hasColumn('routes', 'estimated_time');
    const hasRouteStops = await hasTable('route_stops');
    const { 
      route_name, 
      distance_km, 
      total_distance,
      route_code,
      start_time,
      end_time,
      estimated_time,
      is_active,
      stops = [] 
    } = req.body;

    if (!route_name) {
      return errorResponse(res, 400, 'Route name is required');
    }

    const result = await executeTransaction(async (client) => {
      // 1. Insert Route
      const insertCols = ['route_name'];
      const insertVals = [route_name];

      if (hasDistanceKm) {
        insertCols.push('distance_km');
        insertVals.push(distance_km ?? total_distance ?? 0);
      }
      if (hasTotalDistance) {
        insertCols.push('total_distance');
        insertVals.push(total_distance ?? distance_km ?? 0);
      }
      if (hasRouteCode) {
        insertCols.push('route_code');
        insertVals.push(route_code ? String(route_code).trim() : null);
      }
      if (hasStartTime) {
        insertCols.push('start_time');
        insertVals.push(start_time ? String(start_time).trim() : null);
      } else if (hasStartPoint) {
        insertCols.push('start_point');
        insertVals.push(start_time ? String(start_time).trim() : null);
      }
      if (hasEndTime) {
        insertCols.push('end_time');
        insertVals.push(end_time ? String(end_time).trim() : null);
      } else if (hasEndPoint) {
        insertCols.push('end_point');
        insertVals.push(end_time ? String(end_time).trim() : null);
      }
      if (hasEstimatedTime) {
        insertCols.push('estimated_time');
        insertVals.push(estimated_time === '' || estimated_time == null ? null : Number(estimated_time));
      }

      insertCols.push('is_active');
      insertVals.push(is_active !== false);

      const placeholders = insertVals.map((_, idx) => `$${idx + 1}`).join(', ');
      const routeRes = await client.query(
        `INSERT INTO routes (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        insertVals
      );
      const newRoute = routeRes.rows[0];

      // 2. Insert Stops
      if (stops && stops.length > 0) {
        for (let i = 0; i < stops.length; i++) {
          const stop = stops[i];
          if (hasRouteStops) {
            await client.query(
              `INSERT INTO route_stops (route_id, pickup_point_id, pickup_time, drop_time, order_index, created_by, updated_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [newRoute.id, stop.pickup_point_id, stop.pickup_time, stop.drop_time, i, req.user?.id || null, req.user?.id || null]
            );
          } else {
            await client.query(
              `UPDATE pickup_points
               SET route_id = $1,
                   pickup_time = COALESCE($2, pickup_time),
                   drop_time = COALESCE($3, drop_time),
                   sequence_order = $4
               WHERE id = $5`,
              [newRoute.id, stop.pickup_time || null, stop.drop_time || null, i, stop.pickup_point_id]
            );
          }
        }
      }

      return newRoute;
    });

    // Fetch full route info for response
    return getRouteById({ params: { id: result.id } }, res);
  } catch (error) {
    console.error('Error creating transport route:', error);
    if (error?.code === '23505' && error?.constraint === 'uq_route_code') {
      return errorResponse(res, 409, 'Route code already exists');
    }
    return errorResponse(res, 500, 'Failed to create transport route');
  }
};

const updateRoute = async (req, res) => {
  try {
    const hasDistanceKm = await hasColumn('routes', 'distance_km');
    const hasTotalDistance = await hasColumn('routes', 'total_distance');
    const hasRouteCode = await hasColumn('routes', 'route_code');
    const hasStartTime = await hasColumn('routes', 'start_time');
    const hasEndTime = await hasColumn('routes', 'end_time');
    const hasStartPoint = await hasColumn('routes', 'start_point');
    const hasEndPoint = await hasColumn('routes', 'end_point');
    const hasEstimatedTime = await hasColumn('routes', 'estimated_time');
    const hasDeletedAt = await hasColumn('routes', 'deleted_at');
    const hasRouteStops = await hasTable('route_stops');
    const { id } = req.params;
    const numericId = parseInt(id);

    if (isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid route ID');
    }

    const { 
      route_name, 
      distance_km, 
      total_distance,
      route_code,
      start_time,
      end_time,
      estimated_time,
      is_active,
      stops = []
    } = req.body;

    await executeTransaction(async (client) => {
      // 1. Build Dynamic Route Update
      const updates = [];
      const values = [];
      let i = 1;

      if (route_name !== undefined) {
        updates.push(`route_name = $${i++}`);
        values.push(route_name);
      }
      if (distance_km !== undefined) {
        if (hasDistanceKm) {
          updates.push(`distance_km = $${i++}`);
          values.push(distance_km || 0);
        }
        if (hasTotalDistance && total_distance === undefined) {
          updates.push(`total_distance = $${i++}`);
          values.push(distance_km || 0);
        }
      }
      if (total_distance !== undefined && hasTotalDistance) {
        updates.push(`total_distance = $${i++}`);
        values.push(total_distance || 0);
      }
      if (route_code !== undefined && hasRouteCode) {
        updates.push(`route_code = $${i++}`);
        values.push(route_code ? String(route_code).trim() : null);
      }
      if (start_time !== undefined && hasStartTime) {
        updates.push(`start_time = $${i++}`);
        values.push(start_time ? String(start_time).trim() : null);
      } else if (start_time !== undefined && hasStartPoint) {
        updates.push(`start_point = $${i++}`);
        values.push(start_time ? String(start_time).trim() : null);
      }
      if (end_time !== undefined && hasEndTime) {
        updates.push(`end_time = $${i++}`);
        values.push(end_time ? String(end_time).trim() : null);
      } else if (end_time !== undefined && hasEndPoint) {
        updates.push(`end_point = $${i++}`);
        values.push(end_time ? String(end_time).trim() : null);
      }
      if (estimated_time !== undefined && hasEstimatedTime) {
        updates.push(`estimated_time = $${i++}`);
        values.push(estimated_time === '' || estimated_time == null ? null : Number(estimated_time));
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${i++}`);
        values.push(is_active !== false);
      }

      if (updates.length > 0) {
        values.push(numericId);
        const routeRes = await client.query(`
          UPDATE routes
          SET ${updates.join(', ')}
          WHERE id = $${i} AND ${hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}
          RETURNING *
        `, values);

        if (routeRes.rows.length === 0) {
          throw new Error('Route not found');
        }
      }

      // 2. Sync Stops: Delete all and re-insert (Simple sync strategy)
      if (hasRouteStops) {
        await client.query('DELETE FROM route_stops WHERE route_id = $1', [numericId]);
      } else {
        await client.query('UPDATE pickup_points SET route_id = NULL WHERE route_id = $1', [numericId]);
      }
      
      if (stops && stops.length > 0) {
        for (let i = 0; i < stops.length; i++) {
          const stop = stops[i];
          if (hasRouteStops) {
            await client.query(
              `INSERT INTO route_stops (route_id, pickup_point_id, pickup_time, drop_time, order_index, created_by, updated_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [id, stop.pickup_point_id, stop.pickup_time, stop.drop_time, i, req.user?.id || null, req.user?.id || null]
            );
          } else {
            await client.query(
              `UPDATE pickup_points
               SET route_id = $1,
                   pickup_time = COALESCE($2, pickup_time),
                   drop_time = COALESCE($3, drop_time),
                   sequence_order = $4
               WHERE id = $5`,
              [id, stop.pickup_time || null, stop.drop_time || null, i, stop.pickup_point_id]
            );
          }
        }
      }
    });

    return getRouteById({ params: { id } }, res);
  } catch (error) {
    console.error('Error updating transport route:', error);
    if (error.message === 'Route not found') {
      return errorResponse(res, 404, 'Route not found');
    }
    if (error?.code === '23505' && error?.constraint === 'uq_route_code') {
      return errorResponse(res, 409, 'Route code already exists');
    }
    return errorResponse(res, 500, 'Failed to update transport route');
  }
};

const deleteRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const hasDeletedAt = await hasColumn('routes', 'deleted_at');
    const numericId = parseInt(id);

    if (isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid route ID');
    }

    const result = hasDeletedAt
      ? await query(
          'UPDATE routes SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
          [numericId]
        )
      : await query(
          'UPDATE routes SET is_active = false WHERE id = $1 RETURNING id',
          [numericId]
        );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Route not found or already deleted');
    }

    return success(res, 200, 'Route deleted successfully');
  } catch (error) {
    console.error('Error deleting transport route:', error);
    return errorResponse(res, 500, 'Failed to delete transport route');
  }
};

module.exports = { getAllRoutes, getRouteById, createRoute, updateRoute, deleteRoute };
