const { hasColumn } = require('./schemaInspector');

/**
 * Resolve vehicle_route_assignments.id for transport_allocations.
 * Accepts vehicle_route_assignment_id directly, or legacy route_id + vehicle_id (+ academic year).
 */
async function resolveVehicleRouteAssignmentForAllocation(client, body, ctx = {}) {
  const { academicYearId, hasAcademicYearId, startDate } = ctx;
  const vraRaw = body?.vehicle_route_assignment_id;
  const routeIdRaw = body?.route_id;
  const vehicleIdRaw = body?.vehicle_id;

  if (vraRaw != null && vraRaw !== '' && !Number.isNaN(Number(vraRaw))) {
    const vraId = Number(vraRaw);
    const row = await fetchVehicleRouteAssignmentRow(client, vraId, { startDate, academicYearId, hasAcademicYearId });
    return {
      assignmentId: vraId,
      routeId: row.route_id,
      vehicleId: row.vehicle_id,
    };
  }

  const routeId = Number(routeIdRaw);
  const vehicleId = Number(vehicleIdRaw);
  if (!Number.isFinite(routeId) || routeId <= 0) {
    throw new Error('VEHICLE_ROUTE_ASSIGNMENT_REQUIRED');
  }

  const hasDeletedAt = await hasColumn('vehicle_route_assignments', 'deleted_at');
  const delClause = hasDeletedAt ? ' AND deleted_at IS NULL' : '';
  const params = [routeId];
  let sql = `
    SELECT id, route_id, vehicle_id, academic_year_id
    FROM vehicle_route_assignments
    WHERE route_id = $1${delClause}
  `;
  if (Number.isFinite(vehicleId) && vehicleId > 0) {
    params.push(vehicleId);
    sql += ` AND vehicle_id = $${params.length}`;
  }
  if (hasAcademicYearId && academicYearId != null) {
    params.push(academicYearId);
    sql += ` AND academic_year_id = $${params.length}`;
  }
  sql += ' ORDER BY id DESC LIMIT 1';

  const res = await client.query(sql, params);
  if (!res.rows.length) {
    throw new Error('VEHICLE_ROUTE_ASSIGNMENT_NOT_FOUND');
  }

  const row = res.rows[0];
  if (startDate) {
    const rangeCheck = await client.query(
      `SELECT ($2::date <@ valid_period) AS ok
       FROM vehicle_route_assignments
       WHERE id = $1${delClause}`,
      [row.id, startDate]
    );
    if (!rangeCheck.rows[0]?.ok) {
      throw new Error('VEHICLE_ROUTE_ASSIGNMENT_OUTSIDE_VALID_PERIOD');
    }
  }

  return {
    assignmentId: Number(row.id),
    routeId: Number(row.route_id),
    vehicleId: Number(row.vehicle_id),
  };
}

async function fetchVehicleRouteAssignmentRow(client, vraId, ctx = {}) {
  const { startDate, academicYearId, hasAcademicYearId } = ctx;
  const hasDeletedAt = await hasColumn('vehicle_route_assignments', 'deleted_at');
  const delClause = hasDeletedAt ? ' AND deleted_at IS NULL' : '';
  const res = await client.query(
    `SELECT id, route_id, vehicle_id, academic_year_id
     FROM vehicle_route_assignments
     WHERE id = $1${delClause}`,
    [vraId]
  );
  if (!res.rows.length) {
    throw new Error('VEHICLE_ROUTE_ASSIGNMENT_NOT_FOUND');
  }
  const row = res.rows[0];
  if (hasAcademicYearId && academicYearId != null && Number(row.academic_year_id) !== Number(academicYearId)) {
    throw new Error('VEHICLE_ROUTE_ASSIGNMENT_YEAR_MISMATCH');
  }
  if (startDate) {
    const rangeCheck = await client.query(
      `SELECT ($2::date <@ valid_period) AS ok
       FROM vehicle_route_assignments
       WHERE id = $1${delClause}`,
      [vraId, startDate]
    );
    if (!rangeCheck.rows[0]?.ok) {
      throw new Error('VEHICLE_ROUTE_ASSIGNMENT_OUTSIDE_VALID_PERIOD');
    }
  }
  return row;
}

/** SQL fragment: join allocations to route/vehicle via vehicle_route_assignments */
async function buildTransportAllocationVraJoin(vehicleTable = 'transport_vehicles') {
  const hasVraDel = await hasColumn('vehicle_route_assignments', 'deleted_at');
  const hasVehDel = await hasColumn(vehicleTable, 'deleted_at');
  const vraDel = hasVraDel ? ' AND vra.deleted_at IS NULL' : '';
  const vDel = hasVehDel ? ' AND v.deleted_at IS NULL' : '';
  return `
    INNER JOIN vehicle_route_assignments vra ON vra.id = ta.vehicle_route_assignment_id${vraDel}
    INNER JOIN routes r ON r.id = vra.route_id
    INNER JOIN ${vehicleTable} v ON v.id = vra.vehicle_id${vDel}
  `;
}

module.exports = {
  resolveVehicleRouteAssignmentForAllocation,
  fetchVehicleRouteAssignmentRow,
  buildTransportAllocationVraJoin,
};
