const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getScopedDriverId, getScopedRouteIdsForDriver } = require('../utils/driverTransportAccess');

function mapPickupRow(row) {
  return {
    id: row.id,
    pickup_code: row.pickup_code ?? row.code ?? row.id,
    address: row.address ?? row.name ?? row.location ?? '',
    is_active: row.is_active !== false && row.is_active !== 'f',
    created_at: row.created_at
  };
}

const getAllPickupPoints = async (req, res) => {
  try {
    const scopedDriverId = await getScopedDriverId(req);
    let result;
    if (scopedDriverId != null) {
      const routeIds = await getScopedRouteIdsForDriver(scopedDriverId);
      if (routeIds.length === 0) {
        return success(res, 200, 'Pickup points fetched successfully', [], { count: 0 });
      }
      result = await query(
        'SELECT * FROM pickup_points WHERE route_id = ANY($1::int[]) ORDER BY id ASC',
        [routeIds]
      );
    } else {
      result = await query('SELECT * FROM pickup_points ORDER BY id ASC');
    }
    const data = result.rows.map(mapPickupRow);
    return success(res, 200, 'Pickup points fetched successfully', data, { count: data.length });
  } catch (error) {
    console.error('Error fetching pickup points:', error);
    return errorResponse(res, 500, 'Failed to fetch pickup points');
  }
};

const getPickupPointById = async (req, res) => {
  try {
    const { id } = req.params;
    const scopedDriverId = await getScopedDriverId(req);
    const result = await query('SELECT * FROM pickup_points WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Pickup point not found');
    }
    if (scopedDriverId != null) {
      const routeIds = await getScopedRouteIdsForDriver(scopedDriverId);
      const rid = result.rows[0].route_id;
      if (rid == null || !routeIds.map(Number).includes(Number(rid))) {
        return errorResponse(res, 403, 'Access denied');
      }
    }
    return success(res, 200, 'Pickup point fetched successfully', mapPickupRow(result.rows[0]));
  } catch (error) {
    console.error('Error fetching pickup point:', error);
    return errorResponse(res, 500, 'Failed to fetch pickup point');
  }
};

// Update pickup point
const updatePickupPoint = async (req, res) => {
  try {
    const { id } = req.params;
    const { address, is_active } = req.body;

    // Convert is_active to boolean
    let isActiveBoolean = false;
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 't' || is_active === 'T') {
      isActiveBoolean = true;
    } else if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'f' || is_active === 'F') {
      isActiveBoolean = false;
    }

    // Validate required fields
    if (!address) {
      return errorResponse(res, 400, 'Pickup point address is required');
    }

    const result = await query(`
      UPDATE pickup_points
      SET address = $1,
          is_active = $2,
          modified_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [address, isActiveBoolean, id]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Pickup point not found');
    }

    return success(res, 200, 'Pickup point updated successfully', mapPickupRow(result.rows[0]));
  } catch (error) {
    console.error('Error updating pickup point:', error);
    return errorResponse(res, 500, 'Failed to update pickup point');
  }
};

module.exports = { getAllPickupPoints, getPickupPointById, updatePickupPoint };
