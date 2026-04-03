const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

function mapRouteRow(row) {
  return {
    id: row.id,
    route_code: row.route_code ?? row.code ?? row.id,
    route_name: row.route_name ?? row.name ?? '',
    is_active: row.is_active !== false && row.is_active !== 'f',
    created_at: row.created_at
  };
}

const getAllRoutes = async (req, res) => {
  try {
    const result = await query('SELECT * FROM routes ORDER BY id ASC');
    const data = result.rows.map(mapRouteRow);
    return success(res, 200, 'Transport routes fetched successfully', data, { count: data.length });
  } catch (error) {
    console.error('Error fetching transport routes:', error);
    return errorResponse(res, 500, 'Failed to fetch transport routes');
  }
};

const getRouteById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM routes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Route not found');
    }
    return success(res, 200, 'Transport route fetched successfully', mapRouteRow(result.rows[0]));
  } catch (error) {
    console.error('Error fetching transport route:', error);
    return errorResponse(res, 500, 'Failed to fetch transport route');
  }
};

// Update route
const updateRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const { route_name, is_active } = req.body;

    // Convert is_active to boolean
    let isActiveBoolean = false;
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 't' || is_active === 'T') {
      isActiveBoolean = true;
    } else if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'f' || is_active === 'F') {
      isActiveBoolean = false;
    }

    // Validate required fields
    if (!route_name) {
      return errorResponse(res, 400, 'Route name is required');
    }

    const result = await query(`
      UPDATE routes
      SET route_name = $1,
          is_active = $2,
          modified_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [route_name, isActiveBoolean, id]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Route not found');
    }

    return success(res, 200, 'Route updated successfully', mapRouteRow(result.rows[0]));
  } catch (error) {
    console.error('Error updating route:', error);
    return errorResponse(res, 500, 'Failed to update route');
  }
};

module.exports = { getAllRoutes, getRouteById, updateRoute };
