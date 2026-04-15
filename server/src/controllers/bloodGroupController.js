const { query } = require('../config/database');

// Get all blood groups
const getAllBloodGroups = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        bg.id,
        bg.blood_group,
        bg.description,
        bg.is_active,
        bg.created_at
      FROM blood_groups bg
      WHERE bg.is_active = true
      ORDER BY bg.blood_group ASC
    `);
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Blood groups fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching blood groups:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch blood groups',
    });
  }
};

// Get blood group by ID
const getBloodGroupById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT
        bg.id,
        bg.blood_group,
        bg.description,
        bg.is_active,
        bg.created_at
      FROM blood_groups bg
      WHERE bg.id = $1 AND bg.is_active = true
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Blood group not found'
      });
    }
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Blood group fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching blood group:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch blood group',
    });
  }
};

module.exports = {
  getAllBloodGroups,
  getBloodGroupById
};
