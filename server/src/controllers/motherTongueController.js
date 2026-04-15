const { query } = require('../config/database');

// Get all mother tongues
const getAllMotherTongues = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        mt.id,
        mt.language_name,
        mt.language_code,
        mt.description,
        mt.is_active,
        mt.created_at
      FROM mother_tongues mt
      WHERE mt.is_active = true
      ORDER BY mt.language_name ASC
    `);
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Mother tongues fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching mother tongues:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch mother tongues',
    });
  }
};

// Get mother tongue by ID
const getMotherTongueById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT
        mt.id,
        mt.language_name,
        mt.language_code,
        mt.description,
        mt.is_active,
        mt.created_at
      FROM mother_tongues mt
      WHERE mt.id = $1 AND mt.is_active = true
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Mother tongue not found'
      });
    }
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Mother tongue fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching mother tongue:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch mother tongue',
    });
  }
};

module.exports = {
  getAllMotherTongues,
  getMotherTongueById
};
