const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getScopedDriverId } = require('../utils/driverTransportAccess');
const { resolveAcademicYearId, toPositiveInt } = require('../utils/academicYear');

function getDriverDisplayName(driverRow) {
  if (!driverRow) return null;
  return driverRow.driver_name ?? driverRow.name ?? null;
}

function mapVehicleRow(row, driverMap = {}) {
  const driver = driverMap[row.driver_id];
  return {
    id: row.id,
    vehicle_code: row.vehicle_code ?? `VEH-${String(row.id).padStart(4, '0')}`,
    vehicle_number: row.vehicle_number ?? '',
    vehicle_model: row.vehicle_model ?? '',
    made_of_year: row.made_of_year ?? '',
    registration_number: row.registration_number ?? '',
    chassis_number: row.chassis_number ?? '',
    seat_capacity: row.seat_capacity ?? '',
    gps_device_id: row.gps_device_id ?? '',
    academic_year_id: row.academic_year_id ?? null,
    driver_id: row.driver_id ?? null,
    route_id: row.route_id ?? null,
    is_active: row.is_active !== false && row.is_active !== 'f',
    photo_url: row.photo_url || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    // Joined details for listing/view
    driver_name: driver ? getDriverDisplayName(driver) : (row.driver_name || 'N/A'),
    driver_phone: driver ? (driver.phone ?? 'N/A') : (row.driver_phone || 'N/A'),
    route_name: row.route_name || 'N/A',
    point_name: row.point_name || 'N/A'
  };
}

const getAllVehicles = async (req, res) => {
  try {
    const scopedDriverId = await getScopedDriverId(req);
    const {
      page = 1,
      limit = 10,
      search = '',
      academic_year_id,
      status,
      route_id,
      sortField = 'id',
      sortOrder = 'ASC'
    } = req.query;

    const offset = (page - 1) * limit;
    const scopedAcademicYearId = await resolveAcademicYearId(academic_year_id);
    let whereClause = 'WHERE v.deleted_at IS NULL';
    const queryParams = [];

    if (search) {
      queryParams.push(`%${search}%`);
      whereClause += ` AND (v.vehicle_number ILIKE $${queryParams.length} OR v.vehicle_model ILIKE $${queryParams.length} OR d.driver_name ILIKE $${queryParams.length} OR r.route_name ILIKE $${queryParams.length})`;
    }

    if (scopedDriverId != null) {
      queryParams.push(scopedDriverId);
      whereClause += ` AND v.driver_id = $${queryParams.length}`;
    }

    if (status !== undefined && status !== '' && status !== 'all') {
      const isActive = status === 'active' || status === 'true' || status === true;
      queryParams.push(isActive);
      whereClause += ` AND v.is_active = $${queryParams.length}`;
    }

    if (route_id && route_id !== 'all') {
      queryParams.push(parseInt(route_id));
      whereClause += ` AND v.route_id = $${queryParams.length}`;
    }
    if (scopedAcademicYearId) {
      queryParams.push(scopedAcademicYearId);
      whereClause += ` AND v.academic_year_id = $${queryParams.length}`;
    }

    // Sorting
    const allowedSortFields = ['id', 'vehicle_number', 'vehicle_model', 'made_of_year', 'is_active', 'created_at', 'driver_name', 'route_name', 'point_name'];
    let finalSortField = 'v.id';
    if (allowedSortFields.includes(sortField)) {
        if (sortField === 'driver_name') finalSortField = 'd.driver_name';
        else if (sortField === 'route_name') finalSortField = 'r.route_name';
        else if (sortField === 'point_name') finalSortField = 'point_name'; // Uses the alias from subquery
        else finalSortField = `v.${sortField}`;
    }
    const finalSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Count query - Joined with routes and pickup_points via the new relationship
    const countResult = await query(
      `SELECT COUNT(*) FROM vehicles v 
       LEFT JOIN drivers d ON v.driver_id = d.id 
       LEFT JOIN routes r ON v.route_id = r.id
       ${whereClause}`,
      queryParams
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Data query
    const dataResult = await query(
      `SELECT v.*, d.driver_name, d.phone as driver_phone, r.route_name,
       (SELECT string_agg(pp_sub.point_name, ', ') 
        FROM route_stops rs_sub 
        JOIN pickup_points pp_sub ON rs_sub.pickup_point_id = pp_sub.id 
        WHERE rs_sub.route_id = r.id) as point_name
       FROM vehicles v
       LEFT JOIN drivers d ON v.driver_id = d.id
       LEFT JOIN routes r ON v.route_id = r.id
       ${whereClause} 
       ORDER BY ${finalSortField} ${finalSortOrder} 
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    // Prepare driver map for mapping
    const driverMap = {};
    dataResult.rows.forEach(row => {
      if (row.driver_id) {
        driverMap[row.driver_id] = { driver_name: row.driver_name, phone: row.driver_phone };
      }
    });

    const data = dataResult.rows.map((row) => mapVehicleRow(row, driverMap));

    return success(res, 200, 'Vehicles fetched successfully', data, {
      totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return errorResponse(res, 500, 'Failed to fetch vehicles');
  }
};

const getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;
    const scopedDriverId = await getScopedDriverId(req);
    const params = [id];
    let scopedSql = '';
    if (scopedDriverId != null) {
      params.push(scopedDriverId);
      scopedSql = ` AND v.driver_id = $2`;
    }

    const result = await query(`
      SELECT v.*, d.driver_name, d.phone as driver_phone, r.route_name,
      (SELECT string_agg(pp_sub.point_name, ', ') 
       FROM route_stops rs_sub 
       JOIN pickup_points pp_sub ON rs_sub.pickup_point_id = pp_sub.id 
       WHERE rs_sub.route_id = r.id) as point_name
      FROM vehicles v
      LEFT JOIN drivers d ON v.driver_id = d.id
      LEFT JOIN routes r ON v.route_id = r.id
      WHERE v.id = $1 AND v.deleted_at IS NULL${scopedSql}
    `, params);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Vehicle not found');
    }

    const row = result.rows[0];
    const driverMap = row.driver_id
      ? { [row.driver_id]: { driver_name: row.driver_name, phone: row.driver_phone } }
      : {};
    
    return success(res, 200, 'Vehicle fetched successfully', mapVehicleRow(row, driverMap));
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    return errorResponse(res, 500, 'Failed to fetch vehicle');
  }
};

const createVehicle = async (req, res) => {
  try {
    const { 
      vehicle_number, 
      vehicle_model, 
      made_of_year, 
      registration_number, 
      chassis_number, 
      seat_capacity, 
      gps_device_id, 
      driver_id, 
      route_id,
      academic_year_id,
      is_active 
    } = req.body;

    if (!vehicle_number) {
      return errorResponse(res, 400, 'Vehicle number is required');
    }

    const isActiveValue = is_active === true || is_active === 1 || is_active === 'true' || is_active === '1' || is_active === 'Active';
    const scopedAcademicYearId = await resolveAcademicYearId(academic_year_id || req.query?.academic_year_id);

    // Map frontend fields to DB column names
    const model = vehicle_model;
    const seating_capacity = seat_capacity;

    const result = await query(`
      INSERT INTO vehicles (
        vehicle_number, model, made_of_year, registration_number, 
        chassis_number, seating_capacity, gps_device_id, driver_id, route_id, is_active, academic_year_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      vehicle_number, 
      model || '', 
      made_of_year ? parseInt(made_of_year) : null, 
      registration_number || '', 
      chassis_number || '', 
      seating_capacity ? parseInt(seating_capacity) : null, 
      gps_device_id || '', 
      driver_id ? parseInt(driver_id) : null, 
      route_id ? parseInt(route_id) : null,
      isActiveValue,
      scopedAcademicYearId
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
    const numericId = parseInt(id);

    if (isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid vehicle ID');
    }

    const {
      vehicle_number,
      vehicle_model: model,
      made_of_year,
      registration_number,
      chassis_number,
      seat_capacity: seating_capacity,
      gps_device_id,
      driver_id,
      route_id,
      academic_year_id,
      is_active
    } = req.body;

    const updates = [];
    const values = [];
    let i = 1;

    if (vehicle_number !== undefined) {
      updates.push(`vehicle_number = $${i++}`);
      values.push(vehicle_number);
    }
    if (model !== undefined) {
      updates.push(`model = $${i++}`);
      values.push(model || '');
    }
    if (made_of_year !== undefined) {
      updates.push(`made_of_year = $${i++}`);
      values.push(made_of_year ? parseInt(made_of_year) : null);
    }
    if (registration_number !== undefined) {
      updates.push(`registration_number = $${i++}`);
      values.push(registration_number || '');
    }
    if (chassis_number !== undefined) {
      updates.push(`chassis_number = $${i++}`);
      values.push(chassis_number || '');
    }
    if (seating_capacity !== undefined) {
      updates.push(`seating_capacity = $${i++}`);
      values.push(seating_capacity ? parseInt(seating_capacity) : null);
    }
    if (gps_device_id !== undefined) {
      updates.push(`gps_device_id = $${i++}`);
      values.push(gps_device_id || '');
    }
    if (driver_id !== undefined) {
      updates.push(`driver_id = $${i++}`);
      values.push(driver_id ? parseInt(driver_id) : null);
    }
    if (route_id !== undefined) {
      updates.push(`route_id = $${i++}`);
      values.push(route_id ? parseInt(route_id) : null);
    }
    if (academic_year_id !== undefined) {
      updates.push(`academic_year_id = $${i++}`);
      values.push(toPositiveInt(academic_year_id));
    }
    if (is_active !== undefined) {
      const isActiveValue = is_active === true || is_active === 1 || is_active === 'true' || is_active === '1' || is_active === 'Active';
      updates.push(`is_active = $${i++}`);
      values.push(isActiveValue);
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    values.push(numericId);
    const result = await query(`
      UPDATE vehicles
      SET ${updates.join(', ')}
      WHERE id = $${i} AND deleted_at IS NULL
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
    const numericId = parseInt(id);
    
    if (isNaN(numericId)) {
      return errorResponse(res, 400, 'Invalid vehicle ID');
    }

    const result = await query(
      'UPDATE vehicles SET deleted_at = NOW(), is_active = false WHERE id = $1 AND deleted_at IS NULL RETURNING id',
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
