const { query, executeTransaction } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { resolveAcademicYearId, toPositiveInt } = require('../utils/academicYear');
const { hasColumn } = require('../utils/schemaInspector');

function normalizeStatus(status) {
  if (typeof status !== 'string') return 'Active';
  return status.trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
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

  const feeResult = await client.query(
    `SELECT id, amount, staff_amount, duration_days, status, pickup_point_id
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
      ? Number(feePlan.staff_amount ?? feePlan.amount ?? 0)
      : Number(feePlan.amount ?? 0);

  return {
    feeId: Number(feePlan.id),
    feeAmount,
    computedEndDate: computeEndDateFromDuration(startDate, Number(feePlan.duration_days || 0)),
  };
}

async function enforceVehicleCapacity(client, vehicleId, startDate, endDate, excludeAllocationId = null) {
  const vehicleResult = await client.query(
    `SELECT id, seating_capacity
     FROM vehicles
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
  if (occupied >= capacity) throw new Error('VEHICLE_CAPACITY_EXCEEDED');
}

const getAllTransportAllocations = async (req, res) => {
  try {
    const hasAcademicYearId = await hasColumn('transport_allocations', 'academic_year_id');
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
    const allowedSort = ['id', 'user_type', 'start_date', 'end_date', 'status', 'created_at'];
    const orderBy = allowedSort.includes(sortField) ? `ta.${sortField}` : 'ta.id';
    const direction = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const params = [];
    let whereClause = 'WHERE 1=1';

    if (user_type !== 'all') {
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
        OR CAST(ta.user_id AS TEXT) ILIKE $${params.length}
      )`;
    }

    const countResult = await query(
      `SELECT COUNT(*)
       FROM transport_allocations ta
       JOIN routes r ON r.id = ta.route_id
       JOIN pickup_points pp ON pp.id = ta.pickup_point_id
       LEFT JOIN LATERAL (
         SELECT CONCAT(COALESCE(stu.first_name, ''), ' ', COALESCE(stu.last_name, '')) AS full_name
         FROM students stu
         WHERE ta.user_type = 'student' AND (stu.id = ta.user_id OR stu.user_id = ta.user_id)
         ORDER BY CASE WHEN stu.id = ta.user_id THEN 0 ELSE 1 END
         LIMIT 1
       ) su ON true
       LEFT JOIN LATERAL (
         SELECT CONCAT(COALESCE(stf.first_name, ''), ' ', COALESCE(stf.last_name, '')) AS full_name
         FROM staff stf
         WHERE ta.user_type = 'staff' AND (stf.id = ta.user_id OR stf.user_id = ta.user_id)
         ORDER BY CASE WHEN stf.id = ta.user_id THEN 0 ELSE 1 END
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
         CASE WHEN ta.user_type = 'student' THEN ta.user_id ELSE NULL END AS student_id,
         CASE WHEN ta.user_type = 'staff' THEN ta.user_id ELSE NULL END AS staff_id,
         COALESCE(su.full_name, tu.full_name, CAST(ta.user_id AS TEXT)) AS user_name
       FROM transport_allocations ta
       JOIN routes r ON r.id = ta.route_id
       JOIN pickup_points pp ON pp.id = ta.pickup_point_id
       JOIN vehicles v ON v.id = ta.vehicle_id
       LEFT JOIN transport_fee_master tfm ON tfm.id = ta.assigned_fee_id
       LEFT JOIN LATERAL (
         SELECT CONCAT(COALESCE(stu.first_name, ''), ' ', COALESCE(stu.last_name, '')) AS full_name
         FROM students stu
         WHERE ta.user_type = 'student' AND (stu.id = ta.user_id OR stu.user_id = ta.user_id)
         ORDER BY CASE WHEN stu.id = ta.user_id THEN 0 ELSE 1 END
         LIMIT 1
       ) su ON true
       LEFT JOIN LATERAL (
         SELECT CONCAT(COALESCE(stf.first_name, ''), ' ', COALESCE(stf.last_name, '')) AS full_name
         FROM staff stf
         WHERE ta.user_type = 'staff' AND (stf.id = ta.user_id OR stf.user_id = ta.user_id)
         ORDER BY CASE WHEN stf.id = ta.user_id THEN 0 ELSE 1 END
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
      const startDate = start_date || new Date().toISOString().slice(0, 10);
      const normalizedIsFree = Boolean(is_free);
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
      const effectiveEndDateInput = end_date || null;
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

      // Close any active allocation for the same user before creating a new one.
      await client.query(
        `UPDATE transport_allocations
         SET end_date = GREATEST($1::date, start_date), status = 'Inactive'
         WHERE user_id = $2 AND user_type = $3 AND end_date IS NULL AND status = 'Active'`,
        [startDate, subjectId, normalizedUserType]
      );

      const insertResult = hasAcademicYearId
        ? await client.query(
            `INSERT INTO transport_allocations
              (user_id, user_type, route_id, pickup_point_id, vehicle_id, assigned_fee_id, assigned_fee_amount, is_free, start_date, end_date, status, academic_year_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING *`,
            [
              subjectId,
              normalizedUserType,
              parsedRouteId,
              parsedPickupPointId,
              parsedVehicleId,
              fee.feeId,
              fee.feeAmount,
              normalizedIsFree,
              startDate,
              finalEndDate,
              normalizeStatus(status),
              scopedAcademicYearId,
            ]
          )
        : await client.query(
            `INSERT INTO transport_allocations
              (user_id, user_type, route_id, pickup_point_id, vehicle_id, assigned_fee_id, assigned_fee_amount, is_free, start_date, end_date, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING *`,
            [
              subjectId,
              normalizedUserType,
              parsedRouteId,
              parsedPickupPointId,
              parsedVehicleId,
              fee.feeId,
              fee.feeAmount,
              normalizedIsFree,
              startDate,
              finalEndDate,
              normalizeStatus(status),
            ]
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
    if (err.message === 'VEHICLE_NOT_FOUND') return errorResponse(res, 400, 'Selected vehicle does not exist');
    if (err.message === 'INVALID_VEHICLE_CAPACITY') return errorResponse(res, 400, 'Selected vehicle has invalid seat capacity');
    if (err.message === 'VEHICLE_CAPACITY_EXCEEDED') return errorResponse(res, 400, 'Vehicle seat capacity exceeded');
    if (err.code === '23503') return errorResponse(res, 400, 'Invalid related record selected (user/route/pickup/vehicle/fee)');
    if (err.code === '23514') return errorResponse(res, 400, 'Invalid allocation values or date range');
    return errorResponse(res, 500, 'Failed to create transport allocation');
  }
};

const updateTransportAllocation = async (req, res) => {
  try {
    const hasAcademicYearId = await hasColumn('transport_allocations', 'academic_year_id');
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

      const userType = payload.user_type !== undefined ? String(payload.user_type).toLowerCase() : current.user_type;
      const { subjectId: userId } = await resolveUserTypeAndSubjectId(client, {
        user_id:
          payload.user_id !== undefined
            ? payload.user_id
            : (userType === 'student' ? payload.student_id : payload.staff_id),
        student_id:
          payload.student_id !== undefined
            ? payload.student_id
            : (userType === 'student' ? current.user_id : undefined),
        staff_id:
          payload.staff_id !== undefined
            ? payload.staff_id
            : (userType === 'staff' ? current.user_id : undefined),
        user_type: userType,
      });
      const routeId = payload.route_id !== undefined ? Number(payload.route_id) : Number(current.route_id);
      const pickupPointId = payload.pickup_point_id !== undefined ? Number(payload.pickup_point_id) : Number(current.pickup_point_id);
      const vehicleId = payload.vehicle_id !== undefined ? Number(payload.vehicle_id) : Number(current.vehicle_id);
      const isFree = payload.is_free !== undefined ? Boolean(payload.is_free) : Boolean(current.is_free);
      const startDate = payload.start_date !== undefined ? payload.start_date : current.start_date;
      const endDate = payload.end_date !== undefined ? payload.end_date : current.end_date;
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
          : (current.assigned_fee_id ? Number(current.assigned_fee_id) : null);

      const normalizedStatus = normalizeStatus(status);

      // If nothing changed, avoid creating duplicate history rows.
      const noMeaningfulChange =
        Number(current.user_id) === Number(userId) &&
        String(current.user_type) === String(userType) &&
        Number(current.route_id) === Number(routeId) &&
        Number(current.pickup_point_id) === Number(pickupPointId) &&
        Number(current.vehicle_id) === Number(vehicleId) &&
        Number(current.assigned_fee_id || 0) === Number(requestedFeeId || 0) &&
        Boolean(current.is_free) === Boolean(isFree) &&
        String(current.start_date) === String(startDate) &&
        String(current.end_date || '') === String(endDate || '') &&
        String(current.status) === String(normalizedStatus) &&
        (!hasAcademicYearId || Number(current.academic_year_id || 0) === Number(academicYearId || 0));

      if (noMeaningfulChange) {
        return current;
      }

      // Status-only updates should happen in place (no history duplication).
      const statusOnlyChange =
        Number(current.user_id) === Number(userId) &&
        String(current.user_type) === String(userType) &&
        Number(current.route_id) === Number(routeId) &&
        Number(current.pickup_point_id) === Number(pickupPointId) &&
        Number(current.vehicle_id) === Number(vehicleId) &&
        Number(current.assigned_fee_id || 0) === Number(requestedFeeId || 0) &&
        Boolean(current.is_free) === Boolean(isFree) &&
        String(current.start_date) === String(startDate) &&
        String(current.end_date || '') === String(endDate || '') &&
        String(current.status) !== String(normalizedStatus) &&
        (!hasAcademicYearId || Number(current.academic_year_id || 0) === Number(academicYearId || 0));

      if (statusOnlyChange) {
        const updateResult = await client.query(
          `UPDATE transport_allocations
           SET status = $1,
               end_date = CASE WHEN $1 = 'Inactive' THEN COALESCE(end_date, CURRENT_DATE) ELSE end_date END
           WHERE id = $2
           RETURNING *`,
          [normalizedStatus, allocationId]
        );
        return updateResult.rows[0];
      }

      await validateRoutePickupMapping(client, routeId, pickupPointId);
      await enforceVehicleCapacity(client, vehicleId, startDate, endDate, allocationId);

      const fee = await resolveAssignedFee(
        client,
        pickupPointId,
        requestedFeeId,
        isFree,
        userType,
        startDate
      );
      const finalEndDate = fee.computedEndDate || endDate;

      // End the old allocation as history.
      await client.query(
        `UPDATE transport_allocations
         SET end_date = GREATEST($1::date, start_date), status = 'Inactive'
         WHERE id = $2`,
        [startDate, allocationId]
      );

      const insertResult = hasAcademicYearId
        ? await client.query(
            `INSERT INTO transport_allocations
              (user_id, user_type, route_id, pickup_point_id, vehicle_id, assigned_fee_id, assigned_fee_amount, is_free, start_date, end_date, status, academic_year_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING *`,
            [userId, userType, routeId, pickupPointId, vehicleId, fee.feeId, fee.feeAmount, isFree, startDate, finalEndDate, normalizedStatus, academicYearId]
          )
        : await client.query(
            `INSERT INTO transport_allocations
              (user_id, user_type, route_id, pickup_point_id, vehicle_id, assigned_fee_id, assigned_fee_amount, is_free, start_date, end_date, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING *`,
            [userId, userType, routeId, pickupPointId, vehicleId, fee.feeId, fee.feeAmount, isFree, startDate, finalEndDate, normalizedStatus]
          );

      return insertResult.rows[0];
    });

    return success(res, 200, 'Transport allocation updated by creating a new history record', result);
  } catch (err) {
    console.error('Error updating transport allocation:', err);
    if (err.message === 'ALLOCATION_NOT_FOUND') return errorResponse(res, 404, 'Transport allocation not found');
    if (err.message === 'SUBJECT_ID_REQUIRED') return errorResponse(res, 400, 'student_id is required for student allocations and staff_id is required for staff allocations');
    if (err.message === 'INVALID_STUDENT_USER') return errorResponse(res, 400, 'Selected user is not a valid student');
    if (err.message === 'INVALID_STAFF_USER') return errorResponse(res, 400, 'Selected user is not a valid staff member');
    if (err.message === 'INVALID_USER_TYPE') return errorResponse(res, 400, 'user_type must be student or staff');
    if (err.message === 'INVALID_NUMERIC_INPUT') return errorResponse(res, 400, 'student_id/staff_id, route_id, pickup_point_id and vehicle_id must be valid numbers');
    if (err.message === 'PICKUP_NOT_IN_ROUTE') return errorResponse(res, 400, 'Selected pickup point is not mapped to selected route');
    if (err.message === 'FEE_PLAN_REQUIRED') return errorResponse(res, 400, 'assigned_fee_id is required unless is_free is true');
    if (err.message === 'FEE_PLAN_NOT_FOUND') return errorResponse(res, 400, 'Selected fee plan does not exist');
    if (err.message === 'FEE_PLAN_PICKUP_MISMATCH') return errorResponse(res, 400, 'Selected fee plan is not valid for the pickup point');
    if (err.message === 'FEE_PLAN_INACTIVE') return errorResponse(res, 400, 'Selected fee plan is inactive');
    if (err.message === 'VEHICLE_NOT_FOUND') return errorResponse(res, 400, 'Selected vehicle does not exist');
    if (err.message === 'INVALID_VEHICLE_CAPACITY') return errorResponse(res, 400, 'Selected vehicle has invalid seat capacity');
    if (err.message === 'VEHICLE_CAPACITY_EXCEEDED') return errorResponse(res, 400, 'Vehicle seat capacity exceeded');
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
      `UPDATE transport_allocations
       SET status = 'Inactive',
           end_date = COALESCE(end_date, CURRENT_DATE)
       WHERE id = $1
       RETURNING id`,
      [allocationId]
    );

    if (!result.rows.length) {
      return errorResponse(res, 404, 'Transport allocation not found');
    }
    return success(res, 200, 'Transport allocation closed successfully');
  } catch (err) {
    console.error('Error deleting transport allocation:', err);
    return errorResponse(res, 500, 'Failed to delete transport allocation');
  }
};

module.exports = {
  getAllTransportAllocations,
  createTransportAllocation,
  updateTransportAllocation,
  deleteTransportAllocation,
};
