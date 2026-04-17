const { query } = require('../config/database');
const { success, errorResponse } = require('../utils/responseHelper');

const getAllRoomTypes = async (req, res) => {
  try {
    const result = await query(`
      SELECT *
      FROM room_types
      WHERE is_active = true
      ORDER BY room_type ASC
    `);

    return success(res, 200, 'Room types fetched successfully', result.rows, {
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching room types:', error);
    return errorResponse(res, 500, 'Failed to fetch room types');
  }
};

const getRoomTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `
      SELECT *
      FROM room_types
      WHERE id = $1 AND is_active = true
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Room type not found');
    }

    return success(res, 200, 'Room type fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching room type:', error);
    return errorResponse(res, 500, 'Failed to fetch room type');
  }
};

const createRoomType = async (req, res) => {
  try {
    const { room_type, description, max_occupancy, room_fee } = req.body;

    if (!room_type || String(room_type).trim() === '') {
      return errorResponse(res, 400, 'room_type is required');
    }

    const maxOcc =
      max_occupancy !== undefined && max_occupancy !== null && max_occupancy !== ''
        ? Number(max_occupancy)
        : null;
    const fee =
      room_fee !== undefined && room_fee !== null && room_fee !== ''
        ? Number(String(room_fee).replace(/[^\d.]/g, ''))
        : null;

    const result = await query(
      `
      INSERT INTO room_types (room_type, description, max_occupancy, room_fee, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING *
    `,
      [
        String(room_type).trim(),
        description != null ? String(description) : null,
        maxOcc != null && !Number.isNaN(maxOcc) ? maxOcc : null,
        fee != null && !Number.isNaN(fee) ? fee : null,
      ]
    );

    return success(res, 201, 'Room type created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating room type:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Room type name already exists');
    }
    return errorResponse(res, 500, 'Failed to create room type');
  }
};

const updateRoomType = async (req, res) => {
  try {
    const { id } = req.params;
    const { room_type, description, max_occupancy, room_fee } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;

    if (room_type !== undefined) {
      updates.push(`room_type = $${idx++}`);
      params.push(String(room_type).trim());
    }
    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      params.push(description);
    }
    if (max_occupancy !== undefined) {
      const maxOcc =
        max_occupancy !== null && max_occupancy !== '' ? Number(max_occupancy) : null;
      updates.push(`max_occupancy = $${idx++}`);
      params.push(maxOcc != null && !Number.isNaN(maxOcc) ? maxOcc : null);
    }
    if (room_fee !== undefined) {
      const fee =
        room_fee !== null && room_fee !== ''
          ? Number(String(room_fee).replace(/[^\d.]/g, ''))
          : null;
      updates.push(`room_fee = $${idx++}`);
      params.push(fee != null && !Number.isNaN(fee) ? fee : null);
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    updates.push('modified_at = NOW()');
    params.push(id);

    const result = await query(
      `
      UPDATE room_types
      SET ${updates.join(', ')}
      WHERE id = $${idx} AND is_active = true
      RETURNING *
    `,
      params
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Room type not found');
    }

    return success(res, 200, 'Room type updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating room type:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Room type name already exists');
    }
    return errorResponse(res, 500, 'Failed to update room type');
  }
};

const deleteRoomType = async (req, res) => {
  try {
    const { id } = req.params;

    const rooms = await query(
      `
      SELECT COUNT(*)::int AS c FROM hostel_rooms
      WHERE is_active = true AND room_type_id = $1
    `,
      [id]
    );
    if (rooms.rows[0] && rooms.rows[0].c > 0) {
      return errorResponse(res, 409, 'Cannot delete room type while hostel rooms use it');
    }

    const result = await query(
      `
      UPDATE room_types
      SET is_active = false, modified_at = NOW()
      WHERE id = $1 AND is_active = true
      RETURNING id
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Room type not found');
    }

    return success(res, 200, 'Room type deleted successfully', { id: Number(id) });
  } catch (error) {
    console.error('Error deleting room type:', error);
    return errorResponse(res, 500, 'Failed to delete room type');
  }
};

module.exports = {
  getAllRoomTypes,
  getRoomTypeById,
  createRoomType,
  updateRoomType,
  deleteRoomType,
};
