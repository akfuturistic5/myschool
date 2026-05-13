const { query } = require('../config/database');
const { success, errorResponse } = require('../utils/responseHelper');

const roomSelectBase = `
  SELECT
    hr.id,
    hr.hostel_id,
    hr.floor_id,
    hr.hostel_room_type_id,
    hr.hostel_room_type_id AS room_type_id,
    hr.room_number,
    hr.monthly_rent,
    hr.monthly_rent AS monthly_fee,
    hr.room_status,
    hr.notes,
    hr.is_active,
    hr.created_at,
    hr.updated_at,
    h.hostel_name,
    hf.floor_name,
    hf.floor_number,
    hrt.name AS room_type,
    hrt.name AS room_type_name,
    hrt.sharing_capacity AS type_sharing_capacity,
    hrt.sharing_capacity AS capacity_effective,
    (
      SELECT COUNT(*)::int
      FROM hostel_beds b
      WHERE b.room_id = hr.id AND b.deleted_at IS NULL AND b.is_active = true
    ) AS bed_count,
    (
      SELECT COUNT(*)::int
      FROM hostel_beds b
      WHERE b.room_id = hr.id AND b.deleted_at IS NULL AND b.is_active = true
        AND b.bed_status = 'occupied'
    ) AS occupied_bed_count
  FROM hostel_rooms hr
  INNER JOIN hostels h ON h.id = hr.hostel_id
  INNER JOIN hostel_floors hf ON hf.id = hr.floor_id
  INNER JOIN hostel_room_types hrt ON hrt.id = hr.hostel_room_type_id
`;

const roomWhereActiveOnly = `
  WHERE hr.deleted_at IS NULL AND hr.is_active = true
    AND h.deleted_at IS NULL AND h.is_active = true`;

const roomWhereIncludeInactive = `
  WHERE hr.deleted_at IS NULL AND h.deleted_at IS NULL`;

const resolveDefaultFloorId = async (hostelId) => {
  const r = await query(
    `
    SELECT id FROM hostel_floors
    WHERE hostel_id = $1 AND deleted_at IS NULL AND is_active = true
    ORDER BY floor_number ASC, id ASC
    LIMIT 1
    `,
    [hostelId]
  );
  return r.rows[0]?.id ?? null;
};

const assertFloorBelongsToHostel = async (floorId, hostelId) => {
  const r = await query(
    `
    SELECT id FROM hostel_floors
    WHERE id = $1 AND hostel_id = $2 AND deleted_at IS NULL AND is_active = true
    LIMIT 1
    `,
    [floorId, hostelId]
  );
  return r.rows.length > 0;
};

const createBedsForRoom = async (roomId, capacity) => {
  const n = Math.max(1, Math.min(50, Number(capacity) || 1));
  const values = [];
  const params = [];
  for (let i = 1; i <= n; i += 1) {
    const base = params.length;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, 'available', true)`);
    params.push(roomId, String(i), null);
  }
  await query(
    `
    INSERT INTO hostel_beds (room_id, bed_number, position_label, bed_status, is_active)
    VALUES ${values.join(', ')}
    `,
    params
  );
};

const getAllHostelRooms = async (req, res) => {
  try {
    const includeInactive =
      req.query.include_inactive === 'true' || req.query.include_inactive === '1';
    const whereClause = includeInactive ? roomWhereIncludeInactive : roomWhereActiveOnly;
    let sql = `${roomSelectBase} ${whereClause} `;
    const params = [];
    const hid = req.query.hostel_id;
    if (hid !== undefined && hid !== null && String(hid).trim() !== '') {
      const nh = Number(hid);
      if (!Number.isNaN(nh)) {
        params.push(nh);
        sql += ` AND hr.hostel_id = $${params.length}`;
      }
    }
    sql += ` ORDER BY h.hostel_name ASC NULLS LAST, hr.room_number ASC`;

    const result = await query(sql, params);
    const rows = result.rows;
    return success(res, 200, 'Hostel rooms fetched successfully', rows, { count: rows.length });
  } catch (error) {
    console.error('Error fetching hostel rooms:', error);
    return errorResponse(res, 500, 'Failed to fetch hostel rooms');
  }
};

const getHostelRoomBeds = async (req, res) => {
  try {
    const { id } = req.params;
    const roomCheck = await query(
      `
      SELECT id FROM hostel_rooms
      WHERE id = $1 AND deleted_at IS NULL AND is_active = true
      `,
      [id]
    );
    if (!roomCheck.rows.length) {
      return errorResponse(res, 404, 'Hostel room not found');
    }
    const result = await query(
      `
      SELECT id, room_id, bed_number, position_label, bed_status, is_active,
        created_at, updated_at
      FROM hostel_beds
      WHERE room_id = $1 AND deleted_at IS NULL AND is_active = true
      ORDER BY bed_number ASC, id ASC
      `,
      [id]
    );
    return success(res, 200, 'Beds fetched successfully', result.rows, {
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching beds:', error);
    return errorResponse(res, 500, 'Failed to fetch beds');
  }
};

const getHostelRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`${roomSelectBase} ${roomWhereIncludeInactive} AND hr.id = $1`, [id]);

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
    const body = req.body || {};
    const {
      room_number,
      hostel_id,
      floor_id,
      hostel_room_type_id,
      room_type_id,
      monthly_rent,
      monthly_fee,
      room_status,
      notes,
    } = body;

    if (!room_number || String(room_number).trim() === '') {
      return errorResponse(res, 400, 'room_number is required');
    }
    if (hostel_id == null || hostel_id === '') {
      return errorResponse(res, 400, 'hostel_id is required');
    }

    const hid = Number(hostel_id);
    const hrtRaw = hostel_room_type_id ?? room_type_id;
    if (hrtRaw == null || hrtRaw === '') {
      return errorResponse(res, 400, 'hostel_room_type_id is required');
    }
    const hrtid = Number(hrtRaw);
    if (Number.isNaN(hid) || Number.isNaN(hrtid)) {
      return errorResponse(res, 400, 'Invalid hostel_id or hostel_room_type_id');
    }

    const hostelCheck = await query(
      `SELECT id FROM hostels WHERE id = $1 AND deleted_at IS NULL AND is_active = true`,
      [hid]
    );
    if (hostelCheck.rows.length === 0) {
      return errorResponse(res, 400, 'Invalid hostel_id');
    }

    const typeCheck = await query(
      `SELECT id, sharing_capacity FROM hostel_room_types WHERE id = $1 AND is_active = true`,
      [hrtid]
    );
    if (typeCheck.rows.length === 0) {
      return errorResponse(res, 400, 'Invalid hostel_room_type_id');
    }
    const typeSharing = typeCheck.rows[0].sharing_capacity;

    let fid = floor_id != null && floor_id !== '' ? Number(floor_id) : null;
    if (fid != null && !Number.isNaN(fid)) {
      const ok = await assertFloorBelongsToHostel(fid, hid);
      if (!ok) return errorResponse(res, 400, 'floor_id does not belong to this hostel');
    } else {
      fid = await resolveDefaultFloorId(hid);
      if (!fid) {
        return errorResponse(res, 400, 'Hostel has no floors; recreate hostel or add a floor');
      }
    }

    let rentNum = monthly_rent ?? monthly_fee;
    rentNum =
      rentNum !== undefined && rentNum !== null && rentNum !== ''
        ? typeof rentNum === 'number'
          ? rentNum
          : Number(String(rentNum).replace(/[^\d.-]/g, ''))
        : 0;
    if (rentNum !== rentNum || rentNum < 0) rentNum = 0;

    const rs = room_status != null ? String(room_status).toLowerCase() : 'available';
    const allowedRs = ['available', 'full', 'maintenance', 'blocked'];
    if (!allowedRs.includes(rs)) {
      return errorResponse(res, 400, 'room_status must be available, full, maintenance, or blocked');
    }

    let roomActive = true;
    if (body.is_active !== undefined && body.is_active !== null && body.is_active !== '') {
      const si = String(body.is_active).trim().toLowerCase();
      roomActive = !(si === 'false' || si === '0');
    }

    const result = await query(
      `
      INSERT INTO hostel_rooms (
        hostel_id, floor_id, hostel_room_type_id, room_number,
        monthly_rent, room_status, notes, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [
        hid,
        fid,
        hrtid,
        String(room_number).trim(),
        rentNum,
        rs,
        notes != null ? String(notes) : null,
        roomActive,
      ]
    );

    const newId = result.rows[0].id;
    const effectiveCap = Math.max(1, Math.min(50, Number(typeSharing) || 1));

    await createBedsForRoom(newId, effectiveCap);

    const full = await query(`${roomSelectBase} ${roomWhereIncludeInactive} AND hr.id = $1`, [newId]);
    return success(res, 201, 'Hostel room created successfully', full.rows[0]);
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
    const body = req.body || {};

    const updates = [];
    const params = [];
    let idx = 1;

    if (body.room_number !== undefined && body.room_number !== null) {
      updates.push(`room_number = $${idx++}`);
      params.push(String(body.room_number).trim());
    }

    if (body.hostel_id !== undefined && body.hostel_id !== null && body.hostel_id !== '') {
      const hid = Number(body.hostel_id);
      const hostelCheck = await query(
        `SELECT id FROM hostels WHERE id = $1 AND deleted_at IS NULL AND is_active = true`,
        [hid]
      );
      if (hostelCheck.rows.length === 0) {
        return errorResponse(res, 400, 'Invalid hostel_id');
      }
      updates.push(`hostel_id = $${idx++}`);
      params.push(hid);
    }

    if (body.floor_id !== undefined && body.floor_id !== null && body.floor_id !== '') {
      const fid = Number(body.floor_id);
      const hostelIdRow = await query(`SELECT hostel_id FROM hostel_rooms WHERE id = $1`, [id]);
      if (!hostelIdRow.rows.length) return errorResponse(res, 404, 'Hostel room not found');
      const targetHostel = body.hostel_id != null ? Number(body.hostel_id) : hostelIdRow.rows[0].hostel_id;
      const ok = await assertFloorBelongsToHostel(fid, targetHostel);
      if (!ok) return errorResponse(res, 400, 'floor_id does not belong to the room hostel');
      updates.push(`floor_id = $${idx++}`);
      params.push(fid);
    }

    if (
      body.hostel_room_type_id !== undefined ||
      body.room_type_id !== undefined
    ) {
      const rtid = Number(body.hostel_room_type_id ?? body.room_type_id);
      const typeCheck = await query(
        `SELECT id FROM hostel_room_types WHERE id = $1 AND is_active = true`,
        [rtid]
      );
      if (typeCheck.rows.length === 0) {
        return errorResponse(res, 400, 'Invalid hostel_room_type_id');
      }
      updates.push(`hostel_room_type_id = $${idx++}`);
      params.push(rtid);
    }

    let rentRaw = body.monthly_rent ?? body.monthly_fee;
    if (rentRaw !== undefined && rentRaw !== null && rentRaw !== '') {
      const numeric =
        typeof rentRaw === 'number' ? rentRaw : Number(String(rentRaw).replace(/[^\d.-]/g, ''));
      if (!Number.isNaN(numeric) && numeric >= 0) {
        updates.push(`monthly_rent = $${idx++}`);
        params.push(numeric);
      }
    }

    if (body.room_status !== undefined && body.room_status !== null) {
      const rs = String(body.room_status).toLowerCase();
      const allowedRs = ['available', 'full', 'maintenance', 'blocked'];
      if (!allowedRs.includes(rs)) {
        return errorResponse(res, 400, 'invalid room_status');
      }
      updates.push(`room_status = $${idx++}`);
      params.push(rs);
    }

    if (body.notes !== undefined) {
      updates.push(`notes = $${idx++}`);
      params.push(body.notes);
    }

    if (body.is_active !== undefined && body.is_active !== null && body.is_active !== '') {
      const s = String(body.is_active).trim().toLowerCase();
      updates.push(`is_active = $${idx++}`);
      params.push(!(s === 'false' || s === '0'));
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'Nothing to update for hostel room');
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `
      UPDATE hostel_rooms
      SET ${updates.join(', ')}
      WHERE id = $${idx} AND deleted_at IS NULL
      RETURNING id
      `,
      params
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Hostel room not found');
    }

    const full = await query(`${roomSelectBase} ${roomWhereIncludeInactive} AND hr.id = $1`, [id]);
    return success(res, 200, 'Hostel room updated successfully', full.rows[0]);
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

    const assigns = await query(
      `
      SELECT COUNT(*)::int AS c
      FROM hostel_assignments
      WHERE room_id = $1 AND assignment_status = 'active' AND deleted_at IS NULL
      `,
      [id]
    );
    if (assigns.rows[0]?.c > 0) {
      return errorResponse(res, 409, 'Cannot deactivate room while it has active assignments');
    }

    await query(`UPDATE hostel_beds SET deleted_at = NOW(), updated_at = NOW() WHERE room_id = $1 AND deleted_at IS NULL`, [id]);

    const result = await query(
      `
      UPDATE hostel_rooms
      SET is_active = false, deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL AND is_active = true
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
  getHostelRoomBeds,
  getHostelRoomById,
  createHostelRoom,
  updateHostelRoom,
  deleteHostelRoom,
};
