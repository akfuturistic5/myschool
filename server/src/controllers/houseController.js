const { query } = require('../config/database');

const getAllHouses = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        id,
        house_name,
        house_color,
        house_captain,
        description,
        is_active,
        created_at
      FROM houses
      WHERE is_active = true
      ORDER BY house_name ASC
    `);
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Houses fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching houses:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch houses',
    });
  }
};

const getHouseById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT
        id,
        house_name,
        house_color,
        house_captain,
        description,
        is_active,
        created_at
      FROM houses
      WHERE id = $1 AND is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'House not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'House fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching house:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch house',
    });
  }
};

module.exports = {
  getAllHouses,
  getHouseById
};
