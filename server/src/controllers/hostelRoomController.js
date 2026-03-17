const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

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
    
    return success(res, 200, 'Hostel rooms fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching hostel rooms:', error);
    return errorResponse(res, 500, 'Failed to fetch hostel rooms');
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
      return errorResponse(res, 404, 'Hostel room not found');
    }

    return success(res, 200, 'Hostel room fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching hostel room by id:', error);
    return errorResponse(res, 500, 'Failed to fetch hostel room');
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
      return errorResponse(res, 400, 'Nothing to update for hostel room');
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
      return errorResponse(res, 404, 'Hostel room not found');
    }

    return success(res, 200, 'Hostel room updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating hostel room:', error);
    return errorResponse(res, 500, 'Failed to update hostel room');
  }
};

module.exports = {
  getAllHostelRooms,
  getHostelRoomById,
  updateHostelRoom,
};
