const { query } = require('../config/database');

// Get all hostel rooms
const getAllHostelRooms = async (req, res) => {
  try {
    // Join with hostels and room_types tables to get complete data
    // Use COALESCE to handle multiple possible column names for room type
    const result = await query(`
      SELECT 
        hr.id,
        hr.room_number,
        hr.hostel_id,
        hr.room_type_id,
        hr.current_occupancy,
        hr.monthly_fee,
        hr.is_active,
        hr.created_at,
        hr.modified_at,
        h.hostel_name,
        rt.room_type,
        rt.description as room_type_description
      FROM hostel_rooms hr
      LEFT JOIN hostels h ON hr.hostel_id = h.id
      LEFT JOIN room_types rt ON hr.room_type_id = rt.id
      WHERE hr.is_active = true
      ORDER BY hr.id ASC
    `);
    
    // Log for debugging
    console.log('=== HOSTEL ROOMS BACKEND DEBUG ===');
    console.log('Total rooms:', result.rows.length);
    if (result.rows.length > 0) {
      console.log('First room data:', result.rows[0]);
      console.log('First room columns:', Object.keys(result.rows[0]));
    }
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Hostel rooms fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('=== ERROR FETCHING HOSTEL ROOMS ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error hint:', error.hint);
    console.error('Error detail:', error.detail);
    res.status(500).json({
      status: 'ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Failed to fetch hostel rooms' : `Failed to fetch hostel rooms: ${error.message || 'Unknown error'}`,
      error: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        hint: error.hint,
        detail: error.detail
      } : undefined
    });
  }
};

// Get hostel room by ID
const getHostelRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    // Join with hostels and room_types tables to get complete data
    // Use COALESCE to handle multiple possible column names for room type
    const result = await query(`
      SELECT 
        hr.id,
        hr.room_number,
        hr.hostel_id,
        hr.room_type_id,
        hr.current_occupancy,
        hr.monthly_fee,
        hr.is_active,
        hr.created_at,
        hr.modified_at,
        h.hostel_name,
        rt.room_type,
        rt.description as room_type_description
      FROM hostel_rooms hr
      LEFT JOIN hostels h ON hr.hostel_id = h.id
      LEFT JOIN room_types rt ON hr.room_type_id = rt.id
      WHERE hr.id = $1 AND hr.is_active = true
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Hostel room not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Hostel room fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('=== ERROR FETCHING HOSTEL ROOM BY ID ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error hint:', error.hint);
    res.status(500).json({
      status: 'ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Failed to fetch hostel room' : `Failed to fetch hostel room: ${error.message || 'Unknown error'}`,
      error: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        hint: error.hint,
        detail: error.detail
      } : undefined
    });
  }
};

// Update hostel room (beds + cost)
const updateHostelRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      current_occupancy,
      no_of_bed,
      monthly_fee,
      monthly_fees,
      cost_per_bed,
    } = req.body;

    console.log('=== UPDATE HOSTEL ROOM REQUEST ===');
    console.log('Params:', { id });
    console.log('Body:', {
      current_occupancy,
      no_of_bed,
      monthly_fee,
      monthly_fees,
      cost_per_bed,
    });

    // Resolve bed count: prefer explicit current_occupancy, then no_of_bed
    let bedsRaw =
      current_occupancy ??
      no_of_bed;

    let beds = null;
    if (bedsRaw !== undefined && bedsRaw !== null && bedsRaw !== '') {
      const numBeds = Number(bedsRaw);
      beds = !Number.isNaN(numBeds) ? numBeds : null;
    }

    // Resolve monthly fee from possible fields
    let feeRaw =
      cost_per_bed ??
      monthly_fee ??
      monthly_fees;

    let fee = null;
    if (feeRaw !== undefined && feeRaw !== null && feeRaw !== '') {
      const numeric = typeof feeRaw === 'number'
        ? feeRaw
        : Number(String(feeRaw).replace(/[^\d.]/g, ''));
      fee = !Number.isNaN(numeric) ? numeric : null;
    }

    if (beds === null && fee === null) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Nothing to update for hostel room',
      });
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (beds !== null) {
      updates.push(`current_occupancy = $${idx++}`);
      params.push(beds);
    }

    if (fee !== null) {
      updates.push(`monthly_fee = $${idx++}`);
      params.push(fee);
    }

    updates.push(`modified_at = NOW()`);

    params.push(id);

    const result = await query(
      `
      UPDATE hostel_rooms
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Hostel room not found',
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Hostel room updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('=== ERROR UPDATING HOSTEL ROOM ===');
    console.error('Error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Failed to update hostel room' : `Failed to update hostel room: ${error.message || 'Unknown error'}`,
    });
  }
};

module.exports = {
  getAllHostelRooms,
  getHostelRoomById,
  updateHostelRoom,
};
