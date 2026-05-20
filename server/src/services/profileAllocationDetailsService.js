const { query } = require('../config/database');
const { hasColumn, hasTable } = require('../utils/schemaInspector');

const ACTIVE_STATUS_SQL = "LOWER(TRIM(COALESCE({col}, ''))) IN ('active')";

function clearHostelFields(target) {
  target.hostel_name = null;
  target.floor = null;
  target.hostel_room_number = null;
  target.hostel_bed_number = null;
  target.hostel_assigned_date = null;
  target.hostel_academic_year_name = null;
}

function clearTransportFields(target) {
  target.route_id = null;
  target.pickup_point_id = null;
  target.vehicle_id = null;
  target.route_name = null;
  target.pickup_point_name = null;
  target.vehicle_number = null;
  target.transport_assigned_fee_id = null;
  target.transport_assigned_fee_amount = null;
  target.transport_is_free = false;
  target.transport_fee_plan_name = null;
}

function formatFloorLabel(floorName, floorNumber) {
  const name = floorName != null ? String(floorName).trim() : '';
  if (name) return name;
  if (floorNumber != null && String(floorNumber).trim() !== '') {
    return `Floor ${floorNumber}`;
  }
  return null;
}

function applyHostelRow(profile, row) {
  profile.hostel_name = row.hostel_name || null;
  profile.floor = formatFloorLabel(row.floor_name, row.floor_number);
  profile.hostel_room_number = row.room_number || null;
  profile.hostel_bed_number = row.bed_number || null;
  profile.hostel_assigned_date = row.assigned_date || null;
  profile.hostel_academic_year_name = row.academic_year_name || null;
}

async function resolveVehicleTable() {
  const hasTransportVehiclesTable = await hasTable('transport_vehicles');
  return hasTransportVehiclesTable ? 'transport_vehicles' : 'vehicles';
}

async function loadHostelAssignmentByStudent(studentId, academicYearId = null) {
  if (!(await hasTable('hostel_assignments'))) return null;
  const sid = parseInt(String(studentId), 10);
  if (!Number.isFinite(sid) || sid <= 0) return null;
  const ayId =
    Number.isFinite(Number(academicYearId)) && Number(academicYearId) > 0
      ? Number(academicYearId)
      : null;

  const statusCond = ACTIVE_STATUS_SQL.replace('{col}', 'ha.assignment_status');
  const result = await query(
    `SELECT
       h.hostel_name,
       hf.floor_name,
       hf.floor_number,
       r.room_number,
       b.bed_number,
       ha.assigned_date,
       ay.year_name AS academic_year_name
     FROM hostel_assignments ha
     JOIN hostels h ON h.id = ha.hostel_id
     LEFT JOIN hostel_floors hf ON hf.id = ha.floor_id
     JOIN hostel_rooms r ON r.id = ha.room_id
     JOIN hostel_beds b ON b.id = ha.bed_id
     LEFT JOIN academic_years ay ON ay.id = ha.academic_year_id
     WHERE ha.student_id = $1
       AND ${statusCond}
       AND ha.deleted_at IS NULL
       AND (ha.checkout_date IS NULL OR ha.checkout_date >= CURRENT_DATE)
     ORDER BY
       CASE WHEN $2::int IS NOT NULL AND ha.academic_year_id = $2 THEN 0 ELSE 1 END,
       ha.assigned_date DESC,
       ha.id DESC
     LIMIT 1`,
    [sid, ayId]
  );
  return result.rows?.[0] ?? null;
}

async function loadLegacyStudentHostel(studentId, academicYearId = null) {
  if (!(await hasTable('student_hostel_assignments'))) return null;
  const sid = parseInt(String(studentId), 10);
  if (!Number.isFinite(sid) || sid <= 0) return null;
  const ayId =
    Number.isFinite(Number(academicYearId)) && Number(academicYearId) > 0
      ? Number(academicYearId)
      : null;

  const hasHostels = await hasTable('hostels');
  const hostelJoin = hasHostels
    ? 'LEFT JOIN hostels h ON h.id = sha.hostel_id'
    : '';
  const hostelSelect = hasHostels ? 'h.hostel_name' : 'NULL::text AS hostel_name';

  const result = await query(
    `SELECT
       ${hostelSelect},
       NULL::text AS floor_name,
       NULL::integer AS floor_number,
       NULL::text AS room_number,
       sha.bed_number,
       sha.valid_from AS assigned_date,
       ay.year_name AS academic_year_name
     FROM student_hostel_assignments sha
     ${hostelJoin}
     LEFT JOIN academic_years ay ON ay.id = sha.academic_year_id
     WHERE sha.student_id = $1
       AND COALESCE(sha.is_active, true) = true
       AND (sha.valid_to IS NULL OR sha.valid_to >= CURRENT_DATE)
     ORDER BY
       CASE WHEN $2::int IS NOT NULL AND sha.academic_year_id = $2 THEN 0 ELSE 1 END,
       sha.valid_from DESC NULLS LAST,
       sha.id DESC
     LIMIT 1`,
    [sid, ayId]
  );
  return result.rows?.[0] ?? null;
}

async function loadHostelAssignmentByStaff(staffId, academicYearId = null) {
  if (!(await hasTable('hostel_assignments'))) return null;
  const stid = parseInt(String(staffId), 10);
  if (!Number.isFinite(stid) || stid <= 0) return null;
  const ayId =
    Number.isFinite(Number(academicYearId)) && Number(academicYearId) > 0
      ? Number(academicYearId)
      : null;

  const statusCond = ACTIVE_STATUS_SQL.replace('{col}', 'ha.assignment_status');
  const result = await query(
    `SELECT
       h.hostel_name,
       hf.floor_name,
       hf.floor_number,
       r.room_number,
       b.bed_number,
       ha.assigned_date,
       ay.year_name AS academic_year_name
     FROM hostel_assignments ha
     JOIN hostels h ON h.id = ha.hostel_id
     LEFT JOIN hostel_floors hf ON hf.id = ha.floor_id
     JOIN hostel_rooms r ON r.id = ha.room_id
     JOIN hostel_beds b ON b.id = ha.bed_id
     LEFT JOIN academic_years ay ON ay.id = ha.academic_year_id
     WHERE ha.staff_id = $1
       AND ${statusCond}
       AND ha.deleted_at IS NULL
       AND (ha.checkout_date IS NULL OR ha.checkout_date >= CURRENT_DATE)
     ORDER BY
       CASE WHEN $2::int IS NOT NULL AND ha.academic_year_id = $2 THEN 0 ELSE 1 END,
       ha.assigned_date DESC,
       ha.id DESC
     LIMIT 1`,
    [stid, ayId]
  );
  return result.rows?.[0] ?? null;
}

async function enrichStudentHostel(profile, studentId, academicYearId = null) {
  clearHostelFields(profile);
  try {
    let row = await loadHostelAssignmentByStudent(studentId, academicYearId);
    if (!row) {
      row = await loadLegacyStudentHostel(studentId, academicYearId);
    }
    if (!row) return;
    applyHostelRow(profile, row);
  } catch (e) {
    console.warn('enrichStudentHostel:', e.message);
    clearHostelFields(profile);
  }
}

async function enrichStaffHostel(profile, staffId, academicYearId = null) {
  clearHostelFields(profile);
  try {
    const row = await loadHostelAssignmentByStaff(staffId, academicYearId);
    if (!row) return;
    applyHostelRow(profile, row);
  } catch (e) {
    console.warn('enrichStaffHostel:', e.message);
    clearHostelFields(profile);
  }
}

async function enrichStudentTransport(profile, studentId, academicYearId = null, userId = null) {
  clearTransportFields(profile);
  const sid = parseInt(String(studentId), 10);
  if (!Number.isFinite(sid) || sid <= 0) return;
  if (!(await hasTable('transport_allocations'))) return;

  try {
    const vehicleTable = await resolveVehicleTable();
    const hasStudentId = await hasColumn('transport_allocations', 'student_id');
    const hasUserId = await hasColumn('transport_allocations', 'user_id');
    const hasFeeMasterId = await hasColumn('transport_allocations', 'fee_master_id');
    const feeCol = hasFeeMasterId ? 'fee_master_id' : 'assigned_fee_id';
    const hasAssignedAmount = await hasColumn('transport_allocations', 'assigned_amount');
    const amountCol = hasAssignedAmount ? 'assigned_amount' : 'assigned_fee_amount';
    const statusCond = ACTIVE_STATUS_SQL.replace('{col}', 'ta.status');

    const ayId =
      Number.isFinite(Number(academicYearId)) && Number(academicYearId) > 0
        ? Number(academicYearId)
        : null;
    const uid =
      Number.isFinite(Number(userId)) && Number(userId) > 0 ? Number(userId) : null;

    const borrowerParts = [];
    const params = [];
    if (hasStudentId) {
      params.push(sid);
      borrowerParts.push(`ta.student_id = $${params.length}`);
    }
    if (hasUserId && uid) {
      params.push(uid);
      borrowerParts.push(`ta.user_id = $${params.length}`);
    }
    if (!borrowerParts.length) return;

    params.push(ayId);
    const ayParam = `$${params.length}`;

    const result = await query(
      `SELECT
         vra.route_id,
         ta.pickup_point_id,
         vra.vehicle_id,
         ta.${feeCol} AS transport_assigned_fee_id,
         ta.${amountCol} AS transport_assigned_fee_amount,
         ta.is_free AS transport_is_free,
         r.route_name,
         COALESCE(pp.point_name, pp.address) AS pickup_point_name,
         v.vehicle_number,
         tfm.plan_name AS transport_fee_plan_name
       FROM transport_allocations ta
       INNER JOIN vehicle_route_assignments vra ON vra.id = ta.vehicle_route_assignment_id
       LEFT JOIN routes r ON r.id = vra.route_id
       LEFT JOIN pickup_points pp ON pp.id = ta.pickup_point_id
       LEFT JOIN ${vehicleTable} v ON v.id = vra.vehicle_id
       LEFT JOIN transport_fee_master tfm ON tfm.id = ta.${feeCol}
       WHERE (${borrowerParts.join(' OR ')})
         AND ${statusCond}
         AND ta.deleted_at IS NULL
         AND (ta.end_date IS NULL OR ta.end_date >= CURRENT_DATE)
       ORDER BY
         CASE
           WHEN ${ayParam}::int IS NOT NULL AND ta.academic_year_id = ${ayParam} THEN 0
           WHEN ta.academic_year_id IS NULL THEN 1
           ELSE 2
         END,
         ta.start_date DESC NULLS LAST,
         ta.id DESC
       LIMIT 1`,
      params
    );

    if (!result.rows?.length) return;
    const row = result.rows[0];
    profile.route_id = row.route_id ?? null;
    profile.pickup_point_id = row.pickup_point_id ?? null;
    profile.vehicle_id = row.vehicle_id ?? null;
    profile.route_name = row.route_name || null;
    profile.pickup_point_name = row.pickup_point_name || null;
    profile.vehicle_number = row.vehicle_number || null;
    profile.transport_assigned_fee_id = row.transport_assigned_fee_id ?? null;
    profile.transport_assigned_fee_amount = row.transport_assigned_fee_amount ?? null;
    profile.transport_is_free = row.transport_is_free === true;
    profile.transport_fee_plan_name = row.transport_fee_plan_name || null;
  } catch (e) {
    console.warn('enrichStudentTransport:', e.message);
    clearTransportFields(profile);
  }
}

async function enrichStaffTransport(profile, staffId) {
  clearTransportFields(profile);
  const stid = parseInt(String(staffId), 10);
  if (!Number.isFinite(stid) || stid <= 0) return;
  if (!(await hasTable('transport_allocations'))) return;

  try {
    const vehicleTable = await resolveVehicleTable();
    const hasStaffId = await hasColumn('transport_allocations', 'staff_id');
    const hasUserId = await hasColumn('transport_allocations', 'user_id');
    const hasFeeMasterId = await hasColumn('transport_allocations', 'fee_master_id');
    const feeCol = hasFeeMasterId ? 'fee_master_id' : 'assigned_fee_id';
    const hasAssignedAmount = await hasColumn('transport_allocations', 'assigned_amount');
    const amountCol = hasAssignedAmount ? 'assigned_amount' : 'assigned_fee_amount';
    const statusCond = ACTIVE_STATUS_SQL.replace('{col}', 'ta.status');

    const borrowerParts = [];
    const params = [];
    if (hasStaffId) {
      params.push(stid);
      borrowerParts.push(`ta.staff_id = $${params.length}`);
    }
    if (hasUserId && profile.user_id) {
      const uid = Number(profile.user_id);
      if (Number.isFinite(uid) && uid > 0) {
        params.push(uid);
        borrowerParts.push(`ta.user_id = $${params.length}`);
      }
    }
    if (!borrowerParts.length) return;

    const result = await query(
      `SELECT
         vra.route_id,
         ta.pickup_point_id,
         vra.vehicle_id,
         ta.${feeCol} AS transport_assigned_fee_id,
         ta.${amountCol} AS transport_assigned_fee_amount,
         ta.is_free AS transport_is_free,
         r.route_name,
         COALESCE(pp.point_name, pp.address) AS pickup_point_name,
         v.vehicle_number,
         tfm.plan_name AS transport_fee_plan_name
       FROM transport_allocations ta
       INNER JOIN vehicle_route_assignments vra ON vra.id = ta.vehicle_route_assignment_id
       LEFT JOIN routes r ON r.id = vra.route_id
       LEFT JOIN pickup_points pp ON pp.id = ta.pickup_point_id
       LEFT JOIN ${vehicleTable} v ON v.id = vra.vehicle_id
       LEFT JOIN transport_fee_master tfm ON tfm.id = ta.${feeCol}
       WHERE (${borrowerParts.join(' OR ')})
         AND ${statusCond}
         AND ta.deleted_at IS NULL
         AND (ta.end_date IS NULL OR ta.end_date >= CURRENT_DATE)
       ORDER BY ta.start_date DESC NULLS LAST, ta.id DESC
       LIMIT 1`,
      params
    );

    if (!result.rows?.length) return;
    const row = result.rows[0];
    profile.route_id = row.route_id ?? null;
    profile.pickup_point_id = row.pickup_point_id ?? null;
    profile.vehicle_id = row.vehicle_id ?? null;
    profile.route_name = row.route_name || null;
    profile.pickup_point_name = row.pickup_point_name || null;
    profile.vehicle_number = row.vehicle_number || null;
    profile.transport_assigned_fee_id = row.transport_assigned_fee_id ?? null;
    profile.transport_assigned_fee_amount = row.transport_assigned_fee_amount ?? null;
    profile.transport_is_free = row.transport_is_free === true;
    profile.transport_fee_plan_name = row.transport_fee_plan_name || null;
  } catch (e) {
    console.warn('enrichStaffTransport:', e.message);
    clearTransportFields(profile);
  }
}

async function enrichStudentProfileAllocations(profile, studentId, options = {}) {
  const { academicYearId, userId } = options;
  await enrichStudentHostel(profile, studentId, academicYearId);
  await enrichStudentTransport(profile, studentId, academicYearId, userId);
}

async function resolveCurrentAcademicYearId() {
  if (!(await hasTable('academic_years'))) return null;
  try {
    const hasIsCurrent = await hasColumn('academic_years', 'is_current');
    if (hasIsCurrent) {
      const current = await query(
        `SELECT id FROM academic_years
         WHERE is_current = true
         ORDER BY id DESC
         LIMIT 1`
      );
      if (current.rows?.[0]?.id) return current.rows[0].id;
    }
    const latest = await query(
      `SELECT id FROM academic_years
       ORDER BY start_date DESC NULLS LAST, id DESC
       LIMIT 1`
    );
    return latest.rows?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function enrichStaffProfileAllocations(profile, staffId, options = {}) {
  const { academicYearId, includeTransport = true } = options;
  let ayId = academicYearId;
  if (!Number.isFinite(Number(ayId)) || Number(ayId) <= 0) {
    ayId =
      profile?.academic_year_id ??
      (await resolveCurrentAcademicYearId());
  }
  await enrichStaffHostel(profile, staffId, ayId);
  if (includeTransport) {
    await enrichStaffTransport(profile, staffId);
  }
}

module.exports = {
  enrichStudentHostel,
  enrichStaffHostel,
  enrichStudentTransport,
  enrichStaffTransport,
  enrichStudentProfileAllocations,
  enrichStaffProfileAllocations,
  clearHostelFields,
  clearTransportFields,
};
