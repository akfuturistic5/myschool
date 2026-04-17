const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

const getAllHostelRooms = async (req, res) => {
  try {
    const academicYearId = req.query.academic_year_id;
    const yearNum =
      academicYearId !== undefined && academicYearId !== null && academicYearId !== ''
        ? Number(academicYearId)
        : NaN;
    const useYear = !Number.isNaN(yearNum);

    const result = await query(
      `
      SELECT 
        hr.id,
        hr.room_number,
        hr.hostel_id,
        hr.room_type_id,
        hr.floor_number,
        hr.max_occupancy,
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
        AND COALESCE(h.is_active, true) = true
      ORDER BY h.hostel_name ASC NULLS LAST, hr.room_number ASC
    `
    );

    let rows = result.rows;

    if (useYear && rows.length > 0) {
      try {
        const idRes = await query(
          `
          SELECT id FROM hostels
          WHERE is_active = true
            AND (academic_year_id = $1 OR academic_year_id IS NULL)
        `,
          [yearNum]
        );
        const allowed = new Set(idRes.rows.map((r) => r.id));
        rows = rows.filter((r) => r.hostel_id == null || allowed.has(r.hostel_id));
      } catch (err) {
        if (err && err.code !== '42703') {
          throw err;
        }
        /* column academic_year_id missing — keep full list */
      }
    }

    return success(res, 200, 'Hostel rooms fetched successfully', rows, {
      count: rows.length,
    });
  } catch (error) {
    console.error('Error fetching hostel rooms:', error);
    return errorResponse(res, 500, 'Failed to fetch hostel rooms');
  }
};

const getHostelRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `
      SELECT 
        hr.id,
        hr.room_number,
        hr.hostel_id,
        hr.room_type_id,
        hr.floor_number,
        hr.max_occupancy,
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
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Hostel room not found');
    }

    return success(res, 200, 'Hostel room fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching hostel room by id:', error);
    return errorResponse(res, 500, 'Failed to fetch hostel room');
  }
};

const createHostelRoom = async (req, res) => {
  try {
    const {
      room_number,
      hostel_id,
      room_type_id,
      floor_number,
      max_occupancy,
      current_occupancy,
      monthly_fee,
      no_of_bed,
    } = req.body;

    if (!room_number || String(room_number).trim() === '') {
      return errorResponse(res, 400, 'room_number is required');
    }
    if (hostel_id == null || hostel_id === '') {
      return errorResponse(res, 400, 'hostel_id is required');
    }
    if (room_type_id == null || room_type_id === '') {
      return errorResponse(res, 400, 'room_type_id is required');
    }

    const hid = Number(hostel_id);
    const rtid = Number(room_type_id);

    const hostelCheck = await query(`SELECT id FROM hostels WHERE id = $1 AND is_active = true`, [
      hid,
    ]);
    if (hostelCheck.rows.length === 0) {
      return errorResponse(res, 400, 'Invalid hostel_id');
    }

    const typeCheck = await query(`SELECT id FROM room_types WHERE id = $1 AND is_active = true`, [
      rtid,
    ]);
    if (typeCheck.rows.length === 0) {
      return errorResponse(res, 400, 'Invalid room_type_id');
    }

    let maxBeds =
      max_occupancy !== undefined && max_occupancy !== null && max_occupancy !== ''
        ? Number(max_occupancy)
        : null;
    if ((maxBeds === null || Number.isNaN(maxBeds)) && no_of_bed != null && no_of_bed !== '') {
      maxBeds = Number(no_of_bed);
    }
    if (maxBeds === null || Number.isNaN(maxBeds) || maxBeds < 1) {
      maxBeds = 1;
    }

    let curOcc =
      current_occupancy !== undefined && current_occupancy !== null && current_occupancy !== ''
        ? Number(current_occupancy)
        : 0;
    if (Number.isNaN(curOcc) || curOcc < 0) curOcc = 0;
    if (curOcc > maxBeds) curOcc = maxBeds;

    let fee = null;
    if (monthly_fee !== undefined && monthly_fee !== null && monthly_fee !== '') {
      const numeric =
        typeof monthly_fee === 'number'
          ? monthly_fee
          : Number(String(monthly_fee).replace(/[^\d.]/g, ''));
      fee = !Number.isNaN(numeric) ? numeric : null;
    }

    const floor =
      floor_number !== undefined && floor_number !== null && floor_number !== ''
        ? Number(floor_number)
        : null;

    const result = await query(
      `
      INSERT INTO hostel_rooms (
        room_number, hostel_id, room_type_id, floor_number,
        max_occupancy, current_occupancy, monthly_fee, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING *
    `,
      [
        String(room_number).trim(),
        hid,
        rtid,
        floor != null && !Number.isNaN(floor) ? floor : null,
        maxBeds,
        curOcc,
        fee,
      ]
    );

    return success(res, 201, 'Hostel room created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating hostel room:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Room number already exists for this hostel');
    }
    return errorResponse(res, 500, 'Failed to create hostel room');
  }
};

const updateHostelRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      room_number,
      hostel_id,
      room_type_id,
      floor_number,
      max_occupancy,
      current_occupancy,
      monthly_fee,
      no_of_bed,
      cost_per_bed,
    } = req.body;

    const updates = [];
    const params = [];
    let idx = 1;

    if (room_number !== undefined && room_number !== null) {
      updates.push(`room_number = $${idx++}`);
      params.push(String(room_number).trim());
    }
    if (hostel_id !== undefined && hostel_id !== null && hostel_id !== '') {
      const hid = Number(hostel_id);
      const hostelCheck = await query(
        `SELECT id FROM hostels WHERE id = $1 AND is_active = true`,
        [hid]
      );
      if (hostelCheck.rows.length === 0) {
        return errorResponse(res, 400, 'Invalid hostel_id');
      }
      updates.push(`hostel_id = $${idx++}`);
      params.push(hid);
    }
    if (room_type_id !== undefined && room_type_id !== null && room_type_id !== '') {
      const rtid = Number(room_type_id);
      const typeCheck = await query(
        `SELECT id FROM room_types WHERE id = $1 AND is_active = true`,
        [rtid]
      );
      if (typeCheck.rows.length === 0) {
        return errorResponse(res, 400, 'Invalid room_type_id');
      }
      updates.push(`room_type_id = $${idx++}`);
      params.push(rtid);
    }
    if (floor_number !== undefined) {
      const fl =
        floor_number !== null && floor_number !== '' ? Number(floor_number) : null;
      updates.push(`floor_number = $${idx++}`);
      params.push(fl != null && !Number.isNaN(fl) ? fl : null);
    }

    let maxBeds =
      max_occupancy !== undefined && max_occupancy !== null && max_occupancy !== ''
        ? Number(max_occupancy)
        : null;
    if ((maxBeds === null || Number.isNaN(maxBeds)) && no_of_bed !== undefined && no_of_bed !== null && no_of_bed !== '') {
      maxBeds = Number(no_of_bed);
    }
    if (maxBeds !== null && !Number.isNaN(maxBeds)) {
      updates.push(`max_occupancy = $${idx++}`);
      params.push(maxBeds);
    }

    if (current_occupancy !== undefined && current_occupancy !== null && current_occupancy !== '') {
      let cur = Number(current_occupancy);
      if (!Number.isNaN(cur)) {
        if (cur < 0) cur = 0;
        updates.push(`current_occupancy = $${idx++}`);
        params.push(cur);
      }
    }

    let feeRaw = cost_per_bed ?? monthly_fee;
    if (feeRaw !== undefined && feeRaw !== null && feeRaw !== '') {
      const numeric =
        typeof feeRaw === 'number' ? feeRaw : Number(String(feeRaw).replace(/[^\d.]/g, ''));
      if (!Number.isNaN(numeric)) {
        updates.push(`monthly_fee = $${idx++}`);
        params.push(numeric);
      }
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'Nothing to update for hostel room');
    }

    updates.push(`modified_at = NOW()`);
    params.push(id);

    const result = await query(
      `
      UPDATE hostel_rooms
      SET ${updates.join(', ')}
      WHERE id = $${idx} AND is_active = true
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
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Room number already exists for this hostel');
    }
    return errorResponse(res, 500, 'Failed to update hostel room');
  }
};

const deleteHostelRoom = async (req, res) => {
  try {
    const { id } = req.params;

    const students = await query(
      `
      SELECT COUNT(*)::int AS c FROM students
      WHERE is_active = true AND hostel_room_id = $1
    `,
      [id]
    );
    if (students.rows[0] && students.rows[0].c > 0) {
      return errorResponse(res, 409, 'Cannot delete room while students are assigned');
    }

    const result = await query(
      `
      UPDATE hostel_rooms
      SET is_active = false, modified_at = NOW()
      WHERE id = $1 AND is_active = true
      RETURNING id
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Hostel room not found');
    }

    return success(res, 200, 'Hostel room deleted successfully', { id: Number(id) });
  } catch (error) {
    console.error('Error deleting hostel room:', error);
    return errorResponse(res, 500, 'Failed to delete hostel room');
  }
};

module.exports = {
  getAllHostelRooms,
  getHostelRoomById,
  createHostelRoom,
  updateHostelRoom,
  deleteHostelRoom,
};
