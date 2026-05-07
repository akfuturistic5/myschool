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
    `SELECT s.id
     FROM staff s
     INNER JOIN users u ON u.id = s.user_id
     INNER JOIN user_roles ur ON ur.id = u.role_id
     WHERE u.id = $1
       AND LOWER(TRIM(ur.role_name)) = 'driver'
       AND s.deleted_at IS NULL
       AND s.status = 'Active'
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
