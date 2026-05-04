const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getScopedDriverId, getScopedRouteIdsForDriver } = require('../utils/driverTransportAccess');
const { hasColumn, hasTable } = require('../utils/schemaInspector');

function normalizeNullableText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableNumber(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeNullableTime(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return /^\d{2}:\d{2}(:\d{2})?$/.test(trimmed) ? trimmed : null;
}

function buildPickupContextFlags(flags) {
  return {
    hasAddress: !!flags.hasAddress,
    hasLandmark: !!flags.hasLandmark,
    hasPickupTime: !!flags.hasPickupTime,
    hasDropTime: !!flags.hasDropTime,
    hasDistanceFromSchool: !!flags.hasDistanceFromSchool,
    hasRouteId: !!flags.hasRouteId,
    hasSequenceOrder: !!flags.hasSequenceOrder,
    hasIsActive: !!flags.hasIsActive,
    hasDeletedAt: !!flags.hasDeletedAt,
    hasUpdatedAt: !!flags.hasUpdatedAt,
    hasModifiedAt: !!flags.hasModifiedAt,
  };
}

async function getPickupContextFlags() {
  const [
    hasAddress,
    hasLandmark,
    hasPickupTime,
    hasDropTime,
    hasDistanceFromSchool,
    hasRouteId,
    hasSequenceOrder,
    hasIsActive,
    hasDeletedAt,
    hasUpdatedAt,
    hasModifiedAt,
  ] = await Promise.all([
    hasColumn('pickup_points', 'address'),
    hasColumn('pickup_points', 'landmark'),
    hasColumn('pickup_points', 'pickup_time'),
    hasColumn('pickup_points', 'drop_time'),
    hasColumn('pickup_points', 'distance_from_school'),
    hasColumn('pickup_points', 'route_id'),
    hasColumn('pickup_points', 'sequence_order'),
    hasColumn('pickup_points', 'is_active'),
    hasColumn('pickup_points', 'deleted_at'),
    hasColumn('pickup_points', 'updated_at'),
    hasColumn('pickup_points', 'modified_at'),
  ]);

  return buildPickupContextFlags({
    hasAddress,
    hasLandmark,
    hasPickupTime,
    hasDropTime,
    hasDistanceFromSchool,
    hasRouteId,
    hasSequenceOrder,
    hasIsActive,
    hasDeletedAt,
    hasUpdatedAt,
    hasModifiedAt,
  });
}

function mapPickupRow(row, flags) {
  const isActive = flags.hasIsActive
    ? row.is_active !== false && row.is_active !== 'f'
    : true;
  const updatedAt = flags.hasUpdatedAt
    ? row.updated_at
    : (flags.hasModifiedAt ? row.modified_at : null);

  return {
    id: row.id,
    point_name: row.point_name || '',
    route_id: flags.hasRouteId ? row.route_id ?? null : null,
    route_name: row.route_name || null,
    address: flags.hasAddress ? (row.address || '') : '',
    landmark: flags.hasLandmark ? (row.landmark || '') : '',
    pickup_time: flags.hasPickupTime ? (row.pickup_time || null) : null,
    drop_time: flags.hasDropTime ? (row.drop_time || null) : null,
    distance_from_school: flags.hasDistanceFromSchool ? row.distance_from_school : null,
    sequence_order: flags.hasSequenceOrder ? row.sequence_order : null,
    is_active: isActive,
    created_at: row.created_at,
    updated_at: updatedAt
  };
}

const getAllPickupPoints = async (req, res) => {
  try {
    const flags = await getPickupContextFlags();
    const hasDeletedAt = flags.hasDeletedAt;
    const hasRouteStops = await hasTable('route_stops');
    const scopedDriverId = await getScopedDriverId(req);
    const selectRouteName = flags.hasRouteId ? 'LEFT JOIN routes r ON r.id = pp.route_id' : '';
    const routeNameField = flags.hasRouteId ? ', r.route_name' : ', NULL::text AS route_name';
    if (scopedDriverId != null) {
      const routeIds = await getScopedRouteIdsForDriver(scopedDriverId);
      if (routeIds.length === 0) {
        return success(res, 200, 'Pickup points fetched successfully', [], { total: 0, page: 1, limit: 0 });
      }
      const result = hasRouteStops
        ? await query(
            `SELECT DISTINCT pp.* ${routeNameField}
             FROM pickup_points pp
             ${selectRouteName}
             JOIN route_stops rs ON rs.pickup_point_id = pp.id
             WHERE ${hasDeletedAt ? 'pp.deleted_at IS NULL' : '1=1'}
               AND rs.route_id = ANY($1::int[])
             ORDER BY pp.point_name ASC`,
            [routeIds]
          )
        : await query(
            `SELECT DISTINCT pp.* ${routeNameField}
             FROM pickup_points pp
             ${selectRouteName}
             WHERE ${hasDeletedAt ? 'pp.deleted_at IS NULL' : '1=1'}
               ${flags.hasRouteId ? 'AND pp.route_id = ANY($1::int[])' : ''}
             ORDER BY pp.point_name ASC`,
            flags.hasRouteId ? [routeIds] : []
          );
      const data = result.rows.map((row) => mapPickupRow(row, flags));
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
      route_id,
      sortField = 'point_name', 
      sortOrder = 'ASC' 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const validSortFields = ['point_name', 'id', 'created_at']
      .concat(flags.hasRouteId ? ['route_name'] : [])
      .concat(flags.hasIsActive ? ['is_active'] : [])
      .concat(flags.hasRouteId ? ['route_id'] : [])
      .concat(flags.hasPickupTime ? ['pickup_time'] : [])
      .concat(flags.hasDropTime ? ['drop_time'] : [])
      .concat(flags.hasDistanceFromSchool ? ['distance_from_school'] : []);
    
    const actualSortField = validSortFields.includes(sortField) ? sortField : 'point_name';
    const actualSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    let baseSql = `
      FROM pickup_points pp
      ${flags.hasRouteId ? 'LEFT JOIN routes r ON r.id = pp.route_id' : ''}
      WHERE ${hasDeletedAt ? 'pp.deleted_at IS NULL' : '1=1'}
    `;
    
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      const searchParts = ['pp.point_name ILIKE $' + params.length];
      if (flags.hasAddress) searchParts.push('pp.address ILIKE $' + params.length);
      if (flags.hasLandmark) searchParts.push('pp.landmark ILIKE $' + params.length);
      if (flags.hasRouteId) searchParts.push('r.route_name ILIKE $' + params.length);
      sqlFilters += ` AND (${searchParts.join(' OR ')})`;
    }

    if (status !== 'all' && flags.hasIsActive) {
      params.push(status === 'active');
      sqlFilters += ` AND pp.is_active = $${params.length}`;
    }

    const countSql = `SELECT COUNT(*) ${baseSql} ${sqlFilters}`;
    const dataSql = `
      SELECT pp.*, ${flags.hasRouteId ? 'r.route_name' : 'NULL::text AS route_name'}
      ${baseSql} 
      ${sqlFilters} 
      ORDER BY ${actualSortField.startsWith('route_') ? actualSortField.replace('route_', 'r.route_') : `pp.${actualSortField}`} ${actualSortOrder} 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const queryParams = [...params, parseInt(limit), offset];

    const [result, countResult] = await Promise.all([
      query(dataSql, queryParams),
      query(countSql, params)
    ]);

    const data = result.rows.map((row) => mapPickupRow(row, flags));
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
    const flags = await getPickupContextFlags();
    const hasDeletedAt = flags.hasDeletedAt;
    const hasRouteStops = await hasTable('route_stops');
    const scopedDriverId = await getScopedDriverId(req);
    const result = await query(`
      SELECT pp.*, ${flags.hasRouteId ? 'r.route_name' : 'NULL::text AS route_name'}
      FROM pickup_points pp
      ${flags.hasRouteId ? 'LEFT JOIN routes r ON r.id = pp.route_id' : ''}
      WHERE pp.id = $1 AND ${hasDeletedAt ? 'pp.deleted_at IS NULL' : '1=1'}
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
    return success(res, 200, 'Pickup point fetched successfully', mapPickupRow(result.rows[0], flags));
  } catch (error) {
    console.error('Error fetching pickup point:', error);
    return errorResponse(res, 500, 'Failed to fetch pickup point');
  }
};

const createPickupPoint = async (req, res) => {
  try {
    const flags = await getPickupContextFlags();
    const hasDeletedAt = flags.hasDeletedAt;
    const { 
      route_id,
      point_name, 
      route_id,
      address,
      landmark,
      pickup_time,
      drop_time,
      distance_from_school,
      sequence_order,
      is_active 
    } = req.body;

    if (!point_name) {
      return errorResponse(res, 400, 'Pickup point name is required');
    }

    // Check for duplicate name
    const duplicateParams = [point_name];
    let duplicateSql = `SELECT id FROM pickup_points WHERE point_name = $1 AND ${hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}`;
    if (flags.hasRouteId && route_id != null && String(route_id).trim() !== '') {
      duplicateParams.push(Number(route_id));
      duplicateSql += ` AND route_id = $2`;
    }
    const existing = await query(
      duplicateSql,
      duplicateParams
    );
    if (existing.rows.length > 0) {
      return errorResponse(res, 400, 'A pickup point with this name already exists');
    }

    const payloadValues = [point_name];
    const columns = ['point_name'];
    const placeholders = ['$1'];

    if (flags.hasRouteId && (route_id === undefined || route_id === null || String(route_id).trim() === '')) {
      return errorResponse(res, 400, 'Route is required for pickup point');
    }

    if (flags.hasRouteId && route_id !== undefined) {
      const routeIdValue = route_id === null || route_id === '' ? null : Number(route_id);
      if (routeIdValue !== null && !Number.isInteger(routeIdValue)) {
        return errorResponse(res, 400, 'Route ID must be a valid integer');
      }
      columns.push('route_id');
      payloadValues.push(routeIdValue);
      placeholders.push(`$${payloadValues.length}`);
    }
    if (flags.hasAddress && address !== undefined) {
      columns.push('address');
      payloadValues.push(normalizeNullableText(address));
      placeholders.push(`$${payloadValues.length}`);
    }
    if (flags.hasLandmark && landmark !== undefined) {
      columns.push('landmark');
      payloadValues.push(normalizeNullableText(landmark));
      placeholders.push(`$${payloadValues.length}`);
    }
    if (flags.hasPickupTime && pickup_time !== undefined) {
      const t = normalizeNullableTime(pickup_time);
      if (pickup_time != null && String(pickup_time).trim() !== '' && t === null) {
        return errorResponse(res, 400, 'Invalid pickup time format. Use HH:mm');
      }
      columns.push('pickup_time');
      payloadValues.push(t);
      placeholders.push(`$${payloadValues.length}`);
    }
    if (flags.hasDropTime && drop_time !== undefined) {
      const t = normalizeNullableTime(drop_time);
      if (drop_time != null && String(drop_time).trim() !== '' && t === null) {
        return errorResponse(res, 400, 'Invalid drop time format. Use HH:mm');
      }
      columns.push('drop_time');
      payloadValues.push(t);
      placeholders.push(`$${payloadValues.length}`);
    }
    if (flags.hasDistanceFromSchool && distance_from_school !== undefined) {
      const distance = normalizeNullableNumber(distance_from_school);
      if (Number.isNaN(distance)) {
        return errorResponse(res, 400, 'Distance from school must be a valid number');
      }
      columns.push('distance_from_school');
      payloadValues.push(distance);
      placeholders.push(`$${payloadValues.length}`);
    }
    if (flags.hasSequenceOrder) {
      const sequence = sequence_order === undefined || sequence_order === null || sequence_order === ''
        ? 0
        : Number(sequence_order);
      if (!Number.isInteger(sequence) || sequence < 0) {
        return errorResponse(res, 400, 'Sequence order must be a non-negative integer');
      }
      columns.push('sequence_order');
      payloadValues.push(sequence);
      placeholders.push(`$${payloadValues.length}`);
    }
    if (flags.hasIsActive) {
      columns.push('is_active');
      payloadValues.push(is_active !== false);
      placeholders.push(`$${payloadValues.length}`);
    }

    const result = await query(
      `INSERT INTO pickup_points (${columns.join(', ')}) VALUES (${placeholders.join(', ')})
       RETURNING *`,
      payloadValues
    );

    return success(res, 201, 'Pickup point created successfully', mapPickupRow(result.rows[0], flags));
  } catch (error) {
    console.error('Error creating pickup point:', error);
    return errorResponse(res, 500, 'Failed to create pickup point');
  }
};

const updatePickupPoint = async (req, res) => {
  try {
    const flags = await getPickupContextFlags();
    const hasDeletedAt = flags.hasDeletedAt;
    const { id } = req.params;
    const numericId = parseInt(id);

    if (isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid pickup point ID');
    }

    const { 
      route_id,
      point_name, 
      route_id,
      address,
      landmark,
      pickup_time,
      drop_time,
      distance_from_school,
      sequence_order,
      is_active 
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
    if (is_active !== undefined) {
      if (flags.hasIsActive) {
        updates.push(`is_active = $${i++}`);
        values.push(is_active !== false);
      }
    }
    if (route_id !== undefined && flags.hasRouteId) {
      const routeIdValue = route_id === null || route_id === '' ? null : Number(route_id);
      if (routeIdValue !== null && !Number.isInteger(routeIdValue)) {
        return errorResponse(res, 400, 'Route ID must be a valid integer');
      }
      updates.push(`route_id = $${i++}`);
      values.push(routeIdValue);
    }
    if (address !== undefined && flags.hasAddress) {
      updates.push(`address = $${i++}`);
      values.push(normalizeNullableText(address));
    }
    if (landmark !== undefined && flags.hasLandmark) {
      updates.push(`landmark = $${i++}`);
      values.push(normalizeNullableText(landmark));
    }
    if (pickup_time !== undefined && flags.hasPickupTime) {
      const t = normalizeNullableTime(pickup_time);
      if (pickup_time != null && String(pickup_time).trim() !== '' && t === null) {
        return errorResponse(res, 400, 'Invalid pickup time format. Use HH:mm');
      }
      updates.push(`pickup_time = $${i++}`);
      values.push(t);
    }
    if (drop_time !== undefined && flags.hasDropTime) {
      const t = normalizeNullableTime(drop_time);
      if (drop_time != null && String(drop_time).trim() !== '' && t === null) {
        return errorResponse(res, 400, 'Invalid drop time format. Use HH:mm');
      }
      updates.push(`drop_time = $${i++}`);
      values.push(t);
    }
    if (distance_from_school !== undefined && flags.hasDistanceFromSchool) {
      const distance = normalizeNullableNumber(distance_from_school);
      if (Number.isNaN(distance)) {
        return errorResponse(res, 400, 'Distance from school must be a valid number');
      }
      updates.push(`distance_from_school = $${i++}`);
      values.push(distance);
    }
    if (sequence_order !== undefined && flags.hasSequenceOrder) {
      const sequence = Number(sequence_order);
      if (!Number.isInteger(sequence) || sequence < 0) {
        return errorResponse(res, 400, 'Sequence order must be a non-negative integer');
      }
      updates.push(`sequence_order = $${i++}`);
      values.push(sequence);
    }
    if (flags.hasUpdatedAt) {
      updates.push(`updated_at = NOW()`);
    } else if (flags.hasModifiedAt) {
      updates.push(`modified_at = NOW()`);
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

    return success(res, 200, 'Pickup point updated successfully', mapPickupRow(result.rows[0], flags));
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
