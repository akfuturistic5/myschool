const { query } = require('../config/database');

// Get all room types
const getAllRoomTypes = async (req, res) => {
  try {
    // Use exact table name: room_types (plural) - SELECT * to get all available columns
    const result = await query(`
      SELECT *
      FROM room_types
      WHERE is_active = true
      ORDER BY id ASC
    `);
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Room types fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching room types:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch room types',
    });
  }
};

// Get room type by ID
const getRoomTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    // Use exact table name: room_types (plural) - SELECT * to get all available columns
    const result = await query(`
      SELECT *
      FROM room_types
      WHERE id = $1 AND is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Room type not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Room type fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching room type:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch room type',
    });
  }
};

module.exports = {
  getAllRoomTypes,
  getRoomTypeById
};
