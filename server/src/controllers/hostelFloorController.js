const { query } = require('../config/database');
const { success, errorResponse } = require('../utils/responseHelper');

const getHostelFloorsByHostel = async (req, res) => {
  try {
    const includeInactive =
      req.query.include_inactive === 'true' || req.query.include_inactive === '1';
    const floorActiveClause = includeInactive ? '' : ' AND hf.is_active = true';

    const raw = req.query.hostel_id;
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const hid = Number(raw);
      if (Number.isNaN(hid)) {
        return errorResponse(res, 400, 'hostel_id must be a number');
      }
      const sql = `
        SELECT hf.*, h.hostel_name
        FROM hostel_floors hf
        JOIN hostels h ON h.id = hf.hostel_id AND h.deleted_at IS NULL AND h.is_active = true
        WHERE hf.hostel_id = $1 AND hf.deleted_at IS NULL${floorActiveClause}
        ORDER BY hf.floor_number ASC, hf.id ASC
      `;
      const result = await query(sql, [hid]);
      return success(res, 200, 'Hostel floors fetched successfully', result.rows, {
        count: result.rows.length,
      });
    }
    const sqlAll = `
      SELECT hf.*, h.hostel_name
      FROM hostel_floors hf
      JOIN hostels h ON h.id = hf.hostel_id AND h.deleted_at IS NULL AND h.is_active = true
      WHERE hf.deleted_at IS NULL${floorActiveClause}
      ORDER BY h.hostel_name ASC NULLS LAST, hf.floor_number ASC, hf.id ASC
    `;
    const result = await query(sqlAll);
    return success(res, 200, 'Hostel floors fetched successfully', result.rows, {
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching hostel floors:', error);
    return errorResponse(res, 500, 'Failed to fetch hostel floors');
  }
};

const getHostelFloorById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `
      SELECT hf.*, h.hostel_name
      FROM hostel_floors hf
      JOIN hostels h ON h.id = hf.hostel_id
      WHERE hf.id = $1 AND hf.deleted_at IS NULL
      `,
      [id]
    );
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Floor not found');
    }
    return success(res, 200, 'Floor fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching floor:', error);
    return errorResponse(res, 500, 'Failed to fetch floor');
  }
};

const createHostelFloor = async (req, res) => {
  try {
    const b = req.body || {};
    const { hostel_id, floor_name, floor_number, wing_name } = b;

    if (hostel_id == null || hostel_id === '') {
      return errorResponse(res, 400, 'hostel_id is required');
    }
    if (!floor_name || String(floor_name).trim() === '') {
      return errorResponse(res, 400, 'floor_name is required');
    }
    const hid = Number(hostel_id);
    let fn =
      floor_number !== undefined && floor_number !== null && floor_number !== ''
        ? Number(floor_number)
        : null;
    if (fn === null || Number.isNaN(fn)) {
      return errorResponse(res, 400, 'floor_number is required');
    }

    const h = await query(
      `SELECT id FROM hostels WHERE id = $1 AND deleted_at IS NULL AND is_active = true`,
      [hid]
    );
    if (!h.rows.length) {
      return errorResponse(res, 400, 'Invalid hostel');
    }

    let floorActive = true;
    if (b.is_active !== undefined && b.is_active !== null && b.is_active !== '') {
      const s = String(b.is_active).trim().toLowerCase();
      floorActive = !(s === 'false' || s === '0');
    }

    const result = await query(
      `
      INSERT INTO hostel_floors (hostel_id, floor_name, floor_number, wing_name, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [hid, String(floor_name).trim(), fn, wing_name != null ? String(wing_name) : null, floorActive]
    );

    return success(res, 201, 'Floor created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating floor:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Floor number already exists for this hostel');
    }
    return errorResponse(res, 500, 'Failed to create floor');
  }
};

const updateHostelFloor = async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body || {};
    const updates = [];
    const params = [];
    let idx = 1;

    if (b.floor_name !== undefined && b.floor_name !== null) {
      updates.push(`floor_name = $${idx++}`);
      params.push(String(b.floor_name).trim());
    }
    if (
      b.floor_number !== undefined &&
      b.floor_number !== null &&
      b.floor_number !== ''
    ) {
      const fn = Number(b.floor_number);
      if (Number.isNaN(fn)) {
        return errorResponse(res, 400, 'floor_number invalid');
      }
      updates.push(`floor_number = $${idx++}`);
      params.push(fn);
    }
    if (b.wing_name !== undefined) {
      updates.push(`wing_name = $${idx++}`);
      params.push(b.wing_name != null ? String(b.wing_name) : null);
    }
    if (b.is_active !== undefined && b.is_active !== null && b.is_active !== '') {
      const s = String(b.is_active).trim().toLowerCase();
      updates.push(`is_active = $${idx++}`);
      params.push(!(s === 'false' || s === '0'));
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `
      UPDATE hostel_floors
      SET ${updates.join(', ')}
      WHERE id = $${idx} AND deleted_at IS NULL
      RETURNING *
      `,
      params
    );

    if (!result.rows.length) {
      return errorResponse(res, 404, 'Floor not found');
    }

    return success(res, 200, 'Floor updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating floor:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Floor number already exists for this hostel');
    }
    return errorResponse(res, 500, 'Failed to update floor');
  }
};

const deleteHostelFloor = async (req, res) => {
  try {
    const { id } = req.params;

    const rooms = await query(
      `
      SELECT COUNT(*)::int AS c FROM hostel_rooms
      WHERE floor_id = $1 AND deleted_at IS NULL AND is_active = true
      `,
      [id]
    );
    if (rooms.rows[0]?.c > 0) {
      return errorResponse(res, 409, 'Cannot remove floor while rooms reference it');
    }

    const result = await query(
      `
      UPDATE hostel_floors
      SET is_active = false, deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL AND is_active = true
      RETURNING id
      `,
      [id]
    );

    if (!result.rows.length) {
      return errorResponse(res, 404, 'Floor not found');
    }

    return success(res, 200, 'Floor removed successfully', { id: Number(id) });
  } catch (error) {
    console.error('Error deleting floor:', error);
    return errorResponse(res, 500, 'Failed to delete floor');
  }
};

module.exports = {
  getHostelFloorsByHostel,
  getHostelFloorById,
  createHostelFloor,
  updateHostelFloor,
  deleteHostelFloor,
};
