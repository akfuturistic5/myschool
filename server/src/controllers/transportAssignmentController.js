const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { resolveAcademicYearId, toPositiveInt } = require('../utils/academicYear');
const { hasColumn, hasTable } = require('../utils/schemaInspector');

function mapAssignmentRow(row) {
  return {
    id: row.id,
    assignment_code: `ASN-${String(row.id).padStart(4, '0')}`,
    vehicle_id: row.vehicle_id,
    route_id: row.route_id,
    driver_id: row.driver_id,
    academic_year_id: row.academic_year_id || null,
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
    const hasTaDeletedAt = await hasColumn('transport_assignments', 'deleted_at');
    const hasVehicleDeletedAt = await hasColumn('vehicles', 'deleted_at');
    const hasRouteDeletedAt = await hasColumn('routes', 'deleted_at');
    const hasDriverDeletedAt = await hasColumn('drivers', 'deleted_at');
    const hasRouteStops = await hasTable('route_stops');
    const {
      page = 1,
      limit = 10,
      search = '',
      academic_year_id,
      status,
      route_id,
      sortField = 'id',
      sortOrder = 'ASC',
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const scopedAcademicYearId = await resolveAcademicYearId(academic_year_id);
    let whereClause = `WHERE ${hasTaDeletedAt ? 'ta.deleted_at IS NULL' : '1=1'}`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (
        v.vehicle_number ILIKE $${params.length}
        OR r.route_name ILIKE $${params.length}
        OR d.driver_name ILIKE $${params.length}
        OR d.phone ILIKE $${params.length}
      )`;
    }

    if (status !== undefined && status !== '') {
      const isActive = status === 'active' || status === 'true' || status === true;
      params.push(isActive);
      whereClause += ` AND ta.is_active = $${params.length}`;
    }

    if (route_id && route_id !== 'all') {
      params.push(Number(route_id));
      whereClause += ` AND ta.route_id = $${params.length}`;
    }
    if (scopedAcademicYearId) {
      params.push(scopedAcademicYearId);
      whereClause += ` AND ta.academic_year_id = $${params.length}`;
    }

    const allowedSortFields = ['id', 'vehicle_number', 'route_name', 'driver_name', 'is_active', 'created_at'];
    let orderBy = 'ta.id';
    if (allowedSortFields.includes(sortField)) {
      if (sortField === 'vehicle_number') orderBy = 'v.vehicle_number';
      else if (sortField === 'route_name') orderBy = 'r.route_name';
      else if (sortField === 'driver_name') orderBy = 'd.driver_name';
      else orderBy = `ta.${sortField}`;
    }
    const direction = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const countResult = await query(
      `SELECT COUNT(*)
       FROM transport_assignments ta
       JOIN vehicles v ON ta.vehicle_id = v.id ${hasVehicleDeletedAt ? 'AND v.deleted_at IS NULL' : ''}
       JOIN routes r ON ta.route_id = r.id ${hasRouteDeletedAt ? 'AND r.deleted_at IS NULL' : ''}
       JOIN drivers d ON ta.driver_id = d.id ${hasDriverDeletedAt ? 'AND d.deleted_at IS NULL' : ''}
       ${whereClause}`,
      params
    );
    const totalCount = Number(countResult.rows[0]?.count || 0);

    const rowsResult = await query(
      `SELECT ta.*,
              v.vehicle_number,
              r.route_name,
              d.driver_name,
              d.phone AS driver_phone,
              (${hasRouteStops
                ? `SELECT string_agg(pp_sub.point_name, ', ' ORDER BY rs_sub.order_index ASC)
                   FROM route_stops rs_sub
                   JOIN pickup_points pp_sub ON rs_sub.pickup_point_id = pp_sub.id
                   WHERE rs_sub.route_id = r.id`
                : `SELECT string_agg(pp_sub.point_name, ', ')
                   FROM pickup_points pp_sub
                   WHERE pp_sub.route_id = r.id`
              }) AS point_name
       FROM transport_assignments ta
       JOIN vehicles v ON ta.vehicle_id = v.id ${hasVehicleDeletedAt ? 'AND v.deleted_at IS NULL' : ''}
       JOIN routes r ON ta.route_id = r.id ${hasRouteDeletedAt ? 'AND r.deleted_at IS NULL' : ''}
       JOIN drivers d ON ta.driver_id = d.id ${hasDriverDeletedAt ? 'AND d.deleted_at IS NULL' : ''}
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
    const { vehicle_id, route_id, driver_id, is_active, academic_year_id } = req.body;

    if (!vehicle_id || !route_id || !driver_id) {
      return errorResponse(res, 400, 'Vehicle, route and driver are required');
    }

    const isActiveValue =
      is_active === true || is_active === 1 || is_active === 'true' || is_active === '1' || is_active === 'Active';
    const scopedAcademicYearId = await resolveAcademicYearId(academic_year_id || req.query?.academic_year_id);

    const existing = await query(
      `SELECT id
       FROM transport_assignments
       WHERE vehicle_id = $1 AND route_id = $2 AND driver_id = $3 AND academic_year_id = $4 AND deleted_at IS NULL
       LIMIT 1`,
      [Number(vehicle_id), Number(route_id), Number(driver_id), scopedAcademicYearId]
    );
    if (existing.rows.length > 0) {
      return errorResponse(res, 400, 'This route-driver pair is already assigned to this vehicle');
    }

    const insert = await query(
      `INSERT INTO transport_assignments (vehicle_id, route_id, driver_id, is_active, academic_year_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [Number(vehicle_id), Number(route_id), Number(driver_id), isActiveValue, scopedAcademicYearId]
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

    const { vehicle_id, route_id, driver_id, is_active, academic_year_id } = req.body;
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
    if (driver_id !== undefined) {
      updates.push(`driver_id = $${i++}`);
      values.push(driver_id ? Number(driver_id) : null);
    }
    if (is_active !== undefined) {
      const isActiveValue =
        is_active === true || is_active === 1 || is_active === 'true' || is_active === '1' || is_active === 'Active';
      updates.push(`is_active = $${i++}`);
      values.push(isActiveValue);
    }
    if (academic_year_id !== undefined) {
      updates.push(`academic_year_id = $${i++}`);
      values.push(toPositiveInt(academic_year_id));
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    values.push(assignmentId);
    const updated = await query(
      `UPDATE transport_assignments
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
    const hasTaDeletedAt = await hasColumn('transport_assignments', 'deleted_at');
    const assignmentId = Number(req.params.id);
    if (Number.isNaN(assignmentId)) {
      return errorResponse(res, 400, 'Invalid assignment ID');
    }

    const deleted = hasTaDeletedAt
      ? await query(
          `UPDATE transport_assignments
           SET deleted_at = NOW(), is_active = false
           WHERE id = $1 AND deleted_at IS NULL
           RETURNING id`,
          [assignmentId]
        )
      : await query(
          `UPDATE transport_assignments
           SET is_active = false
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

