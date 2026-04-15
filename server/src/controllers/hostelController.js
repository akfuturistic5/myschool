const { query } = require('../config/database');

// Get all hostels
const getAllHostels = async (req, res) => {
  try {
    // Use exact table name: hostels (plural) - SELECT * to get all available columns
    const result = await query(`
      SELECT *
      FROM hostels
      WHERE is_active = true
      ORDER BY hostel_name ASC
    `);
    
    // Log the actual data structure for debugging
    console.log('=== HOSTELS BACKEND DEBUG ===');
    console.log('Total hostels:', result.rows.length);
    if (result.rows.length > 0) {
      console.log('First hostel data:', result.rows[0]);
      console.log('First hostel columns:', Object.keys(result.rows[0]));
      console.log('Intake value:', result.rows[0].intake, 'Type:', typeof result.rows[0].intake);
      console.log('Description value:', result.rows[0].description, 'Type:', typeof result.rows[0].description);
    }
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Hostels fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching hostels:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch hostels',
    });
  }
};

// Get hostel by ID
const getHostelById = async (req, res) => {
  try {
    const { id } = req.params;
    // Use exact table name: hostels (plural) - SELECT * to get all available columns
    const result = await query(`
      SELECT *
      FROM hostels
      WHERE id = $1 AND is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Hostel not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Hostel fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching hostel:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch hostel',
    });
  }
};

module.exports = {
  getAllHostels,
  getHostelById
};
