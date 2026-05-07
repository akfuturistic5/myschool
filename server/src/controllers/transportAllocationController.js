const { query, executeTransaction } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { resolveAcademicYearId, toPositiveInt } = require('../utils/academicYear');
const { hasColumn, hasTable } = require('../utils/schemaInspector');

function normalizeStatus(status) {
  if (typeof status !== 'string') return 'Active';
  return status.trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return Boolean(value);
}

function parseIsoDateOnly(value, { fieldName, allowNull = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (allowNull) return null;
    throw new Error(`${fieldName || 'DATE'}_REQUIRED`);
  }
  const rawValue = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim();
  const isoMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!isoMatch) {
    throw new Error(`${fieldName || 'DATE'}_INVALID`);
  }
  const stringValue = isoMatch[1];
  const parsed = new Date(`${stringValue}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName || 'DATE'}_INVALID`);
  }
  return stringValue;
}

async function resolveAllocationSubjectId(client, rawId, userType) {
  if (!Number.isFinite(Number(rawId))) {
    throw new Error('INVALID_NUMERIC_INPUT');
  }
  const parsedId = Number(rawId);
  if (userType === 'student') {
    const studentResult = await client.query(
      `SELECT id
       FROM students
       WHERE COALESCE(is_active, true) = true
         AND (id = $1 OR user_id = $1)
       ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [parsedId]
    );
    if (!studentResult.rows.length) throw new Error('INVALID_STUDENT_USER');
    return Number(studentResult.rows[0].id);
  }
  if (userType === 'staff') {
    const staffResult = await client.query(
      `SELECT id
       FROM staff
       WHERE COALESCE(is_active, true) = true
         AND (id = $1 OR user_id = $1)
       ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [parsedId]
    );
    if (!staffResult.rows.length) throw new Error('INVALID_STAFF_USER');
    return Number(staffResult.rows[0].id);
  }
  throw new Error('INVALID_USER_TYPE');
}

async function resolveUserTypeAndSubjectId(client, payload) {
  const normalizedUserType = String(payload.user_type || '').toLowerCase();
  if (!['student', 'staff'].includes(normalizedUserType)) {
    throw new Error('INVALID_USER_TYPE');
  }
  const rawSubjectId =
    normalizedUserType === 'student'
      ? (payload.student_id ?? payload.user_id)
      : (payload.staff_id ?? payload.user_id);
  if (rawSubjectId == null || rawSubjectId === '') {
    throw new Error('SUBJECT_ID_REQUIRED');
  }
  const subjectId = await resolveAllocationSubjectId(client, rawSubjectId, normalizedUserType);
  return { userType: normalizedUserType, subjectId };
}

async function validateRoutePickupMapping(client, routeId, pickupPointId) {
  const hasRouteStops = await hasTable('route_stops');
  if (hasRouteStops) {
    const mappingResult = await client.query(
      `SELECT rs.id
       FROM route_stops rs
       WHERE rs.route_id = $1 AND rs.pickup_point_id = $2
       LIMIT 1`,
      [routeId, pickupPointId]
    );
    if (!mappingResult.rows.length) {
      throw new Error('PICKUP_NOT_IN_ROUTE');
    }
    return;
  }

  const hasPickupRouteId = await hasColumn('pickup_points', 'route_id');
  if (hasPickupRouteId) {
    const mappingResult = await client.query(
      `SELECT id
       FROM pickup_points
       WHERE id = $1 AND route_id = $2
       LIMIT 1`,
      [pickupPointId, routeId]
    );
    if (!mappingResult.rows.length) {
      throw new Error('PICKUP_NOT_IN_ROUTE');
    }
  }
}

function computeEndDateFromDuration(startDate, durationDays) {
  if (!durationDays || durationDays <= 0) return null;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + Number(durationDays));
  return end.toISOString().slice(0, 10);
}

async function resolveAssignedFee(client, pickupPointId, assignedFeeId, isFree, userType, startDate) {
  if (isFree) return { feeId: null, feeAmount: 0, computedEndDate: null };
  if (!assignedFeeId) throw new Error('FEE_PLAN_REQUIRED');

  const hasDurationDays = await hasColumn('transport_fee_master', 'duration_days');
  const hasStatus = await hasColumn('transport_fee_master', 'status');
  const hasStudentAmount = await hasColumn('transport_fee_master', 'student_amount');
  const hasStaffAmount = await hasColumn('transport_fee_master', 'staff_amount');

  const feeResult = await client.query(
    `SELECT id,
            ${hasStudentAmount ? 'student_amount' : 'NULL::numeric AS student_amount'},
            ${hasStaffAmount ? 'staff_amount' : 'NULL::numeric AS staff_amount'},
            ${hasDurationDays ? 'duration_days' : 'NULL::int AS duration_days'},
            ${hasStatus ? 'status' : "'Active'::text AS status"},
            pickup_point_id
     FROM transport_fee_master
     WHERE id = $1`,
    [assignedFeeId]
  );
  if (!feeResult.rows.length) throw new Error('FEE_PLAN_NOT_FOUND');

  const feePlan = feeResult.rows[0];
  if (Number(feePlan.pickup_point_id) !== Number(pickupPointId)) {
    throw new Error('FEE_PLAN_PICKUP_MISMATCH');
  }
  if (String(feePlan.status || '').toLowerCase() !== 'active') {
    throw new Error('FEE_PLAN_INACTIVE');
  }

  const feeAmount =
    userType === 'staff'
      ? Number(feePlan.staff_amount ?? feePlan.student_amount ?? 0)
      : Number(feePlan.student_amount ?? 0);

  return {
    feeId: Number(feePlan.id),
    feeAmount,
    computedEndDate: computeEndDateFromDuration(startDate, Number(feePlan.duration_days || 0)),
  };
}

async function enforceVehicleCapacity(client, vehicleId, startDate, endDate, excludeAllocationId = null) {
  const hasTransportVehiclesTable = await hasTable('transport_vehicles');
  const vehicleTable = hasTransportVehiclesTable ? 'transport_vehicles' : 'vehicles';

  const vehicleResult = await client.query(
    `SELECT id, seating_capacity
     FROM ${vehicleTable}
     WHERE id = $1 AND deleted_at IS NULL`,
    [vehicleId]
  );
  if (!vehicleResult.rows.length) throw new Error('VEHICLE_NOT_FOUND');

  const capacity = Number(vehicleResult.rows[0].seating_capacity || 0);
  if (capacity <= 0) throw new Error('INVALID_VEHICLE_CAPACITY');

  const params = [vehicleId, startDate || null, endDate || null];
  let excludeSql = '';
  if (excludeAllocationId) {
    params.push(excludeAllocationId);
    excludeSql = ` AND ta.id <> $${params.length}`;
  }

  const allocationResult = await client.query(
    `SELECT COUNT(*) AS occupied
     FROM transport_allocations ta
     WHERE ta.vehicle_id = $1
       AND ta.status = 'Active'
       AND (
         COALESCE(ta.end_date, 'infinity'::date) >= COALESCE($2::date, CURRENT_DATE)
         AND ta.start_date <= COALESCE($3::date, 'infinity'::date)
       )
       ${excludeSql}`,
    params
  );

  const occupied = Number(allocationResult.rows[0]?.occupied || 0);
  const availableSeats = Math.max(capacity - occupied, 0);
  if (occupied >= capacity) {
    const capacityError = new Error('VEHICLE_CAPACITY_EXCEEDED');
    capacityError.availableSeats = availableSeats;
    capacityError.totalCapacity = capacity;
    capacityError.occupiedSeats = occupied;
    throw capacityError;
  }
}

async function getVehicleSeatAvailability(client, vehicleId, startDate, endDate, excludeAllocationId = null) {
  const hasTransportVehiclesTable = await hasTable('transport_vehicles');
  const vehicleTable = hasTransportVehiclesTable ? 'transport_vehicles' : 'vehicles';

  const vehicleResult = await client.query(
    `SELECT id, seating_capacity
     FROM ${vehicleTable}
     WHERE id = $1 AND deleted_at IS NULL`,
    [vehicleId]
  );
  if (!vehicleResult.rows.length) throw new Error('VEHICLE_NOT_FOUND');

  const capacity = Number(vehicleResult.rows[0].seating_capacity || 0);
  if (capacity <= 0) throw new Error('INVALID_VEHICLE_CAPACITY');

  const params = [vehicleId, startDate || null, endDate || null];
  let excludeSql = '';
  if (excludeAllocationId) {
    params.push(excludeAllocationId);
    excludeSql = ` AND ta.id <> $${params.length}`;
  }

  const allocationResult = await client.query(
    `SELECT COUNT(*) AS occupied
     FROM transport_allocations ta
     WHERE ta.vehicle_id = $1
       AND ta.status = 'Active'
       AND (
         COALESCE(ta.end_date, 'infinity'::date) >= COALESCE($2::date, CURRENT_DATE)
         AND ta.start_date <= COALESCE($3::date, 'infinity'::date)
       )
       ${excludeSql}`,
    params
  );

  const occupied = Number(allocationResult.rows[0]?.occupied || 0);
  return {
    capacity,
    occupied,
    available: Math.max(capacity - occupied, 0),
  };
}

const getAllTransportAllocations = async (req, res) => {
  try {
    const hasAcademicYearId = await hasColumn('transport_allocations', 'academic_year_id');
    const hasUserType = await hasColumn('transport_allocations', 'user_type');
    const hasUserId = await hasColumn('transport_allocations', 'user_id');
    const hasStudentId = await hasColumn('transport_allocations', 'student_id');
    const hasStaffId = await hasColumn('transport_allocations', 'staff_id');
    const hasFeeMasterId = await hasColumn('transport_allocations', 'fee_master_id');
    const feeRefColumn = hasFeeMasterId ? 'fee_master_id' : 'assigned_fee_id';
    const hasAssignedAmount = await hasColumn('transport_allocations', 'assigned_amount');
    const amountColumn = hasAssignedAmount ? 'assigned_amount' : 'assigned_fee_amount';
    const hasTransportVehiclesTable = await hasTable('transport_vehicles');
    const vehicleTable = hasTransportVehiclesTable ? 'transport_vehicles' : 'vehicles';
    const {
      page = 1,
      limit = 10,
      user_type = 'all',
      status = 'all',
      search = '',
      vehicle_id,
      academic_year_id,
      sortField = 'id',
      sortOrder = 'DESC',
    } = req.query;
    const scopedAcademicYearId = hasAcademicYearId ? await resolveAcademicYearId(academic_year_id) : null;

    const offset = (Number(page) - 1) * Number(limit);
    const allowedSort = ['id', ...(hasUserType ? ['user_type'] : []), 'start_date', 'end_date', 'status', 'created_at'];
    const orderBy = allowedSort.includes(sortField) ? `ta.${sortField}` : 'ta.id';
    const direction = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const params = [];
    let whereClause = 'WHERE 1=1';

    if (user_type !== 'all' && hasUserType) {
      params.push(user_type);
      whereClause += ` AND ta.user_type = $${params.length}`;
    }
    if (status !== 'all') {
      params.push(normalizeStatus(status));
      whereClause += ` AND ta.status = $${params.length}`;
    }
    if (vehicle_id && vehicle_id !== 'all') {
      params.push(Number(vehicle_id));
      whereClause += ` AND ta.vehicle_id = $${params.length}`;
    }
    if (hasAcademicYearId && scopedAcademicYearId) {
      params.push(scopedAcademicYearId);
      whereClause += ` AND ta.academic_year_id = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (
        r.route_name ILIKE $${params.length}
        OR pp.point_name ILIKE $${params.length}
        OR su.full_name ILIKE $${params.length}
        OR tu.full_name ILIKE $${params.length}
        OR CAST(COALESCE(${hasUserId ? 'ta.user_id' : 'ta.student_id'}, ta.staff_id) AS TEXT) ILIKE $${params.length}
      )`;
    }

    const userTypeExpr = hasUserType
      ? 'ta.user_type'
      : `CASE WHEN ta.student_id IS NOT NULL THEN 'student' ELSE 'staff' END`;
    const studentIdExpr = hasStudentId
      ? 'ta.student_id'
      : `(CASE WHEN ${userTypeExpr} = 'student' THEN ta.user_id ELSE NULL END)`;
    const staffIdExpr = hasStaffId
      ? 'ta.staff_id'
      : `(CASE WHEN ${userTypeExpr} = 'staff' THEN ta.user_id ELSE NULL END)`;

    const countResult = await query(
      `SELECT COUNT(*)
       FROM transport_allocations ta
       JOIN routes r ON r.id = ta.route_id
       JOIN pickup_points pp ON pp.id = ta.pickup_point_id
       LEFT JOIN LATERAL (
         SELECT TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS full_name
         FROM students stu
         LEFT JOIN users u ON u.id = stu.user_id
         WHERE ${userTypeExpr} = 'student' AND (stu.id = ${studentIdExpr} OR stu.user_id = ${studentIdExpr})
         ORDER BY CASE WHEN stu.id = ${studentIdExpr} THEN 0 ELSE 1 END
         LIMIT 1
       ) su ON true
       LEFT JOIN LATERAL (
         SELECT TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS full_name
         FROM staff stf
         LEFT JOIN users u ON u.id = stf.user_id
         WHERE ${userTypeExpr} = 'staff' AND (stf.id = ${staffIdExpr} OR stf.user_id = ${staffIdExpr})
         ORDER BY CASE WHEN stf.id = ${staffIdExpr} THEN 0 ELSE 1 END
         LIMIT 1
       ) tu ON true
       ${whereClause}`,
      params
    );
    const totalCount = Number(countResult.rows[0]?.count || 0);

    const rowsResult = await query(
      `SELECT
         ta.*,
         r.route_name,
         pp.point_name,
         v.vehicle_number,
         tfm.plan_name AS assigned_fee_plan_name,
         tfm.duration_days AS assigned_fee_duration_days,
         ${studentIdExpr} AS student_id,
         ${staffIdExpr} AS staff_id,
         COALESCE(su.full_name, tu.full_name, CAST(COALESCE(${hasUserId ? 'ta.user_id' : 'ta.student_id'}, ta.staff_id) AS TEXT)) AS user_name,
         ${userTypeExpr} AS user_type
       FROM transport_allocations ta
       JOIN routes r ON r.id = ta.route_id
       JOIN pickup_points pp ON pp.id = ta.pickup_point_id
       JOIN ${vehicleTable} v ON v.id = ta.vehicle_id
       LEFT JOIN transport_fee_master tfm ON tfm.id = ta.${feeRefColumn}
       LEFT JOIN LATERAL (
         SELECT TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS full_name
         FROM students stu
         LEFT JOIN users u ON u.id = stu.user_id
         WHERE ${userTypeExpr} = 'student' AND (stu.id = ${studentIdExpr} OR stu.user_id = ${studentIdExpr})
         ORDER BY CASE WHEN stu.id = ${studentIdExpr} THEN 0 ELSE 1 END
         LIMIT 1
       ) su ON true
       LEFT JOIN LATERAL (
         SELECT TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS full_name
         FROM staff stf
         LEFT JOIN users u ON u.id = stf.user_id
         WHERE ${userTypeExpr} = 'staff' AND (stf.id = ${staffIdExpr} OR stf.user_id = ${staffIdExpr})
         ORDER BY CASE WHEN stf.id = ${staffIdExpr} THEN 0 ELSE 1 END
         LIMIT 1
       ) tu ON true
       ${whereClause}
       ORDER BY ${orderBy} ${direction}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, Number(limit), offset]
    );

    return success(res, 200, 'Transport allocations fetched successfully', rowsResult.rows, {
      totalCount,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  } catch (err) {
    console.error('Error fetching transport allocations:', err);
    return errorResponse(res, 500, 'Failed to fetch transport allocations');
  }
};

const createTransportAllocation = async (req, res) => {
  try {
    const hasAcademicYearId = await hasColumn('transport_allocations', 'academic_year_id');
    const hasUserType = await hasColumn('transport_allocations', 'user_type');
    const hasUserId = await hasColumn('transport_allocations', 'user_id');
    const hasStudentId = await hasColumn('transport_allocations', 'student_id');
    const hasStaffId = await hasColumn('transport_allocations', 'staff_id');
    const hasFeeMasterId = await hasColumn('transport_allocations', 'fee_master_id');
    const feeRefColumn = hasFeeMasterId ? 'fee_master_id' : 'assigned_fee_id';
    const hasAssignedAmount = await hasColumn('transport_allocations', 'assigned_amount');
    const amountColumn = hasAssignedAmount ? 'assigned_amount' : 'assigned_fee_amount';
    const {
      user_id,
      student_id,
      staff_id,
      user_type,
      route_id,
      pickup_point_id,
      vehicle_id,
      assigned_fee_id,
      is_free = false,
      start_date,
      end_date = null,
      status,
      academic_year_id,
    } = req.body;

    const parsedRouteId = Number(route_id);
    const parsedPickupPointId = Number(pickup_point_id);
    const parsedVehicleId = Number(vehicle_id);
    const parsedAssignedFeeId = assigned_fee_id != null && assigned_fee_id !== '' ? Number(assigned_fee_id) : null;
    const normalizedUserType = String(user_type || '').toLowerCase();

    if ((!user_id && !student_id && !staff_id) || !user_type || !route_id || !pickup_point_id || !vehicle_id) {
      return errorResponse(res, 400, 'student_id/staff_id, user_type, route_id, pickup_point_id and vehicle_id are required');
    }
    if (
      !Number.isFinite(parsedRouteId) ||
      !Number.isFinite(parsedPickupPointId) ||
      !Number.isFinite(parsedVehicleId)
    ) {
      return errorResponse(res, 400, 'student_id/staff_id, route_id, pickup_point_id and vehicle_id must be valid numbers');
    }
    if (!['student', 'staff'].includes(normalizedUserType)) {
      return errorResponse(res, 400, 'user_type must be student or staff');
    }

    const result = await executeTransaction(async (client) => {
      const startDate = start_date
        ? parseIsoDateOnly(start_date, { fieldName: 'START_DATE', allowNull: false })
        : new Date().toISOString().slice(0, 10);
      const normalizedIsFree = parseBoolean(is_free, false);
      const scopedAcademicYearId = hasAcademicYearId
        ? await resolveAcademicYearId(academic_year_id || req.query?.academic_year_id)
        : null;

      const { subjectId } = await resolveUserTypeAndSubjectId(client, {
        user_id,
        student_id,
        staff_id,
        user_type: normalizedUserType,
      });
      await validateRoutePickupMapping(client, parsedRouteId, parsedPickupPointId);
      const effectiveEndDateInput = parseIsoDateOnly(end_date, { fieldName: 'END_DATE', allowNull: true });
      if (effectiveEndDateInput && effectiveEndDateInput < startDate) {
        throw new Error('INVALID_DATE_RANGE');
      }
      await enforceVehicleCapacity(client, parsedVehicleId, startDate, effectiveEndDateInput);

      const fee = await resolveAssignedFee(
        client,
        parsedPickupPointId,
        parsedAssignedFeeId,
        normalizedIsFree,
        normalizedUserType,
        startDate
      );
      const finalEndDate = fee.computedEndDate || effectiveEndDateInput;

      const subjectFilter = hasUserType && hasUserId
        ? `user_id = $2 AND user_type = $3`
        : normalizedUserType === 'student'
          ? 'student_id = $2'
          : 'staff_id = $2';
      const subjectValues = hasUserType && hasUserId ? [startDate, subjectId, normalizedUserType] : [startDate, subjectId];
      await client.query(
        `UPDATE transport_allocations
         SET end_date = GREATEST($1::date, start_date), status = 'Inactive'
         WHERE ${subjectFilter} AND end_date IS NULL AND status = 'Active'`,
        subjectValues
      );

      const insertColumns = [
        ...(hasUserId ? ['user_id'] : []),
        ...(hasUserType ? ['user_type'] : []),
        ...(hasStudentId ? ['student_id'] : []),
        ...(hasStaffId ? ['staff_id'] : []),
        'route_id',
        'pickup_point_id',
        'vehicle_id',
        feeRefColumn,
        amountColumn,
        'is_free',
        'start_date',
        'end_date',
        'status',
        ...(hasAcademicYearId ? ['academic_year_id'] : []),
      ];
      const insertValues = [
        ...(hasUserId ? [subjectId] : []),
        ...(hasUserType ? [normalizedUserType] : []),
        ...(hasStudentId ? [normalizedUserType === 'student' ? subjectId : null] : []),
        ...(hasStaffId ? [normalizedUserType === 'staff' ? subjectId : null] : []),
        parsedRouteId,
        parsedPickupPointId,
        parsedVehicleId,
        fee.feeId,
        fee.feeAmount,
        normalizedIsFree,
        startDate,
        finalEndDate,
        normalizeStatus(status),
        ...(hasAcademicYearId ? [scopedAcademicYearId] : []),
      ];
      const placeholders = insertValues.map((_, idx) => `$${idx + 1}`).join(',');
      const insertResult = await client.query(
        `INSERT INTO transport_allocations (${insertColumns.join(',')})
         VALUES (${placeholders})
         RETURNING *`,
        insertValues
      );

      return insertResult.rows[0];
    });

    return success(res, 201, 'Transport allocation created successfully', result);
  } catch (err) {
    console.error('Error creating transport allocation:', err);
    if (err.message === 'SUBJECT_ID_REQUIRED') return errorResponse(res, 400, 'student_id is required for student allocations and staff_id is required for staff allocations');
    if (err.message === 'INVALID_STUDENT_USER') return errorResponse(res, 400, 'Selected user is not a valid student');
    if (err.message === 'INVALID_STAFF_USER') return errorResponse(res, 400, 'Selected user is not a valid staff member');
    if (err.message === 'INVALID_USER_TYPE') return errorResponse(res, 400, 'user_type must be student or staff');
    if (err.message === 'PICKUP_NOT_IN_ROUTE') return errorResponse(res, 400, 'Selected pickup point is not mapped to selected route');
    if (err.message === 'FEE_PLAN_REQUIRED') return errorResponse(res, 400, 'assigned_fee_id is required unless is_free is true');
    if (err.message === 'FEE_PLAN_NOT_FOUND') return errorResponse(res, 400, 'Selected fee plan does not exist');
    if (err.message === 'FEE_PLAN_PICKUP_MISMATCH') return errorResponse(res, 400, 'Selected fee plan is not valid for the pickup point');
    if (err.message === 'FEE_PLAN_INACTIVE') return errorResponse(res, 400, 'Selected fee plan is inactive');
    if (err.message === 'START_DATE_INVALID') return errorResponse(res, 400, 'start_date must be in YYYY-MM-DD format');
    if (err.message === 'END_DATE_INVALID') return errorResponse(res, 400, 'end_date must be in YYYY-MM-DD format');
    if (err.message === 'INVALID_DATE_RANGE') return errorResponse(res, 400, 'end_date cannot be before start_date');
    if (err.message === 'VEHICLE_NOT_FOUND') return errorResponse(res, 400, 'Selected vehicle does not exist');
    if (err.message === 'INVALID_VEHICLE_CAPACITY') return errorResponse(res, 400, 'Selected vehicle has invalid seat capacity');
    if (err.message === 'VEHICLE_CAPACITY_EXCEEDED') {
      const available = Number.isFinite(err.availableSeats) ? err.availableSeats : 0;
      const total = Number.isFinite(err.totalCapacity) ? err.totalCapacity : null;
      const occupied = Number.isFinite(err.occupiedSeats) ? err.occupiedSeats : null;
      const details = total != null && occupied != null
        ? ` (occupied ${occupied}/${total})`
        : '';
      return errorResponse(res, 400, `No seat available in selected vehicle. Available seats: ${available}${details}`);
    }
    if (err.code === '23503') return errorResponse(res, 400, 'Invalid related record selected (user/route/pickup/vehicle/fee)');
    if (err.code === '23514') return errorResponse(res, 400, 'Invalid allocation values or date range');
    return errorResponse(res, 500, 'Failed to create transport allocation');
  }
};

const getTransportSeatAvailability = async (req, res) => {
  try {
    const vehicleId = Number(req.query.vehicle_id);
    const startDate = req.query.start_date || new Date().toISOString().slice(0, 10);
    const endDate = req.query.end_date || null;
    const excludeAllocationId = req.query.exclude_allocation_id ? Number(req.query.exclude_allocation_id) : null;

    if (!Number.isFinite(vehicleId)) {
      return errorResponse(res, 400, 'vehicle_id is required');
    }

    const seatInfo = await executeTransaction(async (client) =>
      getVehicleSeatAvailability(client, vehicleId, startDate, endDate, excludeAllocationId)
    );

    return success(res, 200, 'Seat availability fetched successfully', seatInfo);
  } catch (err) {
    if (err.message === 'VEHICLE_NOT_FOUND') return errorResponse(res, 400, 'Selected vehicle does not exist');
    if (err.message === 'INVALID_VEHICLE_CAPACITY') return errorResponse(res, 400, 'Selected vehicle has invalid seat capacity');
    return errorResponse(res, 500, 'Failed to fetch seat availability');
  }
};

const createBulkTransportAllocations = async (req, res) => {
  try {
    const hasAcademicYearId = await hasColumn('transport_allocations', 'academic_year_id');
    const hasUserType = await hasColumn('transport_allocations', 'user_type');
    const hasUserId = await hasColumn('transport_allocations', 'user_id');
    const hasStudentId = await hasColumn('transport_allocations', 'student_id');
    const hasStaffId = await hasColumn('transport_allocations', 'staff_id');
    const hasFeeMasterId = await hasColumn('transport_allocations', 'fee_master_id');
    const feeRefColumn = hasFeeMasterId ? 'fee_master_id' : 'assigned_fee_id';
    const hasAssignedAmount = await hasColumn('transport_allocations', 'assigned_amount');
    const amountColumn = hasAssignedAmount ? 'assigned_amount' : 'assigned_fee_amount';
    const {
      user_type,
      user_ids = [],
      route_id,
      pickup_point_id,
      vehicle_id,
      assigned_fee_id,
      is_free = false,
      start_date,
      end_date = null,
      status,
      academic_year_id,
    } = req.body || {};

    const parsedRouteId = Number(route_id);
    const parsedPickupPointId = Number(pickup_point_id);
    const parsedVehicleId = Number(vehicle_id);
    const parsedAssignedFeeId = assigned_fee_id != null && assigned_fee_id !== '' ? Number(assigned_fee_id) : null;
    const normalizedUserType = String(user_type || '').toLowerCase();

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return errorResponse(res, 400, 'Please select at least one user');
    }
    if (!Number.isFinite(parsedRouteId) || !Number.isFinite(parsedPickupPointId) || !Number.isFinite(parsedVehicleId)) {
      return errorResponse(res, 400, 'route_id, pickup_point_id and vehicle_id must be valid numbers');
    }
    if (!['student', 'staff'].includes(normalizedUserType)) {
      return errorResponse(res, 400, 'user_type must be student or staff');
    }

    const result = await executeTransaction(async (client) => {
      const startDate = start_date
        ? parseIsoDateOnly(start_date, { fieldName: 'START_DATE', allowNull: false })
        : new Date().toISOString().slice(0, 10);
      const normalizedIsFree = parseBoolean(is_free, false);
      const scopedAcademicYearId = hasAcademicYearId
        ? await resolveAcademicYearId(academic_year_id || req.query?.academic_year_id)
        : null;

      await validateRoutePickupMapping(client, parsedRouteId, parsedPickupPointId);
      const fee = await resolveAssignedFee(
        client,
        parsedPickupPointId,
        parsedAssignedFeeId,
        normalizedIsFree,
        normalizedUserType,
        startDate
      );
      const requestedEndDate = parseIsoDateOnly(end_date, { fieldName: 'END_DATE', allowNull: true });
      if (requestedEndDate && requestedEndDate < startDate) {
        throw new Error('INVALID_DATE_RANGE');
      }
      const finalEndDate = fee.computedEndDate || requestedEndDate;

      const resolvedIds = [];
      for (const rawId of user_ids) {
        const subjectId = await resolveAllocationSubjectId(client, rawId, normalizedUserType);
        if (!resolvedIds.includes(subjectId)) {
          resolvedIds.push(subjectId);
        }
      }

      // Close existing active allocations for selected users first; transaction rollback protects consistency.
      if (hasUserType && hasUserId) {
        await client.query(
          `UPDATE transport_allocations
           SET end_date = GREATEST($1::date, start_date), status = 'Inactive'
           WHERE user_type = $2
             AND user_id = ANY($3::int[])
             AND end_date IS NULL
             AND status = 'Active'`,
          [startDate, normalizedUserType, resolvedIds]
        );
      } else {
        const targetCol = normalizedUserType === 'student' ? 'student_id' : 'staff_id';
        await client.query(
          `UPDATE transport_allocations
           SET end_date = GREATEST($1::date, start_date), status = 'Inactive'
           WHERE ${targetCol} = ANY($2::int[])
             AND end_date IS NULL
             AND status = 'Active'`,
          [startDate, resolvedIds]
        );
      }

      const seatInfo = await getVehicleSeatAvailability(client, parsedVehicleId, startDate, finalEndDate);
      if (resolvedIds.length > seatInfo.available) {
        const bulkCapacityError = new Error('BULK_VEHICLE_CAPACITY_EXCEEDED');
        bulkCapacityError.availableSeats = seatInfo.available;
        throw bulkCapacityError;
      }

      const insertedRows = [];
      for (const subjectId of resolvedIds) {
        const insertColumns = [
          ...(hasUserId ? ['user_id'] : []),
          ...(hasUserType ? ['user_type'] : []),
          ...(hasStudentId ? ['student_id'] : []),
          ...(hasStaffId ? ['staff_id'] : []),
          'route_id',
          'pickup_point_id',
          'vehicle_id',
          feeRefColumn,
          amountColumn,
          'is_free',
          'start_date',
          'end_date',
          'status',
          ...(hasAcademicYearId ? ['academic_year_id'] : []),
        ];
        const insertValues = [
          ...(hasUserId ? [subjectId] : []),
          ...(hasUserType ? [normalizedUserType] : []),
          ...(hasStudentId ? [normalizedUserType === 'student' ? subjectId : null] : []),
          ...(hasStaffId ? [normalizedUserType === 'staff' ? subjectId : null] : []),
          parsedRouteId,
          parsedPickupPointId,
          parsedVehicleId,
          fee.feeId,
          fee.feeAmount,
          normalizedIsFree,
          startDate,
          finalEndDate,
          normalizeStatus(status),
          ...(hasAcademicYearId ? [scopedAcademicYearId] : []),
        ];
        const placeholders = insertValues.map((_, idx) => `$${idx + 1}`).join(',');
        const insertResult = await client.query(
          `INSERT INTO transport_allocations (${insertColumns.join(',')})
           VALUES (${placeholders})
           RETURNING *`,
          insertValues
        );
        insertedRows.push(insertResult.rows[0]);
      }

      return {
        createdCount: insertedRows.length,
        rows: insertedRows,
      };
    });

    return success(res, 201, 'Bulk transport allocations created successfully', result);
  } catch (err) {
    console.error('Error creating bulk transport allocations:', err);
    if (err.message === 'INVALID_STUDENT_USER') return errorResponse(res, 400, 'One or more selected users are not valid students');
    if (err.message === 'INVALID_STAFF_USER') return errorResponse(res, 400, 'One or more selected users are not valid staff members');
    if (err.message === 'INVALID_USER_TYPE') return errorResponse(res, 400, 'user_type must be student or staff');
    if (err.message === 'PICKUP_NOT_IN_ROUTE') return errorResponse(res, 400, 'Selected pickup point is not mapped to selected route');
    if (err.message === 'FEE_PLAN_REQUIRED') return errorResponse(res, 400, 'assigned_fee_id is required unless is_free is true');
    if (err.message === 'FEE_PLAN_NOT_FOUND') return errorResponse(res, 400, 'Selected fee plan does not exist');
    if (err.message === 'FEE_PLAN_PICKUP_MISMATCH') return errorResponse(res, 400, 'Selected fee plan is not valid for the pickup point');
    if (err.message === 'FEE_PLAN_INACTIVE') return errorResponse(res, 400, 'Selected fee plan is inactive');
    if (err.message === 'START_DATE_INVALID') return errorResponse(res, 400, 'start_date must be in YYYY-MM-DD format');
    if (err.message === 'END_DATE_INVALID') return errorResponse(res, 400, 'end_date must be in YYYY-MM-DD format');
    if (err.message === 'INVALID_DATE_RANGE') return errorResponse(res, 400, 'end_date cannot be before start_date');
    if (err.message === 'VEHICLE_NOT_FOUND') return errorResponse(res, 400, 'Selected vehicle does not exist');
    if (err.message === 'INVALID_VEHICLE_CAPACITY') return errorResponse(res, 400, 'Selected vehicle has invalid seat capacity');
    if (err.message === 'BULK_VEHICLE_CAPACITY_EXCEEDED') {
      return errorResponse(res, 400, `Seat not available for all selected users. Available seats: ${Number(err.availableSeats) || 0}`);
    }
    return errorResponse(res, 500, 'Failed to create bulk transport allocations');
  }
};

const updateTransportAllocation = async (req, res) => {
  try {
    const hasAcademicYearId = await hasColumn('transport_allocations', 'academic_year_id');
    const hasUserType = await hasColumn('transport_allocations', 'user_type');
    const hasUserId = await hasColumn('transport_allocations', 'user_id');
    const hasStudentId = await hasColumn('transport_allocations', 'student_id');
    const hasStaffId = await hasColumn('transport_allocations', 'staff_id');
    const hasFeeMasterId = await hasColumn('transport_allocations', 'fee_master_id');
    const feeRefColumn = hasFeeMasterId ? 'fee_master_id' : 'assigned_fee_id';
    const hasAssignedAmount = await hasColumn('transport_allocations', 'assigned_amount');
    const amountColumn = hasAssignedAmount ? 'assigned_amount' : 'assigned_fee_amount';
    const allocationId = Number(req.params.id);
    if (Number.isNaN(allocationId)) {
      return errorResponse(res, 400, 'Invalid allocation ID');
    }

    const payload = req.body || {};

    const result = await executeTransaction(async (client) => {
      const currentResult = await client.query(
        'SELECT * FROM transport_allocations WHERE id = $1',
        [allocationId]
      );
      if (!currentResult.rows.length) {
        throw new Error('ALLOCATION_NOT_FOUND');
      }
      const current = currentResult.rows[0];

      const currentUserType = hasUserType
        ? String(current.user_type || '').toLowerCase()
        : (current.student_id ? 'student' : 'staff');
      const userType = payload.user_type !== undefined ? String(payload.user_type).toLowerCase() : currentUserType;
      const { subjectId: userId } = await resolveUserTypeAndSubjectId(client, {
        user_id:
          payload.user_id !== undefined
            ? payload.user_id
            : (userType === 'student' ? (payload.student_id ?? current.student_id ?? current.user_id) : (payload.staff_id ?? current.staff_id ?? current.user_id)),
        student_id:
          payload.student_id !== undefined
            ? payload.student_id
            : (userType === 'student' ? (current.student_id ?? current.user_id) : undefined),
        staff_id:
          payload.staff_id !== undefined
            ? payload.staff_id
            : (userType === 'staff' ? (current.staff_id ?? current.user_id) : undefined),
        user_type: userType,
      });
      const routeId = payload.route_id !== undefined ? Number(payload.route_id) : Number(current.route_id);
      const pickupPointId = payload.pickup_point_id !== undefined ? Number(payload.pickup_point_id) : Number(current.pickup_point_id);
      const vehicleId = payload.vehicle_id !== undefined ? Number(payload.vehicle_id) : Number(current.vehicle_id);
      const isFree = payload.is_free !== undefined ? parseBoolean(payload.is_free, Boolean(current.is_free)) : Boolean(current.is_free);
      const startDate = payload.start_date !== undefined
        ? parseIsoDateOnly(payload.start_date, { fieldName: 'START_DATE', allowNull: false })
        : parseIsoDateOnly(current.start_date, { fieldName: 'START_DATE', allowNull: false });
      const status = payload.status !== undefined ? payload.status : current.status;
      const academicYearId =
        hasAcademicYearId && payload.academic_year_id !== undefined
          ? toPositiveInt(payload.academic_year_id)
          : (hasAcademicYearId ? toPositiveInt(current.academic_year_id) : null);

      if (
        !Number.isFinite(userId) ||
        !Number.isFinite(routeId) ||
        !Number.isFinite(pickupPointId) ||
        !Number.isFinite(vehicleId)
      ) {
        throw new Error('INVALID_NUMERIC_INPUT');
      }
      if (!['student', 'staff'].includes(userType)) {
        throw new Error('INVALID_USER_TYPE');
      }
      const requestedFeeId =
        payload.assigned_fee_id !== undefined
          ? (payload.assigned_fee_id ? Number(payload.assigned_fee_id) : null)
          : (current[feeRefColumn] ? Number(current[feeRefColumn]) : null);

      const normalizedStatus = normalizeStatus(status);

      await validateRoutePickupMapping(client, routeId, pickupPointId);
      await enforceVehicleCapacity(client, vehicleId, startDate, null, allocationId);

      const fee = await resolveAssignedFee(
        client,
        pickupPointId,
        requestedFeeId,
        isFree,
        userType,
        startDate
      );
      const finalEndDate = fee.computedEndDate || null;

      const updates = [];
      const values = [];
      let i = 1;
      if (hasUserId) {
        updates.push(`user_id = $${i++}`);
        values.push(userId);
      }
      if (hasUserType) {
        updates.push(`user_type = $${i++}`);
        values.push(userType);
      }
      if (hasStudentId) {
        updates.push(`student_id = $${i++}`);
        values.push(userType === 'student' ? userId : null);
      }
      if (hasStaffId) {
        updates.push(`staff_id = $${i++}`);
        values.push(userType === 'staff' ? userId : null);
      }
      updates.push(`route_id = $${i++}`);
      values.push(routeId);
      updates.push(`pickup_point_id = $${i++}`);
      values.push(pickupPointId);
      updates.push(`vehicle_id = $${i++}`);
      values.push(vehicleId);
      updates.push(`${feeRefColumn} = $${i++}`);
      values.push(fee.feeId);
      updates.push(`${amountColumn} = $${i++}`);
      values.push(fee.feeAmount);
      updates.push(`is_free = $${i++}`);
      values.push(isFree);
      updates.push(`start_date = $${i++}`);
      values.push(startDate);
      updates.push(`end_date = $${i++}`);
      values.push(finalEndDate);
      updates.push(`status = $${i++}`);
      values.push(normalizedStatus);
      if (hasAcademicYearId) {
        updates.push(`academic_year_id = $${i++}`);
        values.push(academicYearId);
      }
      values.push(allocationId);
      const updateResult = await client.query(
        `UPDATE transport_allocations
         SET ${updates.join(', ')}
         WHERE id = $${i}
         RETURNING *`,
        values
      );
      return updateResult.rows[0];
    });

    return success(res, 200, 'Transport allocation updated successfully', result);
  } catch (err) {
    console.error('Error updating transport allocation:', err);
    if (err.message === 'ALLOCATION_NOT_FOUND') return errorResponse(res, 404, 'Transport allocation not found');
    if (err.message === 'SUBJECT_ID_REQUIRED') return errorResponse(res, 400, 'student_id is required for student allocations and staff_id is required for staff allocations');
    if (err.message === 'INVALID_STUDENT_USER') return errorResponse(res, 400, 'Selected user is not a valid student');
    if (err.message === 'INVALID_STAFF_USER') return errorResponse(res, 400, 'Selected user is not a valid staff member');
    if (err.message === 'INVALID_USER_TYPE') return errorResponse(res, 400, 'user_type must be student or staff');
    if (err.message === 'INVALID_NUMERIC_INPUT') return errorResponse(res, 400, 'student_id/staff_id, route_id, pickup_point_id and vehicle_id must be valid numbers');
    if (err.message === 'START_DATE_INVALID') return errorResponse(res, 400, 'start_date must be in YYYY-MM-DD format');
    if (err.message === 'PICKUP_NOT_IN_ROUTE') return errorResponse(res, 400, 'Selected pickup point is not mapped to selected route');
    if (err.message === 'FEE_PLAN_REQUIRED') return errorResponse(res, 400, 'assigned_fee_id is required unless is_free is true');
    if (err.message === 'FEE_PLAN_NOT_FOUND') return errorResponse(res, 400, 'Selected fee plan does not exist');
    if (err.message === 'FEE_PLAN_PICKUP_MISMATCH') return errorResponse(res, 400, 'Selected fee plan is not valid for the pickup point');
    if (err.message === 'FEE_PLAN_INACTIVE') return errorResponse(res, 400, 'Selected fee plan is inactive');
    if (err.message === 'VEHICLE_NOT_FOUND') return errorResponse(res, 400, 'Selected vehicle does not exist');
    if (err.message === 'INVALID_VEHICLE_CAPACITY') return errorResponse(res, 400, 'Selected vehicle has invalid seat capacity');
    if (err.message === 'VEHICLE_CAPACITY_EXCEEDED') {
      const available = Number.isFinite(err.availableSeats) ? err.availableSeats : 0;
      const total = Number.isFinite(err.totalCapacity) ? err.totalCapacity : null;
      const occupied = Number.isFinite(err.occupiedSeats) ? err.occupiedSeats : null;
      const details = total != null && occupied != null
        ? ` (occupied ${occupied}/${total})`
        : '';
      return errorResponse(res, 400, `No seat available in selected vehicle. Available seats: ${available}${details}`);
    }
    if (err.code === '23503') return errorResponse(res, 400, 'Invalid related record selected (user/route/pickup/vehicle/fee)');
    if (err.code === '23514') return errorResponse(res, 400, 'Invalid allocation values or date range');
    return errorResponse(res, 500, 'Failed to update transport allocation');
  }
};

const deleteTransportAllocation = async (req, res) => {
  try {
    const allocationId = Number(req.params.id);
    if (Number.isNaN(allocationId)) {
      return errorResponse(res, 400, 'Invalid allocation ID');
    }

    const result = await query(
      `DELETE FROM transport_allocations
       WHERE id = $1
       RETURNING id`,
      [allocationId]
    );

    if (!result.rows.length) {
      return errorResponse(res, 404, 'Transport allocation not found');
    }
    return success(res, 200, 'Transport allocation deleted successfully');
  } catch (err) {
    console.error('Error deleting transport allocation:', err);
    return errorResponse(res, 500, 'Failed to delete transport allocation');
  }
};

module.exports = {
  getAllTransportAllocations,
  getTransportSeatAvailability,
  createTransportAllocation,
  createBulkTransportAllocations,
  updateTransportAllocation,
  deleteTransportAllocation,
};
