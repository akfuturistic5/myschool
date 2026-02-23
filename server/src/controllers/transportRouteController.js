const { query } = require('../config/database');

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
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Transport routes fetched successfully',
      data,
      count: data.length
    });
  } catch (error) {
    console.error('Error fetching transport routes:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch transport routes',
    });
  }
};

const getRouteById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM routes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Route not found' });
    }
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Transport route fetched successfully',
      data: mapRouteRow(result.rows[0])
    });
  } catch (error) {
    console.error('Error fetching transport route:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch transport route',
    });
  }
};

// Update route
const updateRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const { route_name, is_active } = req.body;

    console.log('=== UPDATE ROUTE REQUEST ===');
    console.log('Params:', { id });
    console.log('Body:', { route_name, is_active, is_active_type: typeof is_active });

    // Convert is_active to boolean
    let isActiveBoolean = false;
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 't' || is_active === 'T') {
      isActiveBoolean = true;
    } else if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'f' || is_active === 'F') {
      isActiveBoolean = false;
    }

    // Validate required fields
    if (!route_name) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Route name is required'
      });
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
      return res.status(404).json({
        status: 'ERROR',
        message: 'Route not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Route updated successfully',
      data: mapRouteRow(result.rows[0])
    });
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({
      status: 'ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Failed to update route' : `Failed to update route: ${error.message || 'Unknown error'}`,
    });
  }
};

module.exports = { getAllRoutes, getRouteById, updateRoute };
