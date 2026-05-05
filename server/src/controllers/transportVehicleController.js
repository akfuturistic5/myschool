const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getScopedDriverId } = require('../utils/driverTransportAccess');
const { hasColumn, hasTable } = require('../utils/schemaInspector');

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
    vehicle_model: row.vehicle_model ?? row.model ?? '',
    made_of_year: row.made_of_year ?? '',
    registration_number: row.registration_number ?? '',
    chassis_number: row.chassis_number ?? '',
    seat_capacity: row.seat_capacity ?? row.seating_capacity ?? '',
    gps_device_id: row.gps_device_id ?? '',
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
    const hasDeletedAt = await hasColumn('transport_vehicles', 'deleted_at');
    const hasRouteStops = await hasTable('route_stops');
    const scopedDriverId = await getScopedDriverId(req);
    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      route_id,
      sortField = 'id',
      sortOrder = 'ASC'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = `WHERE ${hasDeletedAt ? 'v.deleted_at IS NULL' : '1=1'}`;
    const queryParams = [];

    if (search) {
      queryParams.push(`%${search}%`);
      whereClause += ` AND (v.vehicle_number ILIKE $${queryParams.length} OR v.model ILIKE $${queryParams.length} OR r.route_name ILIKE $${queryParams.length})`;
    }

    if (status !== undefined && status !== '' && status !== 'all') {
      const isActive = status === 'active' || status === 'true' || status === true;
      queryParams.push(isActive);
      whereClause += ` AND v.is_active = $${queryParams.length}`;
    }

    if (route_id && route_id !== 'all') {
      queryParams.push(parseInt(route_id));
      whereClause += ` AND vra.route_id = $${queryParams.length}`;
    }

    // Sorting
    const allowedSortFields = ['id', 'vehicle_number', 'model', 'created_at', 'route_name'];
    let finalSortField = 'v.id';
    if (allowedSortFields.includes(sortField)) {
        if (sortField === 'route_name') finalSortField = 'r.route_name';
        else finalSortField = `v.${sortField}`;
    }
    const finalSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // Count query
    const countResult = await query(
      `SELECT COUNT(DISTINCT v.id) FROM transport_vehicles v 
       LEFT JOIN vehicle_route_assignments vra ON v.id = vra.vehicle_id AND vra.deleted_at IS NULL
       LEFT JOIN routes r ON vra.route_id = r.id
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
       LEFT JOIN vehicle_route_assignments vra ON v.id = vra.vehicle_id AND vra.deleted_at IS NULL
       LEFT JOIN routes r ON vra.route_id = r.id
       ${whereClause} 
       ORDER BY ${finalSortField} ${finalSortOrder} 
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    const data = dataResult.rows.map((row) => mapVehicleRow(row));

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
    const hasDeletedAt = await hasColumn('transport_vehicles', 'deleted_at');
    const hasRouteStops = await hasTable('route_stops');
    
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
      LEFT JOIN vehicle_route_assignments vra ON v.id = vra.vehicle_id AND vra.deleted_at IS NULL
      LEFT JOIN routes r ON vra.route_id = r.id
      WHERE v.id = $1 AND ${hasDeletedAt ? 'v.deleted_at IS NULL' : '1=1'}
    `, [id]);

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
      model, 
      seating_capacity, 
      insurance_expiry,
      fitness_expiry,
      permit_expiry
    } = req.body;

    if (!vehicle_number) {
      return errorResponse(res, 400, 'Vehicle number is required');
    }

    const result = await query(`
      INSERT INTO transport_vehicles (
        vehicle_number, vehicle_type, brand, model, seating_capacity, 
        insurance_expiry, fitness_expiry, permit_expiry,
        is_active, made_of_year, registration_number, chassis_number, gps_device_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      vehicle_number, 
      vehicle_type || 'Bus', 
      brand || '',
      model || '', 
      seating_capacity ? parseInt(seating_capacity) : null,
      insurance_expiry || null,
      fitness_expiry || null,
      permit_expiry || null,
      req.body.is_active !== false,
      req.body.made_of_year ? parseInt(req.body.made_of_year) : null,
      req.body.registration_number || null,
      req.body.chassis_number || null,
      req.body.gps_device_id || null
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
      model,
      seating_capacity,
      insurance_expiry,
      fitness_expiry,
      permit_expiry
    } = req.body;

    const updates = [];
    const values = [];
    let i = 1;

    if (vehicle_number !== undefined) {
      updates.push(`vehicle_number = $${i++}`);
      values.push(vehicle_number);
    }
    if (vehicle_type !== undefined) {
      updates.push(`vehicle_type = $${i++}`);
      values.push(vehicle_type);
    }
    if (brand !== undefined) {
      updates.push(`brand = $${i++}`);
      values.push(brand);
    }
    if (model !== undefined) {
      updates.push(`model = $${i++}`);
      values.push(model);
    }
    if (seating_capacity !== undefined) {
      updates.push(`seating_capacity = $${i++}`);
      values.push(seating_capacity ? parseInt(seating_capacity) : null);
    }
    if (req.body.is_active !== undefined) {
      updates.push(`is_active = $${i++}`);
      values.push(req.body.is_active !== false);
    }
    if (req.body.made_of_year !== undefined) {
      updates.push(`made_of_year = $${i++}`);
      values.push(req.body.made_of_year ? parseInt(req.body.made_of_year) : null);
    }
    if (req.body.registration_number !== undefined) {
      updates.push(`registration_number = $${i++}`);
      values.push(req.body.registration_number);
    }
    if (req.body.chassis_number !== undefined) {
      updates.push(`chassis_number = $${i++}`);
      values.push(req.body.chassis_number);
    }
    if (req.body.gps_device_id !== undefined) {
      updates.push(`gps_device_id = $${i++}`);
      values.push(req.body.gps_device_id);
    }
    if (insurance_expiry !== undefined) {
      updates.push(`insurance_expiry = $${i++}`);
      values.push(insurance_expiry);
    }
    if (fitness_expiry !== undefined) {
      updates.push(`fitness_expiry = $${i++}`);
      values.push(fitness_expiry);
    }
    if (permit_expiry !== undefined) {
      updates.push(`permit_expiry = $${i++}`);
      values.push(permit_expiry);
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

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
          'UPDATE transport_vehicles SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
          [numericId]
        )
      : await query(
          'DELETE FROM transport_vehicles WHERE id = $1 RETURNING id',
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
