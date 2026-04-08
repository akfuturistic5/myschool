const { query } = require('../config/database');

function isDriverRoleRequest(req) {
  const n = String(req.user?.role_name || req.user?.role || '').trim().toLowerCase();
  return n === 'driver';
}

/**
 * For users with role "driver": drivers.id linked via staff.user_id.
 * Returns null if not a driver request or no linked driver row.
 */
async function getScopedDriverId(req) {
  if (!isDriverRoleRequest(req) || req.user?.id == null) return null;
  const r = await query(
    `SELECT d.id
     FROM drivers d
     INNER JOIN staff s ON s.id = d.staff_id
     WHERE s.user_id = $1
       AND (d.is_active IS NOT FALSE OR d.is_active IS NULL)
       AND (s.is_active IS NOT FALSE OR s.is_active IS NULL)
     LIMIT 1`,
    [req.user.id]
  );
  return r.rows[0]?.id ?? null;
}

/**
 * Route IDs assigned to this driver's vehicles (may be empty).
 */
async function getScopedRouteIdsForDriver(driverId) {
  if (driverId == null) return [];
  const r = await query(
    `SELECT DISTINCT route_id FROM vehicles WHERE driver_id = $1 AND route_id IS NOT NULL`,
    [driverId]
  );
  return r.rows.map((row) => row.route_id).filter((id) => id != null);
}

module.exports = {
  isDriverRoleRequest,
  getScopedDriverId,
  getScopedRouteIdsForDriver,
};
