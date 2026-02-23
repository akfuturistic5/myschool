const { query } = require('../config/database');

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
    const result = await query('SELECT * FROM pickup_points ORDER BY id ASC');
    const data = result.rows.map(mapPickupRow);
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Pickup points fetched successfully',
      data,
      count: data.length
    });
  } catch (error) {
    console.error('Error fetching pickup points:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch pickup points',
    });
  }
};

const getPickupPointById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM pickup_points WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Pickup point not found' });
    }
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Pickup point fetched successfully',
      data: mapPickupRow(result.rows[0])
    });
  } catch (error) {
    console.error('Error fetching pickup point:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch pickup point',
    });
  }
};

// Update pickup point
const updatePickupPoint = async (req, res) => {
  try {
    const { id } = req.params;
    const { address, is_active } = req.body;

    console.log('=== UPDATE PICKUP POINT REQUEST ===');
    console.log('Params:', { id });
    console.log('Body:', { address, is_active, is_active_type: typeof is_active });

    // Convert is_active to boolean
    let isActiveBoolean = false;
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 't' || is_active === 'T') {
      isActiveBoolean = true;
    } else if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'f' || is_active === 'F') {
      isActiveBoolean = false;
    }

    // Validate required fields
    if (!address) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Pickup point address is required'
      });
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
      return res.status(404).json({
        status: 'ERROR',
        message: 'Pickup point not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Pickup point updated successfully',
      data: mapPickupRow(result.rows[0])
    });
  } catch (error) {
    console.error('Error updating pickup point:', error);
    res.status(500).json({
      status: 'ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Failed to update pickup point' : `Failed to update pickup point: ${error.message || 'Unknown error'}`,
    });
  }
};

module.exports = { getAllPickupPoints, getPickupPointById, updatePickupPoint };
