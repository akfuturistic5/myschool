const { query } = require('../config/database');

// Get all designations
const getAllDesignations = async (req, res) => {
  try {
    // Use exact table name: designations (plural)
    const result = await query(`
      SELECT *
      FROM designations
      ORDER BY id ASC
    `);

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Designations fetched successfully',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching designations:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch designations',
    });
  }
};

// Get designation by ID
const getDesignationById = async (req, res) => {
  try {
    const { id } = req.params;
    // Use exact table name: designations (plural)
    const result = await query(
      `
      SELECT *
      FROM designations
      WHERE id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Designation not found',
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Designation fetched successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching designation by ID:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch designation',
    });
  }
};

// Update designation (name + status)
const updateDesignation = async (req, res) => {
  try {
    const { id } = req.params;
    const { designation_name, designation, name, is_active } = req.body;

    console.log('=== UPDATE DESIGNATION REQUEST ===');
    console.log('Params:', { id });
    console.log('Body:', { designation_name, designation, name, is_active, is_active_type: typeof is_active });

    // Resolve new designation name from possible fields
    const newName = (designation_name || designation || name || '').trim();

    if (!newName) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Designation name is required',
      });
    }

    // Convert is_active to boolean
    let isActiveBoolean = true; // default keep active
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 't' || is_active === 'T') {
      isActiveBoolean = true;
    } else if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'f' || is_active === 'F') {
      isActiveBoolean = false;
    }

    const result = await query(
      `
      UPDATE designations
      SET designation_name = $1,
          is_active = $2,
          modified_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
      [newName, isActiveBoolean, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Designation not found',
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Designation updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating designation:', error);
    res.status(500).json({
      status: 'ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Failed to update designation' : `Failed to update designation: ${error.message || 'Unknown error'}`,
    });
  }
};

module.exports = {
  getAllDesignations,
  getDesignationById,
  updateDesignation,
};
