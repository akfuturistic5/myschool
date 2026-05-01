const { query } = require('../config/database');
const { success, errorResponse } = require('../utils/responseHelper');

const normalizeHostelType = (t) => {
  if (t == null || t === '') return null;
  const s = String(t).trim().toLowerCase();
  if (['boys', 'girls', 'mixed'].includes(s)) return s;
  return null;
};

const getAllHostels = async (req, res) => {
  try {
    const result = await query(`SELECT * FROM hostels WHERE is_active = true ORDER BY hostel_name ASC`);

    return success(res, 200, 'Hostels fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching hostels:', error);
    return errorResponse(res, 500, 'Failed to fetch hostels');
  }
};

const getHostelById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `
      SELECT *
      FROM hostels
      WHERE id = $1 AND is_active = true
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Hostel not found');
    }

    return success(res, 200, 'Hostel fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching hostel:', error);
    return errorResponse(res, 500, 'Failed to fetch hostel');
  }
};

const createHostel = async (req, res) => {
  try {
    const {
      hostel_name,
      hostel_type,
      address,
      intake_capacity,
      description,
      total_rooms,
      contact_number,
      facilities,
      rules,
      warden_id,
    } = req.body;

    if (!hostel_name || String(hostel_name).trim() === '') {
      return errorResponse(res, 400, 'hostel_name is required');
    }

    const ht = normalizeHostelType(hostel_type);
    if (!ht) {
      return errorResponse(res, 400, 'hostel_type must be boys, girls, or mixed');
    }

    const intake =
      intake_capacity !== undefined && intake_capacity !== null && intake_capacity !== ''
        ? Number(intake_capacity)
        : null;

    const rooms =
      total_rooms !== undefined && total_rooms !== null && total_rooms !== ''
        ? Number(total_rooms)
        : null;

    const result = await query(
      `
      INSERT INTO hostels (
        hostel_name, hostel_type, address, intake_capacity, description,
        total_rooms, contact_number, facilities, rules, warden_id, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      RETURNING *
    `,
      [
        String(hostel_name).trim(),
        ht,
        address != null ? String(address) : null,
        intake != null && !Number.isNaN(intake) ? intake : null,
        description != null ? String(description) : null,
        rooms != null && !Number.isNaN(rooms) ? rooms : null,
        contact_number != null ? String(contact_number) : null,
        facilities != null ? String(facilities) : null,
        rules != null ? String(rules) : null,
        warden_id != null && warden_id !== '' ? Number(warden_id) : null,
      ]
    );

    return success(res, 201, 'Hostel created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating hostel:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Hostel name already exists');
    }
    return errorResponse(res, 500, 'Failed to create hostel');
  }
};

const updateHostel = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      hostel_name,
      hostel_type,
      address,
      intake_capacity,
      description,
      total_rooms,
      contact_number,
      facilities,
      rules,
      warden_id,
    } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;

    if (hostel_name !== undefined) {
      updates.push(`hostel_name = $${idx++}`);
      params.push(String(hostel_name).trim());
    }
    if (hostel_type !== undefined) {
      const ht = normalizeHostelType(hostel_type);
      if (!ht) {
        return errorResponse(res, 400, 'hostel_type must be boys, girls, or mixed');
      }
      updates.push(`hostel_type = $${idx++}`);
      params.push(ht);
    }
    if (address !== undefined) {
      updates.push(`address = $${idx++}`);
      params.push(address);
    }
    if (intake_capacity !== undefined) {
      const intake =
        intake_capacity !== null && intake_capacity !== '' ? Number(intake_capacity) : null;
      updates.push(`intake_capacity = $${idx++}`);
      params.push(intake != null && !Number.isNaN(intake) ? intake : null);
    }
    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      params.push(description);
    }
    if (total_rooms !== undefined) {
      const rooms = total_rooms !== null && total_rooms !== '' ? Number(total_rooms) : null;
      updates.push(`total_rooms = $${idx++}`);
      params.push(rooms != null && !Number.isNaN(rooms) ? rooms : null);
    }
    if (contact_number !== undefined) {
      updates.push(`contact_number = $${idx++}`);
      params.push(contact_number);
    }
    if (facilities !== undefined) {
      updates.push(`facilities = $${idx++}`);
      params.push(facilities);
    }
    if (rules !== undefined) {
      updates.push(`rules = $${idx++}`);
      params.push(rules);
    }
    if (warden_id !== undefined) {
      const wid = warden_id !== null && warden_id !== '' ? Number(warden_id) : null;
      updates.push(`warden_id = $${idx++}`);
      params.push(wid != null && !Number.isNaN(wid) ? wid : null);
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    updates.push('modified_at = NOW()');
    params.push(id);

    const result = await query(
      `
      UPDATE hostels
      SET ${updates.join(', ')}
      WHERE id = $${idx} AND is_active = true
      RETURNING *
    `,
      params
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Hostel not found');
    }

    return success(res, 200, 'Hostel updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating hostel:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Hostel name already exists');
    }
    return errorResponse(res, 500, 'Failed to update hostel');
  }
};

const deleteHostel = async (req, res) => {
  try {
    const { id } = req.params;

    const students = await query(
      `
      SELECT COUNT(*)::int AS c
      FROM students
      WHERE is_active = true AND (hostel_id = $1 OR hostel_room_id IN (
        SELECT id FROM hostel_rooms WHERE hostel_id = $1 AND is_active = true
      ))
    `,
      [id]
    );
    if (students.rows[0] && students.rows[0].c > 0) {
      return errorResponse(
        res,
        409,
        'Cannot delete hostel while students are assigned to it or its rooms'
      );
    }

    await query(
      `UPDATE hostel_rooms SET is_active = false, modified_at = NOW() WHERE hostel_id = $1`,
      [id]
    );

    const result = await query(
      `
      UPDATE hostels
      SET is_active = false, modified_at = NOW()
      WHERE id = $1 AND is_active = true
      RETURNING id
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Hostel not found');
    }

    return success(res, 200, 'Hostel deleted successfully', { id: Number(id) });
  } catch (error) {
    console.error('Error deleting hostel:', error);
    return errorResponse(res, 500, 'Failed to delete hostel');
  }
};

module.exports = {
  getAllHostels,
  getHostelById,
  createHostel,
  updateHostel,
  deleteHostel,
};
