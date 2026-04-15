const { query } = require('../config/database');

const getAllClassRooms = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        id,
        room_no,
        capacity,
        status,
        description,
        floor,
        building,
        created_at,
        modified_at
      FROM class_rooms
      ORDER BY room_no ASC
    `);

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Class rooms fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching class rooms:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch class rooms'
    });
  }
};

const getClassRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT
        id,
        room_no,
        capacity,
        status,
        description,
        floor,
        building,
        created_at,
        modified_at
      FROM class_rooms
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Class room not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Class room fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching class room:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch class room'
    });
  }
};

const createClassRoom = async (req, res) => {
  try {
    const { room_no, capacity, status, description, floor, building } = req.body;

    if (!room_no) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Room number is required'
      });
    }

    const cap = capacity != null ? parseInt(capacity, 10) : 50;
    const stat = (status && String(status).toLowerCase() === 'active') ? 'Active' : 'Inactive';

    const result = await query(`
      INSERT INTO class_rooms (room_no, capacity, status, description, floor, building)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [room_no, isNaN(cap) ? 50 : cap, stat, description || null, floor || null, building || null]);

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Class room created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Room number already exists'
      });
    }
    console.error('Error creating class room:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to create class room'
    });
  }
};

const updateClassRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { room_no, capacity, status, description, floor, building } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;

    if (room_no !== undefined) {
      updates.push(`room_no = $${idx++}`);
      params.push(room_no);
    }
    if (capacity !== undefined) {
      const cap = parseInt(capacity, 10);
      updates.push(`capacity = $${idx++}`);
      params.push(isNaN(cap) ? 50 : cap);
    }
    if (status !== undefined) {
      const stat = (status && String(status).toLowerCase() === 'active') ? 'Active' : 'Inactive';
      updates.push(`status = $${idx++}`);
      params.push(stat);
    }
    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      params.push(description || null);
    }
    if (floor !== undefined) {
      updates.push(`floor = $${idx++}`);
      params.push(floor || null);
    }
    if (building !== undefined) {
      updates.push(`building = $${idx++}`);
      params.push(building || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'No fields to update'
      });
    }

    updates.push(`modified_at = NOW()`);
    params.push(id);

    const result = await query(`
      UPDATE class_rooms
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Class room not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Class room updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Room number already exists'
      });
    }
    console.error('Error updating class room:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update class room'
    });
  }
};

const deleteClassRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM class_rooms WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Class room not found'
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Class room deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting class room:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to delete class room'
    });
  }
};

module.exports = {
  getAllClassRooms,
  getClassRoomById,
  createClassRoom,
  updateClassRoom,
  deleteClassRoom
};
