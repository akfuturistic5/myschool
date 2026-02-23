const { query } = require('../config/database');

function getDriverDisplayName(row) {
  if (row.driver_name != null && String(row.driver_name).trim() !== '') return String(row.driver_name).trim();
  if (row.name != null && String(row.name).trim() !== '') return String(row.name).trim();
  const first = row.first_name != null ? String(row.first_name).trim() : '';
  const last = row.last_name != null ? String(row.last_name).trim() : '';
  return [first, last].filter(Boolean).join(' ').trim() || null;
}

function mapDriverRow(row) {
  return {
    id: row.id,
    driver_code: row.driver_code ?? row.employee_code ?? row.code ?? row.id,
    name: getDriverDisplayName(row) ?? '',
    phone: row.phone ?? null,
    license_number: row.license_number ?? row.license_no ?? null,
    address: row.address ?? null,
    is_active: row.is_active !== false && row.is_active !== 'f',
    photo_url: row.photo_url ?? row.photo ?? null,
    created_at: row.created_at
  };
}

const getAllDrivers = async (req, res) => {
  try {
    const result = await query('SELECT * FROM drivers ORDER BY id ASC');
    const data = result.rows.map(mapDriverRow);
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Transport drivers fetched successfully',
      data,
      count: data.length
    });
  } catch (error) {
    console.error('Error fetching transport drivers:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch transport drivers',
    });
  }
};

const getDriverById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM drivers WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Driver not found' });
    }
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Transport driver fetched successfully',
      data: mapDriverRow(result.rows[0])
    });
  } catch (error) {
    console.error('Error fetching transport driver:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch transport driver',
    });
  }
};

// Update driver
const updateDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, license_number, address, is_active } = req.body;

    console.log('=== UPDATE DRIVER REQUEST ===');
    console.log('Params:', { id });
    console.log('Body:', { name, phone, license_number, address, is_active, is_active_type: typeof is_active });

    // Convert is_active to boolean
    let isActiveBoolean = false;
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 't' || is_active === 'T') {
      isActiveBoolean = true;
    } else if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'f' || is_active === 'F') {
      isActiveBoolean = false;
    }

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Driver name is required'
      });
    }

    const result = await query(`
      UPDATE drivers
      SET driver_name = $1,
          phone = $2,
          license_number = $3,
          address = $4,
          is_active = $5,
          modified_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [name, phone || null, license_number || null, address || null, isActiveBoolean, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Driver not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Driver updated successfully',
      data: mapDriverRow(result.rows[0])
    });
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({
      status: 'ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Failed to update driver' : `Failed to update driver: ${error.message || 'Unknown error'}`,
    });
  }
};

module.exports = { getAllDrivers, getDriverById, updateDriver };
