const { query } = require('../config/database');

// Get all casts
const getAllCasts = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        c.id,
        c.cast_name,
        c.religion_id,
        c.description,
        c.is_active,
        c.created_at
      FROM casts c
      WHERE c.is_active = true
      ORDER BY c.cast_name ASC
    `);
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Casts fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching casts:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch casts',
    });
  }
};

// Get cast by ID
const getCastById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT
        c.id,
        c.cast_name,
        c.religion_id,
        c.description,
        c.is_active,
        c.created_at
      FROM casts c
      WHERE c.id = $1 AND c.is_active = true
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Cast not found'
      });
    }
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Cast fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching cast:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch cast',
    });
  }
};

module.exports = {
  getAllCasts,
  getCastById
};
