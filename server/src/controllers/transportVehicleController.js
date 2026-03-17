const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

function getDriverDisplayName(driverRow) {
  if (!driverRow) return null;
  if (driverRow.driver_name != null && String(driverRow.driver_name).trim() !== '') return String(driverRow.driver_name).trim();
  if (driverRow.name != null && String(driverRow.name).trim() !== '') return String(driverRow.name).trim();
  const first = driverRow.first_name != null ? String(driverRow.first_name).trim() : '';
  const last = driverRow.last_name != null ? String(driverRow.last_name).trim() : '';
  return [first, last].filter(Boolean).join(' ').trim() || null;
}

function getRouteDisplayName(routeRow) {
  if (!routeRow) return null;
  return routeRow.route_name ?? routeRow.name ?? null;
}

function getPickupDisplayName(pickupRow) {
  if (!pickupRow) return null;
  return (
    pickupRow.address ??
    pickupRow.pickup_point ??
    pickupRow.name ??
    pickupRow.location ??
    pickupRow.point_name ??
    pickupRow.point_address ??
    null
  );
}

// Pickup point comes from route.start_point: either direct text or FK id to pickup_points
function getPickupPointFromRoute(route, pickupMap) {
  if (!route || route.start_point == null) return null;
  const sp = route.start_point;
  const isId = typeof sp === 'number' || (typeof sp === 'string' && /^\d+$/.test(String(sp).trim()));
  if (isId) {
    const pickup = pickupMap[Number(sp)] ?? pickupMap[String(sp)];
    return pickup ? getPickupDisplayName(pickup) : null;
  }
  return String(sp).trim() || null;
}

function mapVehicleRow(row, driverMap = {}, routeMap = {}, pickupMap = {}) {
  const driver = driverMap[row.driver_id];
  const routeId = row.route_id ?? row.route;
  const route = routeMap[routeId] ?? routeMap[Number(routeId)] ?? routeMap[String(routeId)];
  return {
    id: row.id,
    vehicle_code: row.vehicle_code ?? row.code ?? row.id,
    vehicle_number: row.vehicle_number ?? row.vehicle_no ?? row.number ?? '',
    vehicle_model: row.vehicle_model ?? row.model ?? null,
    driver_id: row.driver_id ?? null,
    route_id: routeId ?? null,
    registration_number: row.ragistration_number ?? row.registration_number ?? row.registration_no ?? null,
    chassis_number: row.chassis_number ?? row.chassis_no ?? null,
    gps_device_id: row.gps_device_id ?? row.gps_id ?? null,
    year: row.made_of_year ?? row.year ?? null,
    is_active: row.is_active !== false && row.is_active !== 'f',
    photo_url: row.photo_url ?? row.photo ?? null,
    created_at: row.created_at,
    driver_name: driver ? getDriverDisplayName(driver) : null,
    driver_phone: driver ? (driver.phone ?? null) : null,
    driver_photo_url: driver ? (driver.photo_url ?? driver.photo ?? null) : null,
    route: route ? getRouteDisplayName(route) : null,
    pickup_point: getPickupPointFromRoute(route, pickupMap)
  };
}

const getAllVehicles = async (req, res) => {
  try {
    const vehiclesResult = await query('SELECT * FROM vehicles ORDER BY id ASC');
    const driverIds = [...new Set(vehiclesResult.rows.map((v) => v.driver_id).filter(Boolean))];
    const routeIds = [...new Set(vehiclesResult.rows.map((v) => v.route_id ?? v.route).filter(Boolean))];

    let driverMap = {};
    if (driverIds.length > 0) {
      const driversResult = await query('SELECT * FROM drivers WHERE id = ANY($1)', [driverIds]);
      driversResult.rows.forEach((d) => { driverMap[d.id] = d; });
    }
    let routeMap = {};
    let pickupMap = {};
    if (routeIds.length > 0) {
      const routesResult = await query('SELECT * FROM routes WHERE id = ANY($1)', [routeIds]);
      routesResult.rows.forEach((r) => {
        routeMap[r.id] = r;
        routeMap[Number(r.id)] = r;
        routeMap[String(r.id)] = r;
      });
      // Pickup point = route.start_point. If start_point is an ID, resolve from pickup_points.
      const startPointIds = routesResult.rows
        .map((r) => r.start_point)
        .filter((sp) => {
          if (sp == null) return false;
          if (typeof sp === 'number') return true;
          if (typeof sp === 'string' && /^\d+$/.test(String(sp).trim())) return true;
          return false;
        });
      const uniqueIds = [...new Set(startPointIds.map((id) => Number(id)))];
      if (uniqueIds.length > 0) {
        const pickupsResult = await query('SELECT * FROM pickup_points WHERE id = ANY($1)', [uniqueIds]);
        pickupsResult.rows.forEach((p) => {
          pickupMap[p.id] = p;
          pickupMap[Number(p.id)] = p;
          pickupMap[String(p.id)] = p;
        });
      }
    }

    const data = vehiclesResult.rows.map((row) => mapVehicleRow(row, driverMap, routeMap, pickupMap));
    return success(res, 200, 'Transport vehicles fetched successfully', data, { count: data.length });
  } catch (error) {
    console.error('Error fetching transport vehicles:', error);
    return errorResponse(res, 500, 'Failed to fetch transport vehicles');
  }
};

const getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;
    const vehiclesResult = await query('SELECT * FROM vehicles WHERE id = $1', [id]);
    if (vehiclesResult.rows.length === 0) {
      return errorResponse(res, 404, 'Vehicle not found');
    }
    const row = vehiclesResult.rows[0];
    let driverMap = {};
    let routeMap = {};
    let pickupMap = {};
    if (row.driver_id) {
      const driversResult = await query('SELECT * FROM drivers WHERE id = $1', [row.driver_id]);
      if (driversResult.rows.length > 0) driverMap[row.driver_id] = driversResult.rows[0];
    }
    const routeId = row.route_id ?? row.route;
    if (routeId) {
      const routesResult = await query('SELECT * FROM routes WHERE id = $1', [routeId]);
      if (routesResult.rows.length > 0) {
        const routeRow = routesResult.rows[0];
        routeMap[routeId] = routeRow;
        routeMap[Number(routeId)] = routeRow;
        routeMap[String(routeId)] = routeRow;
        const sp = routeRow.start_point;
        const isId = sp != null && (typeof sp === 'number' || (typeof sp === 'string' && /^\d+$/.test(String(sp).trim())));
        if (isId) {
          const pickupsResult = await query('SELECT * FROM pickup_points WHERE id = $1', [Number(sp)]);
          if (pickupsResult.rows.length > 0) {
            const p = pickupsResult.rows[0];
            pickupMap[Number(sp)] = p;
            pickupMap[String(sp)] = p;
          }
        }
      }
    }
    return success(res, 200, 'Transport vehicle fetched successfully', mapVehicleRow(row, driverMap, routeMap, pickupMap));
  } catch (error) {
    console.error('Error fetching transport vehicle:', error);
    return errorResponse(res, 500, 'Failed to fetch transport vehicle');
  }
};

// Update vehicle (currently only updates status flag)
const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    // Convert is_active to boolean
    let isActiveBoolean = false;
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 't' || is_active === 'T') {
      isActiveBoolean = true;
    } else if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'f' || is_active === 'F') {
      isActiveBoolean = false;
    }

    const result = await query(`
      UPDATE vehicles
      SET is_active = $1,
          modified_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [isActiveBoolean, id]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Vehicle not found');
    }

    return success(res, 200, 'Vehicle updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    return errorResponse(res, 500, 'Failed to update vehicle');
  }
};

module.exports = { getAllVehicles, getVehicleById, updateVehicle };
