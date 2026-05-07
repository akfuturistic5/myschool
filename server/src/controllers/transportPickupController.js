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

function toPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return fallback;
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
  const isActive = flags.hasIsActive ? row.is_active !== false && row.is_active !== 'f' : true;
  const updatedAt = flags.hasUpdatedAt ? row.updated_at : (flags.hasModifiedAt ? row.modified_at : null);

  return {
    id: row.id,
    point_name: row.point_name || '',
    route_id: flags.hasRouteId ? row.route_id ?? null : null,
    route_name: row.route_name || null,
    address: flags.hasAddress ? row.address || '' : '',
    landmark: flags.hasLandmark ? row.landmark || '' : '',
    pickup_time: flags.hasPickupTime ? row.pickup_time || null : null,
    drop_time: flags.hasDropTime ? row.drop_time || null : null,
    distance_from_school: flags.hasDistanceFromSchool ? row.distance_from_school : null,
    sequence_order: flags.hasSequenceOrder ? row.sequence_order : null,
    is_active: isActive,
    created_at: row.created_at,
    updated_at: updatedAt,
  };
}

const getAllPickupPoints = async (req, res) => {
  try {
    const flags = await getPickupContextFlags();
    const hasRouteStops = await hasTable('route_stops');
    const scopedDriverId = await getScopedDriverId(req);
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
      route_id = 'all',
      sortField = 'point_name',
      sortOrder = 'ASC',
    } = req.query;

    const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
    const pageLimit = Math.max(Number.parseInt(limit, 10) || 10, 1);
    const offset = (pageNumber - 1) * pageLimit;

    const routeJoin = flags.hasRouteId ? 'LEFT JOIN routes r ON r.id = pp.route_id' : '';
    const routeNameField = flags.hasRouteId ? 'r.route_name' : 'NULL::text AS route_name';
    const params = [];
    let whereClause = `WHERE ${flags.hasDeletedAt ? 'pp.deleted_at IS NULL' : '1=1'}`;

    if (search) {
      params.push(`%${search}%`);
      const searchParts = [`pp.point_name ILIKE $${params.length}`];
      if (flags.hasAddress) searchParts.push(`pp.address ILIKE $${params.length}`);
      if (flags.hasLandmark) searchParts.push(`pp.landmark ILIKE $${params.length}`);
      if (flags.hasRouteId) searchParts.push(`r.route_name ILIKE $${params.length}`);
      whereClause += ` AND (${searchParts.join(' OR ')})`;
    }

    if (status !== 'all' && flags.hasIsActive) {
      params.push(parseBoolean(status, true));
      whereClause += ` AND pp.is_active = $${params.length}`;
    }

    if (route_id !== 'all' && flags.hasRouteId) {
      const routeId = toPositiveInt(route_id);
      if (!routeId) return errorResponse(res, 400, 'Invalid route ID filter');
      params.push(routeId);
      whereClause += ` AND pp.route_id = $${params.length}`;
    }

    if (scopedDriverId != null) {
      const routeIds = await getScopedRouteIdsForDriver(scopedDriverId);
      if (routeIds.length === 0) {
        return success(res, 200, 'Pickup points fetched successfully', [], {
          total: 0,
          page: pageNumber,
          limit: pageLimit,
          totalPages: 0,
        });
      }
      params.push(routeIds);
      if (hasRouteStops) {
        whereClause += ` AND EXISTS (
          SELECT 1
          FROM route_stops rs
          WHERE rs.pickup_point_id = pp.id
            AND rs.route_id = ANY($${params.length}::int[])
        )`;
      } else if (flags.hasRouteId) {
        whereClause += ` AND pp.route_id = ANY($${params.length}::int[])`;
      } else {
        return success(res, 200, 'Pickup points fetched successfully', [], {
          total: 0,
          page: pageNumber,
          limit: pageLimit,
          totalPages: 0,
        });
      }
    }

    const sortMap = {
      id: 'pp.id',
      point_name: 'pp.point_name',
      created_at: 'pp.created_at',
      route_name: 'r.route_name',
      route_id: 'pp.route_id',
      pickup_time: 'pp.pickup_time',
      drop_time: 'pp.drop_time',
      distance_from_school: 'pp.distance_from_school',
      is_active: 'pp.is_active',
    };
    const allowedSortFields = ['id', 'point_name', 'created_at']
      .concat(flags.hasRouteId ? ['route_name', 'route_id'] : [])
      .concat(flags.hasPickupTime ? ['pickup_time'] : [])
      .concat(flags.hasDropTime ? ['drop_time'] : [])
      .concat(flags.hasDistanceFromSchool ? ['distance_from_school'] : [])
      .concat(flags.hasIsActive ? ['is_active'] : []);
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'point_name';
    const safeSortOrder = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const orderBy = sortMap[safeSortField] || 'pp.point_name';

    const countSql = `
      SELECT COUNT(*)
      FROM pickup_points pp
      ${routeJoin}
      ${whereClause}
    `;

    const dataSql = `
      SELECT pp.*, ${routeNameField}
      FROM pickup_points pp
      ${routeJoin}
      ${whereClause}
      ORDER BY ${orderBy} ${safeSortOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [countResult, result] = await Promise.all([
      query(countSql, params),
      query(dataSql, [...params, pageLimit, offset]),
    ]);

    const totalCount = Number.parseInt(countResult.rows[0]?.count || '0', 10);
    const data = result.rows.map((row) => mapPickupRow(row, flags));

    return success(res, 200, 'Pickup points fetched successfully', data, { 
      total: totalCount,
      page: pageNumber,
      limit: pageLimit,
      totalPages: Math.ceil(totalCount / pageLimit),
    });
  } catch (err) {
    console.error('Error fetching pickup points:', err);
    return errorResponse(res, 500, 'Failed to fetch pickup points');
  }
};

const getPickupPointById = async (req, res) => {
  try {
    const flags = await getPickupContextFlags();
    const hasRouteStops = await hasTable('route_stops');
    const numericId = toPositiveInt(req.params.id);
    const scopedDriverId = await getScopedDriverId(req);

    if (!numericId) return errorResponse(res, 400, 'Invalid pickup point ID');

    const result = await query(
      `SELECT pp.*, ${flags.hasRouteId ? 'r.route_name' : 'NULL::text AS route_name'}
       FROM pickup_points pp
       ${flags.hasRouteId ? 'LEFT JOIN routes r ON r.id = pp.route_id' : ''}
       WHERE pp.id = $1
         AND ${flags.hasDeletedAt ? 'pp.deleted_at IS NULL' : '1=1'}`,
      [numericId]
    );

    if (!result.rows.length) return errorResponse(res, 404, 'Pickup point not found');

    if (scopedDriverId != null) {
      const routeIds = await getScopedRouteIdsForDriver(scopedDriverId);
      if (!routeIds.length) return errorResponse(res, 403, 'Access denied');

      const scoped = hasRouteStops
        ? await query(
            `SELECT 1
             FROM route_stops
             WHERE pickup_point_id = $1
               AND route_id = ANY($2::int[])
             LIMIT 1`,
            [numericId, routeIds]
          )
        : flags.hasRouteId
          ? await query(
              `SELECT 1
               FROM pickup_points
               WHERE id = $1
                 AND route_id = ANY($2::int[])
               LIMIT 1`,
              [numericId, routeIds]
            )
          : { rows: [] };

      if (!scoped.rows.length) return errorResponse(res, 403, 'Access denied');
    }

    return success(res, 200, 'Pickup point fetched successfully', mapPickupRow(result.rows[0], flags));
  } catch (err) {
    console.error('Error fetching pickup point:', err);
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
      address,
      landmark,
      pickup_time,
      drop_time,
      distance_from_school,
      sequence_order,
      is_active,
    } = req.body;

    const safePointName = normalizeNullableText(point_name);
    if (!safePointName) return errorResponse(res, 400, 'Pickup point name is required');

    // Check for duplicate name
    // const duplicateParams = [point_name];
    // let duplicateSql = `SELECT id FROM pickup_points WHERE point_name = $1 AND ${hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}`;
    if (flags.hasRouteId && route_id != null && String(route_id).trim() !== '') {
      duplicateParams.push(Number(route_id));
      duplicateSql += ` AND route_id = $2`;
    }
    // const existing = await query(
    //   duplicateSql,
    //   duplicateParams
    // );
    // if (existing.rows.length > 0) {
    //   return errorResponse(res, 400, 'A pickup point with this name already exists');
    //   sequence_order
    // } = req.body;

    if (!point_name) {
      return errorResponse(res, 400, 'Pickup point name is required');
    }

    const duplicateParams = [safePointName];
    let duplicateSql = `SELECT id FROM pickup_points WHERE point_name = $1 AND ${flags.hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}`;
    if (flags.hasRouteId && routeIdValue !== undefined) {
      duplicateParams.push(routeIdValue);
      duplicateSql += ` AND route_id = $2`;
    }
    const duplicateResult = await query(duplicateSql, duplicateParams);
    if (duplicateResult.rows.length > 0) {
      return errorResponse(res, 400, 'A pickup point with this name already exists');
    }

    if (!route_id || !point_name || sequence_order === undefined) {
      return errorResponse(res, 400, 'Route, point name and sequence order are required');
    }

    // const payloadValues = [point_name];
    // const columns = ['point_name'];
    // const placeholders = ['$1'];

    // if (flags.hasRouteId && (route_id === undefined || route_id === null || String(route_id).trim() === '')) {
    //   return errorResponse(res, 400, 'Route is required for pickup point');
    // }

    // if (flags.hasRouteId && route_id !== undefined) {
    //   const routeIdValue = route_id === null || route_id === '' ? null : Number(route_id);
    //   if (routeIdValue !== null && !Number.isInteger(routeIdValue)) {
    //     return errorResponse(res, 400, 'Route ID must be a valid integer');
    //   }
    //   columns.push('route_id');
    //   payloadValues.push(routeIdValue);
    //   placeholders.push(`$${payloadValues.length}`);
    // }
    // if (flags.hasAddress && address !== undefined) {
    //   columns.push('address');
    //   payloadValues.push(normalizeNullableText(address));
    //   placeholders.push(`$${payloadValues.length}`);
    // }
    // if (flags.hasLandmark && landmark !== undefined) {
    //   columns.push('landmark');
    //   payloadValues.push(normalizeNullableText(landmark));
    //   placeholders.push(`$${payloadValues.length}`);
    // }
    // if (flags.hasPickupTime && pickup_time !== undefined) {
    //   const t = normalizeNullableTime(pickup_time);
    //   if (pickup_time != null && String(pickup_time).trim() !== '' && t === null) {
    //     return errorResponse(res, 400, 'Invalid pickup time format. Use HH:mm');
    //   }
    //   columns.push('pickup_time');
    //   payloadValues.push(t);
    //   placeholders.push(`$${payloadValues.length}`);
    // }
    // if (flags.hasDropTime && drop_time !== undefined) {
    //   const t = normalizeNullableTime(drop_time);
    //   if (drop_time != null && String(drop_time).trim() !== '' && t === null) {
    //     return errorResponse(res, 400, 'Invalid drop time format. Use HH:mm');
    //   }
    //   columns.push('drop_time');
    //   payloadValues.push(t);
    //   placeholders.push(`$${payloadValues.length}`);
    // }
    // if (flags.hasDistanceFromSchool && distance_from_school !== undefined) {
    //   const distance = normalizeNullableNumber(distance_from_school);
    //   if (Number.isNaN(distance)) {
    //     return errorResponse(res, 400, 'Distance from school must be a valid number');
    //   }
    //   columns.push('distance_from_school');
    //   payloadValues.push(distance);
    //   placeholders.push(`$${payloadValues.length}`);
    // }
    // if (flags.hasSequenceOrder) {
    //   const sequence = sequence_order === undefined || sequence_order === null || sequence_order === ''
    //     ? 0
    //     : Number(sequence_order);
    //   if (!Number.isInteger(sequence) || sequence < 0) {
    //     return errorResponse(res, 400, 'Sequence order must be a non-negative integer');
    //   }
    //   columns.push('sequence_order');
    //   payloadValues.push(sequence);
    //   placeholders.push(`$${payloadValues.length}`);
    // }
    // if (flags.hasIsActive) {
    //   columns.push('is_active');
    //   payloadValues.push(is_active !== false);
    //   placeholders.push(`$${payloadValues.length}`);
    // }

    const payloadValues = [point_name];
    const columns = ['point_name'];
    const values = [safePointName];
    const placeholders = ['$1'];

    if (flags.hasRouteId && routeIdValue !== undefined) {
      columns.push('route_id');
      values.push(routeIdValue);
      placeholders.push(`$${values.length}`);
    }
    if (flags.hasAddress && address !== undefined) {
      columns.push('address');
      values.push(normalizeNullableText(address));
      placeholders.push(`$${values.length}`);
    }
    if (flags.hasLandmark && landmark !== undefined) {
      columns.push('landmark');
      values.push(normalizeNullableText(landmark));
      placeholders.push(`$${values.length}`);
    }
    if (flags.hasPickupTime && pickup_time !== undefined) {
      const time = normalizeNullableTime(pickup_time);
      if (pickup_time != null && String(pickup_time).trim() !== '' && time === null) {
        return errorResponse(res, 400, 'Invalid pickup time format. Use HH:mm');
      }
      columns.push('pickup_time');
      values.push(time);
      placeholders.push(`$${values.length}`);
    }
    if (flags.hasDropTime && drop_time !== undefined) {
      const time = normalizeNullableTime(drop_time);
      if (drop_time != null && String(drop_time).trim() !== '' && time === null) {
        return errorResponse(res, 400, 'Invalid drop time format. Use HH:mm');
      }
      columns.push('drop_time');
      values.push(time);
      placeholders.push(`$${values.length}`);
    }
    if (flags.hasDistanceFromSchool && distance_from_school !== undefined) {
      const distance = normalizeNullableNumber(distance_from_school);
      if (Number.isNaN(distance)) {
        return errorResponse(res, 400, 'Distance from school must be a valid number');
      }
      columns.push('distance_from_school');
      values.push(distance);
      placeholders.push(`$${values.length}`);
    }
    if (flags.hasSequenceOrder) {
      const sequence = sequence_order === undefined || sequence_order === null || sequence_order === ''
        ? 0
        : Number(sequence_order);
      if (!Number.isInteger(sequence) || sequence < 0) {
        return errorResponse(res, 400, 'Sequence order must be a non-negative integer');
      }
      columns.push('sequence_order');
      values.push(sequence);
      placeholders.push(`$${values.length}`);
    }
    if (flags.hasIsActive) {
      columns.push('is_active');
      values.push(parseBoolean(is_active, true));
      placeholders.push(`$${values.length}`);
    }

    const result = await query(
      `INSERT INTO pickup_points (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      values
    );

    return success(res, 201, 'Pickup point created successfully', mapPickupRow(result.rows[0], flags));
  } catch (err) {
    console.error('Error creating pickup point:', err);
    return errorResponse(res, 500, 'Failed to create pickup point');
  }
};

const updatePickupPoint = async (req, res) => {
  try {
    const flags = await getPickupContextFlags();
    const numericId = toPositiveInt(req.params.id);
    if (!numericId) return errorResponse(res, 400, 'Invalid pickup point ID');

    const existingResult = await query(
      `SELECT *
       FROM pickup_points
       WHERE id = $1
         AND ${flags.hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}`,
      [numericId]
    );
    if (!existingResult.rows.length) return errorResponse(res, 404, 'Pickup point not found');

    const { 
      route_id,
      point_name,
      address,
      landmark,
      pickup_time,
      drop_time,
      distance_from_school,
      sequence_order,
      is_active,
    } = req.body;

    const updates = [];
    const values = [];
    let i = 1;

    let effectiveRouteId = flags.hasRouteId ? existing.route_id : null;
    if (route_id !== undefined && flags.hasRouteId) {
      const routeIdValue = route_id === null || route_id === '' ? null : Number(route_id);
      if (routeIdValue !== null && !Number.isInteger(routeIdValue)) {
        return errorResponse(res, 400, 'Route ID must be a valid integer');
      }
      updates.push(`route_id = $${i++}`);
      values.push(routeIdValue);
      effectiveRouteId = routeIdValue;
    }

    let safePointName;
    if (point_name !== undefined) {
      safePointName = normalizeNullableText(point_name);
      if (!safePointName) return errorResponse(res, 400, 'Pickup point name is required');
      updates.push(`point_name = $${i++}`);
      values.push(safePointName);
    }

    if ((safePointName !== undefined || route_id !== undefined) && flags.hasRouteId) {
      const duplicateName = safePointName !== undefined ? safePointName : existing.point_name;
      const duplicateResult = await query(
        `SELECT id
         FROM pickup_points
         WHERE point_name = $1
           AND route_id ${effectiveRouteId === null ? 'IS NULL' : '= $2'}
           AND id <> ${effectiveRouteId === null ? '$2' : '$3'}
           AND ${flags.hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}`,
        effectiveRouteId === null ? [duplicateName, numericId] : [duplicateName, effectiveRouteId, numericId]
      );
      if (duplicateResult.rows.length > 0) {
        return errorResponse(res, 400, 'A pickup point with this name already exists');
      }
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
      const time = normalizeNullableTime(pickup_time);
      if (pickup_time != null && String(pickup_time).trim() !== '' && time === null) {
        return errorResponse(res, 400, 'Invalid pickup time format. Use HH:mm');
      }
      updates.push(`pickup_time = $${i++}`);
      values.push(time);
    }
    if (drop_time !== undefined && flags.hasDropTime) {
      const time = normalizeNullableTime(drop_time);
      if (drop_time != null && String(drop_time).trim() !== '' && time === null) {
        return errorResponse(res, 400, 'Invalid drop time format. Use HH:mm');
      }
      updates.push(`drop_time = $${i++}`);
      values.push(time);
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
    if (is_active !== undefined && flags.hasIsActive) {
      updates.push(`is_active = $${i++}`);
      values.push(parseBoolean(is_active, true));
    }
    if (flags.hasUpdatedAt) {
      updates.push('updated_at = NOW()');
    } else if (flags.hasModifiedAt) {
      updates.push('modified_at = NOW()');
    }

    if (!updates.length) return errorResponse(res, 400, 'No fields to update');

    values.push(numericId);
    const result = await query(
      `UPDATE pickup_points
       SET ${updates.join(', ')}
       WHERE id = $${i}
         AND ${flags.hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}
       RETURNING *`,
      values
    );

    if (!result.rows.length) return errorResponse(res, 404, 'Pickup point not found');
    return success(res, 200, 'Pickup point updated successfully', mapPickupRow(result.rows[0], flags));
  } catch (err) {
    console.error('Error updating pickup point:', err);
    return errorResponse(res, 500, 'Failed to update pickup point');
  }
};

const deletePickupPoint = async (req, res) => {
  try {
    const numericId = toPositiveInt(req.params.id);
    const hasDeletedAt = await hasColumn('pickup_points', 'deleted_at');

    if (!numericId) return errorResponse(res, 400, 'Invalid pickup point ID');

    const result = hasDeletedAt
      ? await query(
          `UPDATE pickup_points
           SET deleted_at = NOW()
           WHERE id = $1 AND deleted_at IS NULL
           RETURNING id`,
          [numericId]
        )
      : await query(
          `UPDATE pickup_points
           SET is_active = false
           WHERE id = $1
           RETURNING id`,
          [numericId]
        );

    if (!result.rows.length) {
      return errorResponse(res, 404, 'Pickup point not found or already deleted');
    }
    return success(res, 200, 'Pickup point deleted successfully');
  } catch (err) {
    console.error('Error deleting pickup point:', err);
    return errorResponse(res, 500, 'Failed to delete pickup point');
  }
};

module.exports = {
  getAllPickupPoints,
  getPickupPointById,
  createPickupPoint,
  updatePickupPoint,
  deletePickupPoint,
};
