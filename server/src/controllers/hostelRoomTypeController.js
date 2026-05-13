const { query } = require('../config/database');
const { success, errorResponse } = require('../utils/responseHelper');

const parseBool = (v, fallback = false) => {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return fallback;
};

const getAllHostelRoomTypes = async (req, res) => {
  try {
    const includeInactive =
      req.query.include_inactive === 'true' || req.query.include_inactive === '1';
    const whereClause = includeInactive ? '' : 'WHERE is_active = true';
    const result = await query(
      `
      SELECT *
      FROM hostel_room_types
      ${whereClause}
      ORDER BY name ASC
      `
    );
    return success(res, 200, 'Hostel room types fetched successfully', result.rows, {
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching hostel room types:', error);
    return errorResponse(res, 500, 'Failed to fetch hostel room types');
  }
};

const getHostelRoomTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `
      SELECT * FROM hostel_room_types
      WHERE id = $1
      `,
      [id]
    );
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Hostel room type not found');
    }
    return success(res, 200, 'Hostel room type fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching hostel room type:', error);
    return errorResponse(res, 500, 'Failed to fetch hostel room type');
  }
};

const createHostelRoomType = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      name,
      sharing_capacity,
      has_ac,
      has_wifi,
      has_attached_bathroom,
      description,
      is_active,
    } = body;

    if (!name || String(name).trim() === '') {
      return errorResponse(res, 400, 'name is required');
    }

    let cap =
      sharing_capacity !== undefined && sharing_capacity !== null && sharing_capacity !== ''
        ? Number(sharing_capacity)
        : null;
    if (cap === null || Number.isNaN(cap) || cap < 1 || cap > 20) {
      return errorResponse(res, 400, 'sharing_capacity must be between 1 and 20');
    }

    const typeActive = parseBool(is_active, true);

    const result = await query(
      `
      INSERT INTO hostel_room_types (
        name, sharing_capacity, has_ac, has_wifi, has_attached_bathroom,
        description, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        String(name).trim(),
        cap,
        parseBool(has_ac, false),
        parseBool(has_wifi, false),
        parseBool(has_attached_bathroom, false),
        description != null ? String(description) : null,
        typeActive,
      ]
    );

    return success(res, 201, 'Hostel room type created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating hostel room type:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'A hostel room type with this name already exists');
    }
    return errorResponse(res, 500, 'Failed to create hostel room type');
  }
};

const updateHostelRoomType = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const updates = [];
    const params = [];
    let idx = 1;

    if (body.name !== undefined && body.name !== null) {
      updates.push(`name = $${idx++}`);
      params.push(String(body.name).trim());
    }

    if (body.sharing_capacity !== undefined && body.sharing_capacity !== null && body.sharing_capacity !== '') {
      const cap = Number(body.sharing_capacity);
      if (Number.isNaN(cap) || cap < 1 || cap > 20) {
        return errorResponse(res, 400, 'sharing_capacity must be between 1 and 20');
      }
      updates.push(`sharing_capacity = $${idx++}`);
      params.push(cap);
    }

    if (body.has_ac !== undefined) {
      updates.push(`has_ac = $${idx++}`);
      params.push(parseBool(body.has_ac, false));
    }
    if (body.has_wifi !== undefined) {
      updates.push(`has_wifi = $${idx++}`);
      params.push(parseBool(body.has_wifi, false));
    }
    if (body.has_attached_bathroom !== undefined) {
      updates.push(`has_attached_bathroom = $${idx++}`);
      params.push(parseBool(body.has_attached_bathroom, false));
    }
    if (body.description !== undefined) {
      updates.push(`description = $${idx++}`);
      params.push(body.description);
    }
    if (body.is_active !== undefined && body.is_active !== null && body.is_active !== '') {
      updates.push(`is_active = $${idx++}`);
      params.push(parseBool(body.is_active, true));
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `
      UPDATE hostel_room_types
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING *
      `,
      params
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Hostel room type not found');
    }

    return success(res, 200, 'Hostel room type updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating hostel room type:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'Duplicate name');
    }
    return errorResponse(res, 500, 'Failed to update hostel room type');
  }
};

const deleteHostelRoomType = async (req, res) => {
  try {
    const { id } = req.params;

    const rm = await query(
      `
      SELECT COUNT(*)::int AS c
      FROM hostel_rooms
      WHERE hostel_room_type_id = $1 AND deleted_at IS NULL AND is_active = true
      `,
      [id]
    );
    if (rm.rows[0]?.c > 0) {
      return errorResponse(res, 409, 'Cannot delete hostel room type while hostel rooms reference it');
    }

    const deactivated = await query(
      `
      UPDATE hostel_room_types SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND is_active = true
      RETURNING id
      `,
      [id]
    );
    if (deactivated.rows.length === 0) {
      const check = await query(`SELECT id FROM hostel_room_types WHERE id = $1`, [id]);
      if (!check.rows.length) {
        return errorResponse(res, 404, 'Hostel room type not found');
      }
    }

    return success(res, 200, 'Hostel room type deleted successfully', { id: Number(id) });
  } catch (error) {
    console.error('Error deleting hostel room type:', error);
    return errorResponse(res, 500, 'Failed to delete hostel room type');
  }
};

module.exports = {
  getAllHostelRoomTypes,
  getHostelRoomTypeById,
  createHostelRoomType,
  updateHostelRoomType,
  deleteHostelRoomType,
};
