const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { hasColumn, hasTable } = require('../utils/schemaInspector');

const VEHICLE_TYPE_VALUES = ['Bus', 'Van', 'Car'];

function normalizeVehicleType(raw) {
  if (raw === undefined) return undefined;
  if (raw === null || String(raw).trim() === '') return null;
  const normalized = String(raw).trim();
  const match = VEHICLE_TYPE_VALUES.find((value) => value.toLowerCase() === normalized.toLowerCase());
  return match || null;
}

function parseDateOnly(raw) {
  if (raw === undefined) return undefined;
  if (raw === null || String(raw).trim() === '') return null;
  const value = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function mapVehicleRow(row) {
  return {
    id: row.id,
    vehicle_code: row.vehicle_code ?? `VEH-${String(row.id).padStart(4, '0')}`,
    vehicle_number: row.vehicle_number ?? '',
    vehicle_type: row.vehicle_type ?? null,
    brand: row.brand ?? null,
    vehicle_model: row.model ?? '',
    made_of_year: row.made_of_year ?? '',
    registration_number: row.registration_number ?? '',
    chassis_number: row.chassis_number ?? '',
    seat_capacity: row.seating_capacity ?? '',
    gps_device_id: row.gps_device_id ?? '',
    insurance_expiry: row.insurance_expiry ?? null,
    fitness_expiry: row.fitness_expiry ?? null,
    permit_expiry: row.permit_expiry ?? null,
    is_active: row.is_active !== false && row.is_active !== 'f',
    photo_url: row.photo_url || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    driver_name: row.driver_name || 'N/A',
    driver_phone: row.driver_phone || 'N/A',
    route_name: row.route_name || 'N/A',
    point_name: row.point_name || 'N/A',
  };
}

const getAllVehicles = async (req, res) => {
  try {
    const hasDeletedAt = await hasColumn('transport_vehicles', 'deleted_at');
    const hasRouteStops = await hasTable('route_stops');
    const hasTransportAssignments = await hasTable('transport_assignments');
    const hasVehicleRouteAssignments = await hasTable('vehicle_route_assignments');
    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      route_id,
      sortField = 'id',
      sortOrder = 'ASC'
    } = req.query;

    const pageNumber = Math.max(Number.parseInt(page, 10) || 1, 1);
    const pageLimit = Math.max(Number.parseInt(limit, 10) || 10, 1);
    const offset = (pageNumber - 1) * pageLimit;
    let whereClause = `WHERE ${hasDeletedAt ? 'v.deleted_at IS NULL' : '1=1'}`;
    const queryParams = [];

    if (search) {
      queryParams.push(`%${search}%`);
      whereClause += ` AND (v.vehicle_number ILIKE $${queryParams.length} OR v.brand ILIKE $${queryParams.length} OR v.model ILIKE $${queryParams.length} OR v.vehicle_type ILIKE $${queryParams.length})`;
    }

    if (status !== undefined && status !== '' && status !== 'all') {
      const isActive = status === 'active' || status === 'true' || status === true;
      queryParams.push(isActive);
      whereClause += ` AND v.is_active = $${queryParams.length}`;
    }

    if (route_id && route_id !== 'all') {
      const routeId = Number.parseInt(route_id, 10);
      if (!Number.isInteger(routeId) || routeId <= 0) {
        return errorResponse(res, 400, 'Invalid route ID');
      }
      queryParams.push(routeId);
      const routeFilterIndex = queryParams.length;
      const routeFilters = [];
      if (hasTransportAssignments) {
        routeFilters.push(`EXISTS (
          SELECT 1 FROM transport_assignments ta_filter
          WHERE ta_filter.vehicle_id = v.id
            AND ta_filter.deleted_at IS NULL
            AND ta_filter.route_id = $${routeFilterIndex}
        )`);
      }
      if (hasVehicleRouteAssignments) {
        routeFilters.push(`EXISTS (
          SELECT 1 FROM vehicle_route_assignments va_filter
          WHERE va_filter.vehicle_id = v.id
            AND va_filter.deleted_at IS NULL
            AND va_filter.route_id = $${routeFilterIndex}
        )`);
      }
      if (routeFilters.length > 0) {
        whereClause += ` AND (${routeFilters.join(' OR ')})`;
      }
    }

    // Sorting
    const sortMap = {
      id: 'v.id',
      vehicle_number: 'v.vehicle_number',
      vehicle_type: 'v.vehicle_type',
      brand: 'v.brand',
      model: 'v.model',
      vehicle_model: 'v.model',
      made_of_year: 'v.made_of_year',
      is_active: 'v.is_active',
      created_at: 'v.created_at',
      route_name: 'r.route_name',
      point_name: 'point_name',
    };
    const allowedSortFields = Object.keys(sortMap);
    const finalSortField = allowedSortFields.includes(sortField) ? sortMap[sortField] : 'v.id';
    const finalSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const assignmentsJoin = hasTransportAssignments
      ? `LEFT JOIN LATERAL (
           SELECT ta0.route_id, ta0.driver_id
           FROM transport_assignments ta0
           WHERE ta0.vehicle_id = v.id
             AND ta0.deleted_at IS NULL
             AND ta0.is_active = true
           ORDER BY ta0.updated_at DESC NULLS LAST, ta0.id DESC
           LIMIT 1
         ) ta ON true`
      : `LEFT JOIN LATERAL (SELECT NULL::integer AS route_id, NULL::integer AS driver_id) ta ON true`;

    // Count query - Joined with routes and pickup_points via the new relationship
    const countResult = await query(
      `SELECT COUNT(*)
       FROM transport_vehicles v
       ${assignmentsJoin}
       LEFT JOIN routes r ON ta.route_id = r.id AND r.deleted_at IS NULL
       LEFT JOIN drivers d ON ta.driver_id = d.id AND d.deleted_at IS NULL
       ${whereClause}`,
      queryParams
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Data query
    const dataResult = await query(
      `SELECT v.*, r.route_name,
       (${hasRouteStops
          ? `SELECT string_agg(pp_sub.point_name, ', ')
             FROM route_stops rs_sub
             JOIN pickup_points pp_sub ON rs_sub.pickup_point_id = pp_sub.id
             WHERE rs_sub.route_id = r.id`
          : `SELECT string_agg(pp_sub.point_name, ', ')
             FROM pickup_points pp_sub
             WHERE pp_sub.route_id = r.id`
        }) as point_name
       FROM transport_vehicles v
       ${assignmentsJoin}
       LEFT JOIN routes r ON ta.route_id = r.id AND r.deleted_at IS NULL
       LEFT JOIN drivers d ON ta.driver_id = d.id AND d.deleted_at IS NULL
       ${whereClause} 
       ORDER BY ${finalSortField} ${finalSortOrder} 
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, pageLimit, offset]
    );

    const data = dataResult.rows.map((row) => mapVehicleRow(row));

    return success(res, 200, 'Vehicles fetched successfully', data, {
      totalCount,
      page: pageNumber,
      limit: pageLimit,
      totalPages: Math.ceil(totalCount / pageLimit)
    });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return errorResponse(res, 500, 'Failed to fetch vehicles');
  }
};

const getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;
    const hasDeletedAt = await hasColumn('transport_vehicles', 'deleted_at');
    const hasRouteStops = await hasTable('route_stops');
    const hasTransportAssignments = await hasTable('transport_assignments');
    const params = [id];

    const assignmentsJoin = hasTransportAssignments
      ? `LEFT JOIN LATERAL (
           SELECT ta0.route_id, ta0.driver_id
           FROM transport_assignments ta0
           WHERE ta0.vehicle_id = v.id
             AND ta0.deleted_at IS NULL
             AND ta0.is_active = true
           ORDER BY ta0.updated_at DESC NULLS LAST, ta0.id DESC
           LIMIT 1
         ) ta ON true`
      : `LEFT JOIN LATERAL (SELECT NULL::integer AS route_id, NULL::integer AS driver_id) ta ON true`;

    const result = await query(`
      SELECT v.*, r.route_name,
      (${hasRouteStops
        ? `SELECT string_agg(pp_sub.point_name, ', ')
           FROM route_stops rs_sub
           JOIN pickup_points pp_sub ON rs_sub.pickup_point_id = pp_sub.id
           WHERE rs_sub.route_id = r.id`
        : `SELECT string_agg(pp_sub.point_name, ', ')
           FROM pickup_points pp_sub
           WHERE pp_sub.route_id = r.id`
      }) as point_name
      FROM transport_vehicles v
      ${assignmentsJoin}
      LEFT JOIN drivers d ON ta.driver_id = d.id AND d.deleted_at IS NULL
      LEFT JOIN routes r ON ta.route_id = r.id AND r.deleted_at IS NULL
      WHERE v.id = $1 AND ${hasDeletedAt ? 'v.deleted_at IS NULL' : '1=1'}
    `, params);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Vehicle not found');
    }

    return success(res, 200, 'Vehicle fetched successfully', mapVehicleRow(result.rows[0]));
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    return errorResponse(res, 500, 'Failed to fetch vehicle');
  }
};

const createVehicle = async (req, res) => {
  try {
    const { 
      vehicle_number, 
      vehicle_type,
      brand,
      vehicle_model, 
      made_of_year, 
      registration_number, 
      chassis_number, 
      seat_capacity, 
      gps_device_id, 
      insurance_expiry,
      fitness_expiry,
      permit_expiry,
      is_active 
    } = req.body;

    if (!vehicle_number) {
      return errorResponse(res, 400, 'Vehicle number is required');
    }
    const parsedSeatCapacity = Number(seat_capacity);
    if (!Number.isFinite(parsedSeatCapacity) || parsedSeatCapacity <= 0) {
      return errorResponse(res, 400, 'Seat capacity is required and must be greater than 0');
    }
    const parsedVehicleType = normalizeVehicleType(vehicle_type);
    if (vehicle_type !== undefined && parsedVehicleType === null && String(vehicle_type).trim() !== '') {
      return errorResponse(res, 400, `Vehicle type must be one of: ${VEHICLE_TYPE_VALUES.join(', ')}`);
    }
    const parsedInsuranceExpiry = parseDateOnly(insurance_expiry);
    const parsedFitnessExpiry = parseDateOnly(fitness_expiry);
    const parsedPermitExpiry = parseDateOnly(permit_expiry);
    if (insurance_expiry !== undefined && parsedInsuranceExpiry === null && insurance_expiry !== null && String(insurance_expiry).trim() !== '') {
      return errorResponse(res, 400, 'Insurance expiry must be in YYYY-MM-DD format');
    }
    if (fitness_expiry !== undefined && parsedFitnessExpiry === null && fitness_expiry !== null && String(fitness_expiry).trim() !== '') {
      return errorResponse(res, 400, 'Fitness expiry must be in YYYY-MM-DD format');
    }
    if (permit_expiry !== undefined && parsedPermitExpiry === null && permit_expiry !== null && String(permit_expiry).trim() !== '') {
      return errorResponse(res, 400, 'Permit expiry must be in YYYY-MM-DD format');
    }

    const isActiveValue = is_active === true || is_active === 1 || is_active === 'true' || is_active === '1' || is_active === 'Active';

    // Map frontend fields to DB column names
    const model = vehicle_model;
    const seating_capacity = seat_capacity;

    const result = await query(`
      INSERT INTO transport_vehicles (
        vehicle_number, vehicle_type, brand, model, made_of_year, registration_number,
        chassis_number, seating_capacity, gps_device_id, insurance_expiry, fitness_expiry, permit_expiry, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      vehicle_number, 
      parsedVehicleType,
      brand ? String(brand).trim() : null,
      model || '',
      made_of_year ? parseInt(made_of_year) : null,
      registration_number || '',
      chassis_number || '',
      parseInt(parsedSeatCapacity),
      gps_device_id || '',
      parsedInsuranceExpiry,
      parsedFitnessExpiry,
      parsedPermitExpiry,
      isActiveValue
    ]);

    return success(res, 201, 'Vehicle created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating vehicle:', error);
    return errorResponse(res, 500, 'Failed to create vehicle');
  }
};

const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const hasDeletedAt = await hasColumn('transport_vehicles', 'deleted_at');
    const numericId = parseInt(id);

    if (isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid vehicle ID');
    }

    const {
      vehicle_number,
      vehicle_type,
      brand,
      vehicle_model: model,
      made_of_year,
      registration_number,
      chassis_number,
      seat_capacity: seating_capacity,
      gps_device_id,
      insurance_expiry,
      fitness_expiry,
      permit_expiry,
      is_active
    } = req.body;

    const updates = [];
    const values = [];
    let i = 1;

    if (vehicle_number !== undefined) {
      updates.push(`vehicle_number = $${i++}`);
      values.push(vehicle_number);
    }
    if (vehicle_type !== undefined) {
      const parsedVehicleType = normalizeVehicleType(vehicle_type);
      if (parsedVehicleType === null && vehicle_type !== null && String(vehicle_type).trim() !== '') {
        return errorResponse(res, 400, `Vehicle type must be one of: ${VEHICLE_TYPE_VALUES.join(', ')}`);
      }
      updates.push(`vehicle_type = $${i++}`);
      values.push(parsedVehicleType);
    }
    if (brand !== undefined) {
      updates.push(`brand = $${i++}`);
      values.push(brand ? String(brand).trim() : null);
    }
    if (model !== undefined) {
      updates.push(`model = $${i++}`);
      values.push(model);
    }
    if (seating_capacity !== undefined) {
      updates.push(`seating_capacity = $${i++}`);
      values.push(seating_capacity ? parseInt(seating_capacity) : null);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${i++}`);
      values.push(is_active === true || is_active === 1 || is_active === 'true' || is_active === '1' || is_active === 'Active');
    }
    if (made_of_year !== undefined) {
      updates.push(`made_of_year = $${i++}`);
      values.push(made_of_year ? parseInt(made_of_year, 10) : null);
    }
    if (registration_number !== undefined) {
      updates.push(`registration_number = $${i++}`);
      values.push(registration_number);
    }
    if (chassis_number !== undefined) {
      updates.push(`chassis_number = $${i++}`);
      values.push(chassis_number);
    }
    if (gps_device_id !== undefined) {
      updates.push(`gps_device_id = $${i++}`);
      values.push(gps_device_id);
    }
    if (insurance_expiry !== undefined) {
      const parsedInsuranceExpiry = parseDateOnly(insurance_expiry);
      if (parsedInsuranceExpiry === null && insurance_expiry !== null && String(insurance_expiry).trim() !== '') {
        return errorResponse(res, 400, 'Insurance expiry must be in YYYY-MM-DD format');
      }
      updates.push(`insurance_expiry = $${i++}`);
      values.push(parsedInsuranceExpiry);
    }
    if (fitness_expiry !== undefined) {
      const parsedFitnessExpiry = parseDateOnly(fitness_expiry);
      if (parsedFitnessExpiry === null && fitness_expiry !== null && String(fitness_expiry).trim() !== '') {
        return errorResponse(res, 400, 'Fitness expiry must be in YYYY-MM-DD format');
      }
      updates.push(`fitness_expiry = $${i++}`);
      values.push(parsedFitnessExpiry);
    }
    if (permit_expiry !== undefined) {
      const parsedPermitExpiry = parseDateOnly(permit_expiry);
      if (parsedPermitExpiry === null && permit_expiry !== null && String(permit_expiry).trim() !== '') {
        return errorResponse(res, 400, 'Permit expiry must be in YYYY-MM-DD format');
      }
      updates.push(`permit_expiry = $${i++}`);
      values.push(parsedPermitExpiry);
    }
    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(numericId);
    const result = await query(`
      UPDATE transport_vehicles
      SET ${updates.join(', ')}
      WHERE id = $${i} AND ${hasDeletedAt ? 'deleted_at IS NULL' : '1=1'}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Vehicle not found');
    }

    return success(res, 200, 'Vehicle updated successfully', mapVehicleRow(result.rows[0]));
  } catch (error) {
    console.error('Error updating transport vehicle:', error);
    return errorResponse(res, 500, error.message || 'Failed to update vehicle');
  }
};

const deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const hasDeletedAt = await hasColumn('transport_vehicles', 'deleted_at');
    const numericId = parseInt(id);
    
    if (isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid vehicle ID');
    }

    const result = hasDeletedAt
      ? await query(
          'UPDATE transport_vehicles SET deleted_at = NOW(), updated_at = NOW(), is_active = false WHERE id = $1 AND deleted_at IS NULL RETURNING id',
          [numericId]
        )
      : await query(
          'UPDATE transport_vehicles SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
          [numericId]
        );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Vehicle not found or already deleted');
    }

    return success(res, 200, 'Vehicle deleted successfully');
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    return errorResponse(res, 500, 'Failed to delete vehicle');
  }
};

module.exports = {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle
};
