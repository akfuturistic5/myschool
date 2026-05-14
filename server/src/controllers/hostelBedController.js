const { query } = require('../config/database');
const { success, errorResponse } = require('../utils/responseHelper');

const allowedBedStatus = ['available', 'occupied', 'reserved', 'maintenance'];

const parseBool = (v, fallback = false) => {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return fallback;
};

const roomCapacityRow = async (roomId) => {
  const r = await query(
    `
    SELECT
      hr.id AS room_id,
      hrt.sharing_capacity AS capacity_effective,
      (
        SELECT COUNT(*)::int FROM hostel_beds b
        WHERE b.room_id = hr.id AND b.deleted_at IS NULL AND b.is_active = true
      ) AS bed_count
    FROM hostel_rooms hr
    JOIN hostel_room_types hrt ON hrt.id = hr.hostel_room_type_id
    WHERE hr.id = $1 AND hr.deleted_at IS NULL AND hr.is_active = true
    LIMIT 1
    `,
    [roomId]
  );
  return r.rows[0] ?? null;
};

const buildBedListSelect = (includeInactive) => {
  const joinHr = includeInactive
    ? 'INNER JOIN hostel_rooms hr ON hr.id = b.room_id AND hr.deleted_at IS NULL'
    : 'INNER JOIN hostel_rooms hr ON hr.id = b.room_id AND hr.deleted_at IS NULL AND hr.is_active = true';
  const joinH = includeInactive
    ? 'INNER JOIN hostels h ON h.id = hr.hostel_id AND h.deleted_at IS NULL'
    : 'INNER JOIN hostels h ON h.id = hr.hostel_id AND h.deleted_at IS NULL AND h.is_active = true';
  const joinHf = includeInactive
    ? 'INNER JOIN hostel_floors hf ON hf.id = hr.floor_id AND hf.deleted_at IS NULL'
    : 'INNER JOIN hostel_floors hf ON hf.id = hr.floor_id AND hf.deleted_at IS NULL AND hf.is_active = true';
  const bedWhere = includeInactive
    ? 'b.deleted_at IS NULL'
    : 'b.deleted_at IS NULL AND b.is_active = true';
  return { joinHr, joinH, joinHf, bedWhere };
};

const getHostelBeds = async (req, res) => {
  try {
    const includeInactive =
      req.query.include_inactive === 'true' || req.query.include_inactive === '1';
    const { joinHr, joinH, joinHf, bedWhere } = buildBedListSelect(includeInactive);

    const roomIdRaw = req.query.room_id;
    if (roomIdRaw !== undefined && roomIdRaw !== null && String(roomIdRaw).trim() !== '') {
      const roomId = Number(roomIdRaw);
      if (Number.isNaN(roomId)) {
        return errorResponse(res, 400, 'room_id must be a number');
      }

      const roomOkSql = includeInactive
        ? `SELECT id FROM hostel_rooms WHERE id = $1 AND deleted_at IS NULL`
        : `SELECT id FROM hostel_rooms WHERE id = $1 AND deleted_at IS NULL AND is_active = true`;
      const roomOk = await query(roomOkSql, [roomId]);
      if (!roomOk.rows.length) {
        return errorResponse(res, 404, 'Hostel room not found');
      }

      const listBedsByRoomSql = `
        SELECT
          b.id,
          b.room_id,
          b.bed_number,
          b.position_label,
          b.bed_status,
          b.is_active,
          b.created_at,
          b.updated_at,
          hr.room_number,
          hr.hostel_id,
          hr.floor_id,
          h.hostel_name,
          hf.floor_name,
          hf.floor_number
        FROM hostel_beds b
        ${joinHr}
        ${joinH}
        ${joinHf}
        WHERE b.room_id = $1 AND ${bedWhere}
        ORDER BY b.bed_number ASC, b.id ASC
      `;
      const result = await query(listBedsByRoomSql, [roomId]);

      return success(res, 200, 'Hostel beds fetched successfully', result.rows, {
        count: result.rows.length,
      });
    }

    const listAllBedsSql = `
      SELECT
        b.id,
        b.room_id,
        b.bed_number,
        b.position_label,
        b.bed_status,
        b.is_active,
        b.created_at,
        b.updated_at,
        hr.room_number,
        hr.hostel_id,
        hr.floor_id,
        h.hostel_name,
        hf.floor_name,
        hf.floor_number
      FROM hostel_beds b
      ${joinHr}
      ${joinH}
      ${joinHf}
      WHERE ${bedWhere}
      ORDER BY h.hostel_name ASC NULLS LAST, hf.floor_number ASC, hr.room_number ASC NULLS LAST,
        b.bed_number ASC, b.id ASC
    `;
    const result = await query(listAllBedsSql);

    return success(res, 200, 'Hostel beds fetched successfully', result.rows, {
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching hostel beds:', error);
    return errorResponse(res, 500, 'Failed to fetch hostel beds');
  }
};

const getHostelBedById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `
      SELECT b.*,
        hr.room_number,
        hr.hostel_id,
        h.hostel_name
      FROM hostel_beds b
      JOIN hostel_rooms hr ON hr.id = b.room_id
      JOIN hostels h ON h.id = hr.hostel_id
      WHERE b.id = $1 AND b.deleted_at IS NULL
      `,
      [id]
    );
    if (!result.rows.length) {
      return errorResponse(res, 404, 'Bed not found');
    }
    return success(res, 200, 'Bed fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching bed:', error);
    return errorResponse(res, 500, 'Failed to fetch bed');
  }
};

const createHostelBed = async (req, res) => {
  try {
    const b = req.body || {};
    const { room_id, bed_number, position_label, bed_status } = b;

    if (room_id == null || room_id === '') {
      return errorResponse(res, 400, 'room_id is required');
    }
    if (!bed_number || String(bed_number).trim() === '') {
      return errorResponse(res, 400, 'bed_number is required');
    }

    const rid = Number(room_id);
    if (Number.isNaN(rid)) {
      return errorResponse(res, 400, 'Invalid room_id');
    }

    const capRow = await roomCapacityRow(rid);
    if (!capRow) {
      return errorResponse(res, 404, 'Hostel room not found');
    }

    const cap = Math.max(1, Math.min(50, Number(capRow.capacity_effective) || 1));
    if (Number(capRow.bed_count) >= cap) {
      return errorResponse(
        res,
        409,
        'Room is at maximum bed capacity; change the room type sharing capacity or remove a bed first'
      );
    }

    let status = bed_status != null ? String(bed_status).toLowerCase() : 'available';
    if (!allowedBedStatus.includes(status)) {
      return errorResponse(res, 400, `bed_status must be one of: ${allowedBedStatus.join(', ')}`);
    }
    if (status === 'occupied') {
      return errorResponse(res, 400, 'Cannot create a bed as occupied without an assignment');
    }

    const bedActive = parseBool(b.is_active, true);

    const result = await query(
      `
      INSERT INTO hostel_beds (room_id, bed_number, position_label, bed_status, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        rid,
        String(bed_number).trim(),
        position_label != null && position_label !== '' ? String(position_label) : null,
        status,
        bedActive,
      ]
    );

    return success(res, 201, 'Bed created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating bed:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Duplicate bed_number in this room');
    }
    return errorResponse(res, 500, 'Failed to create bed');
  }
};

const updateHostelBed = async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body || {};

    const updates = [];
    const params = [];
    let idx = 1;

    if (b.bed_number !== undefined && b.bed_number !== null) {
      updates.push(`bed_number = $${idx++}`);
      params.push(String(b.bed_number).trim());
    }
    if (b.position_label !== undefined) {
      updates.push(`position_label = $${idx++}`);
      params.push(
        b.position_label != null && b.position_label !== '' ? String(b.position_label) : null
      );
    }
    if (b.bed_status !== undefined && b.bed_status !== null) {
      const status = String(b.bed_status).toLowerCase();
      if (!allowedBedStatus.includes(status)) {
        return errorResponse(res, 400, 'invalid bed_status');
      }
      if (status !== 'occupied') {
        const occupied = await query(
          `
          SELECT id FROM hostel_assignments
          WHERE bed_id = $1 AND assignment_status = 'active' AND deleted_at IS NULL
          LIMIT 1
          `,
          [id]
        );
        if (occupied.rows.length > 0) {
          return errorResponse(
            res,
            409,
            'This bed has an active assignment; checkout or cancel before changing status away from occupied'
          );
        }
      }
      updates.push(`bed_status = $${idx++}`);
      params.push(status);
    }
    if (b.is_active !== undefined && b.is_active !== null && b.is_active !== '') {
      updates.push(`is_active = $${idx++}`);
      params.push(parseBool(b.is_active, true));
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `
      UPDATE hostel_beds
      SET ${updates.join(', ')}
      WHERE id = $${idx} AND deleted_at IS NULL
      RETURNING *
      `,
      params
    );

    if (!result.rows.length) {
      return errorResponse(res, 404, 'Bed not found');
    }

    return success(res, 200, 'Bed updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating bed:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Duplicate bed_number in this room');
    }
    return errorResponse(res, 500, 'Failed to update bed');
  }
};

const deleteHostelBed = async (req, res) => {
  try {
    const { id } = req.params;

    const occ = await query(
      `
      SELECT id FROM hostel_assignments
      WHERE bed_id = $1 AND assignment_status = 'active' AND deleted_at IS NULL
      LIMIT 1
      `,
      [id]
    );
    if (occ.rows.length > 0) {
      return errorResponse(res, 409, 'Cannot remove bed with an active assignment');
    }

    const result = await query(
      `
      UPDATE hostel_beds
      SET is_active = false, deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL AND is_active = true
      RETURNING id, room_id
      `,
      [id]
    );

    if (!result.rows.length) {
      return errorResponse(res, 404, 'Bed not found');
    }

    const rid = result.rows[0].room_id;
    const capRow = await roomCapacityRow(rid);
    const cap = Math.max(1, Math.min(50, Number(capRow?.capacity_effective) || 1));

    await query(
      `
      UPDATE hostel_rooms
      SET room_status = CASE
          WHEN (
            SELECT COUNT(*) FROM hostel_beds bx
            WHERE bx.room_id = $1 AND bx.deleted_at IS NULL
              AND bx.bed_status IN ('occupied', 'reserved')
          ) >= $2 THEN 'full'::character varying
          ELSE 'available'::character varying
        END,
        updated_at = NOW()
      WHERE id = $1
      `,
      [rid, cap]
    );

    return success(res, 200, 'Bed removed successfully', { id: Number(id) });
  } catch (error) {
    console.error('Error deleting bed:', error);
    return errorResponse(res, 500, 'Failed to delete bed');
  }
};

module.exports = {
  getHostelBeds,
  getHostelBedById,
  createHostelBed,
  updateHostelBed,
  deleteHostelBed,
};
