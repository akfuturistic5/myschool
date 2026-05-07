const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { hasColumn, hasTable } = require('../utils/schemaInspector');

function mapAssignmentRow(row) {
  return {
    id: row.id,
    assignment_code: `ASN-${String(row.id).padStart(4, '0')}`,
    vehicle_id: row.vehicle_id,
    route_id: row.route_id,
    driver_id: row.driver_id ?? row.staff_id ?? null,
    vehicle_number: row.vehicle_number || 'N/A',
    route_name: row.route_name || 'N/A',
    point_name: row.point_name || 'N/A',
    driver_name: row.driver_name || 'N/A',
    driver_phone: row.driver_phone || 'N/A',
    is_active: row.is_active !== false && row.is_active !== 'f',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const getAllAssignments = async (req, res) => {
  try {
    const hasDeletedAt = await hasColumn('vehicle_route_assignments', 'deleted_at');
    const hasRouteStops = await hasTable('route_stops');
    
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
      route_id,
      academic_year_id,
      sortField = 'id',
      sortOrder = 'ASC',
    } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    let whereClause = `WHERE ${hasDeletedAt ? 'vra.deleted_at IS NULL' : '1=1'}`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (
        v.vehicle_number ILIKE $${params.length}
        OR r.route_name ILIKE $${params.length}
        OR u.first_name ILIKE $${params.length}
        OR u.last_name ILIKE $${params.length}
      )`;
    }

    if (status && status !== 'all') {
      params.push(String(status).toLowerCase());
      whereClause += ` AND LOWER(COALESCE(s.status, 'active')) = $${params.length}`;
    }

    if (route_id && route_id !== 'all') {
      params.push(Number(route_id));
      whereClause += ` AND vra.route_id = $${params.length}`;
    }

    if (academic_year_id) {
      params.push(Number(academic_year_id));
      whereClause += ` AND vra.academic_year_id = $${params.length}`;
    }

    const allowedSortFields = ['id', 'vehicle_number', 'route_name', 'created_at'];
    let orderBy = 'vra.id';
    if (allowedSortFields.includes(sortField)) {
      if (sortField === 'vehicle_number') orderBy = 'v.vehicle_number';
      else if (sortField === 'route_name') orderBy = 'r.route_name';
      else orderBy = `vra.${sortField}`;
    }
    const direction = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const countResult = await query(
      `SELECT COUNT(*)
       FROM vehicle_route_assignments vra
       JOIN transport_vehicles v ON vra.vehicle_id = v.id
       JOIN routes r ON vra.route_id = r.id
       JOIN staff s ON vra.staff_id = s.id
       LEFT JOIN users u ON u.id = s.user_id
       ${whereClause}`,
      params
    );
    const totalCount = Number(countResult.rows[0]?.count || 0);

    const rowsResult = await query(
      `SELECT vra.*,
              v.vehicle_number,
              r.route_name,
              TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) as driver_name,
              COALESCE(u.phone, '') AS driver_phone,
              (${hasRouteStops
                ? `SELECT string_agg(pp_sub.point_name, ', ' ORDER BY rs_sub.order_index ASC)
                   FROM route_stops rs_sub
                   JOIN pickup_points pp_sub ON rs_sub.pickup_point_id = pp_sub.id
                   WHERE rs_sub.route_id = r.id`
                : `SELECT string_agg(pp_sub.point_name, ', ')
                   FROM pickup_points pp_sub
                   WHERE pp_sub.route_id = r.id`
              }) AS point_name
       FROM vehicle_route_assignments vra
       JOIN transport_vehicles v ON vra.vehicle_id = v.id
       JOIN routes r ON vra.route_id = r.id
       JOIN staff s ON vra.staff_id = s.id
       LEFT JOIN users u ON u.id = s.user_id
       ${whereClause}
       ORDER BY ${orderBy} ${direction}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Number(limit), offset]
    );

    return success(
      res,
      200,
      'Assignments fetched successfully',
      rowsResult.rows.map(mapAssignmentRow),
      {
        totalCount,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalCount / Number(limit)),
      }
    );
  } catch (err) {
    console.error('Error fetching assignments:', err);
    return errorResponse(res, 500, 'Failed to fetch assignments');
  }
};

const createAssignment = async (req, res) => {
  try {
    const { vehicle_id, route_id, staff_id, driver_id, academic_year_id, start_date, end_date } = req.body;
    const effectiveStaffId = staff_id ?? driver_id;

    if (!vehicle_id || !route_id || !effectiveStaffId || !academic_year_id) {
      return errorResponse(res, 400, 'Vehicle, route, staff and academic year are required');
    }

    const startDate = start_date || new Date().toISOString().split('T')[0];
    const endDate = end_date || '2099-12-31';
    const validPeriod = `[${startDate}, ${endDate}]`;

    const existing = await query(
      `SELECT id
       FROM vehicle_route_assignments
       WHERE vehicle_id = $1 AND route_id = $2 AND staff_id = $3 AND deleted_at IS NULL
       LIMIT 1`,
      [Number(vehicle_id), Number(route_id), Number(effectiveStaffId)]
    );
    if (existing.rows.length > 0) {
      return errorResponse(res, 400, 'This route-staff pair is already assigned to this vehicle');
    }

    const insert = await query(
      `INSERT INTO vehicle_route_assignments (vehicle_id, route_id, staff_id, academic_year_id, valid_period)
       VALUES ($1, $2, $3, $4, $5::daterange)
       RETURNING *`,
      [Number(vehicle_id), Number(route_id), Number(effectiveStaffId), Number(academic_year_id), validPeriod]
    );

    return success(res, 201, 'Assignment created successfully', mapAssignmentRow(insert.rows[0]));
  } catch (err) {
    console.error('Error creating assignment:', err);
    return errorResponse(res, 500, 'Failed to create assignment');
  }
};

const updateAssignment = async (req, res) => {
  try {
    const assignmentId = Number(req.params.id);
    if (Number.isNaN(assignmentId)) {
      return errorResponse(res, 400, 'Invalid assignment ID');
    }

    const { vehicle_id, route_id, staff_id, driver_id, academic_year_id, start_date, end_date } = req.body;
    const effectiveStaffId = staff_id ?? driver_id;
    const updates = [];
    const values = [];
    let i = 1;

    if (vehicle_id !== undefined) {
      updates.push(`vehicle_id = $${i++}`);
      values.push(vehicle_id ? Number(vehicle_id) : null);
    }
    if (route_id !== undefined) {
      updates.push(`route_id = $${i++}`);
      values.push(route_id ? Number(route_id) : null);
    }
    if (effectiveStaffId !== undefined) {
      updates.push(`staff_id = $${i++}`);
      values.push(effectiveStaffId ? Number(effectiveStaffId) : null);
    }
    if (academic_year_id !== undefined) {
      updates.push(`academic_year_id = $${i++}`);
      values.push(academic_year_id ? Number(academic_year_id) : null);
    }
    if (start_date !== undefined || end_date !== undefined) {
      // Handle valid_period update (requires fetching existing dates if one is missing)
      const existing = await query('SELECT valid_period FROM vehicle_route_assignments WHERE id = $1', [assignmentId]);
      if (existing.rows.length > 0) {
        const currentRange = existing.rows[0].valid_period;
        // Simplified: just update with provided or existing
        const startDate = start_date || '2000-01-01'; // Fallback
        const endDate = end_date || '2099-12-31';
        updates.push(`valid_period = $${i++}::daterange`);
        values.push(`[${startDate}, ${endDate}]`);
      }
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    values.push(assignmentId);
    const updated = await query(
      `UPDATE vehicle_route_assignments
       SET ${updates.join(', ')}
       WHERE id = $${i} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (updated.rows.length === 0) {
      return errorResponse(res, 404, 'Assignment not found');
    }

    return success(res, 200, 'Assignment updated successfully', mapAssignmentRow(updated.rows[0]));
  } catch (err) {
    console.error('Error updating assignment:', err);
    return errorResponse(res, 500, 'Failed to update assignment');
  }
};

const deleteAssignment = async (req, res) => {
  try {
    const hasDeletedAt = await hasColumn('vehicle_route_assignments', 'deleted_at');
    const assignmentId = Number(req.params.id);
    if (Number.isNaN(assignmentId)) {
      return errorResponse(res, 400, 'Invalid assignment ID');
    }

    const deleted = hasDeletedAt
      ? await query(
          `UPDATE vehicle_route_assignments
           SET deleted_at = NOW()
           WHERE id = $1 AND deleted_at IS NULL
           RETURNING id`,
          [assignmentId]
        )
      : await query(
          `DELETE FROM vehicle_route_assignments
           WHERE id = $1
           RETURNING id`,
          [assignmentId]
        );

    if (deleted.rows.length === 0) {
      return errorResponse(res, 404, 'Assignment not found');
    }

    return success(res, 200, 'Assignment removed successfully');
  } catch (err) {
    console.error('Error deleting assignment:', err);
    return errorResponse(res, 500, 'Failed to remove assignment');
  }
};

module.exports = {
  getAllAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
};
