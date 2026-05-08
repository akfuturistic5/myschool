const fs = require('fs');
const { query, executeTransaction, runWithTenant } = require('../config/database');
const { ADMIN_ROLE_IDS } = require('../config/roles');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { canAccessClass, parseId, getAuthContext, isAdmin, resolveTeacherIdForUser } = require('../utils/accessControl');
const { createTeacherUser } = require('../utils/createPersonUser');
const { resolveTeacherDocumentPath, sanitizeTenant } = require('../utils/teacherDocumentStorage');
const { resolveAcademicYearId } = require('../utils/academicYear');

async function upsertStaffTransportAllocation(client, staffId, staffAcademicYearId, transportPayload) {
  const routeId = Number(transportPayload?.route_id);
  const pickupPointId = Number(transportPayload?.pickup_point_id);
  const vehicleId = Number(transportPayload?.vehicle_id);
  const feeMasterId =
    transportPayload?.assigned_fee_id != null && transportPayload?.assigned_fee_id !== ''
      ? Number(transportPayload.assigned_fee_id)
      : null;
  const isFree = Boolean(transportPayload?.is_free);
  const isRequired = Boolean(transportPayload?.is_transport_required);

  if (!isRequired) {
    // Deactivate any existing active allocation for this staff member
    await client.query(
      `UPDATE transport_allocations
       SET status = 'Inactive',
           end_date = COALESCE(end_date, CURRENT_DATE),
           updated_at = CURRENT_TIMESTAMP
       WHERE staff_id = $1
         AND LOWER(COALESCE(status, '')) = 'active'
         AND end_date IS NULL
         AND deleted_at IS NULL`,
      [staffId]
    );
    return;
  }

  if (
    !Number.isFinite(routeId) || routeId <= 0 ||
    !Number.isFinite(pickupPointId) || pickupPointId <= 0
  ) {
    return;
  }

  let assignedAmount = null;
  if (isFree) {
    assignedAmount = 0;
  } else if (feeMasterId != null) {
    const feeRes = await client.query(
      `SELECT id, amount, staff_amount, pickup_point_id, status
       FROM transport_fee_master
       WHERE id = $1`,
      [feeMasterId]
    );
    if (feeRes.rows.length > 0) {
      const feeRow = feeRes.rows[0];
      if (
        Number(feeRow.pickup_point_id) === pickupPointId &&
        String(feeRow.status || '').toLowerCase() === 'active'
      ) {
        assignedAmount = Number(feeRow.staff_amount ?? feeRow.amount ?? 0);
      }
    }
  }

  const active = await client.query(
    `SELECT id
     FROM transport_allocations
     WHERE staff_id = $1
       AND LOWER(COALESCE(status, '')) = 'active'
       AND end_date IS NULL
       AND deleted_at IS NULL
     ORDER BY id DESC
     LIMIT 1`,
    [staffId]
  );

  if (active.rows.length > 0) {
    await client.query(
      `UPDATE transport_allocations
       SET route_id = $1,
           pickup_point_id = $2,
           vehicle_id = $3,
           fee_master_id = $4,
           assigned_amount = $5,
           is_free = $6,
           academic_year_id = COALESCE($7, academic_year_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [
        routeId,
        pickupPointId,
        vehicleId && Number.isFinite(vehicleId) ? vehicleId : null,
        isFree ? null : feeMasterId,
        assignedAmount,
        isFree,
        staffAcademicYearId || null,
        active.rows[0].id,
      ]
    );
    return;
  }

  await client.query(
    `INSERT INTO transport_allocations
      (staff_id, route_id, pickup_point_id, vehicle_id, fee_master_id, assigned_amount, is_free, start_date, status, academic_year_id, created_at, updated_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, 'Active', $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      staffId,
      routeId,
      pickupPointId,
      vehicleId && Number.isFinite(vehicleId) ? vehicleId : null,
      isFree ? null : feeMasterId,
      assignedAmount,
      isFree,
      staffAcademicYearId || null,
    ]
  );
}



const normalizeGender = (g) => {
  if (g == null || g === '') return null;
  const v = String(g).trim().toLowerCase();
  if (v === 'male' || v === 'm') return 'male';
  if (v === 'female' || v === 'f') return 'female';
  if (v === 'other' || v === 'o') return 'other';
  return null;
};

const TEACHER_EMAIL_MAX_LEN = 100;
const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidTeacherEmail = (email) => {
  const s = (email || '').toString().trim();
  return s.length > 0 && s.length <= TEACHER_EMAIL_MAX_LEN && EMAIL_FORMAT_REGEX.test(s);
};

const normalizePhoneDigits = (phone) => String(phone || '').replace(/\D/g, '');

const isValidTeacherPhone = (phone) => {
  const d = normalizePhoneDigits(phone);
  return d.length >= 7 && d.length <= 15;
};

const mapUniqueConstraintToMessage = (constraint) => {
  const c = String(constraint || '').toLowerCase();
  if (c.includes('staff_email')) return 'This email is already assigned to another staff member';
  if (c.includes('users_email')) return 'This email is already registered for another user account';
  if (c.includes('username')) return 'This login name is already in use';
  if (c.includes('employee_code')) return 'This employee code is already in use';
  if (c.includes('pan_number') || c.includes('teachers_pan')) return 'This PAN number is already registered';
  if (c.includes('phone')) return 'This phone number is already in use';
  return 'This record conflicts with an existing one';
};

const parsePositiveIntOrNull = (val) => {
  if (val === undefined || val === null || val === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) || n < 1 ? NaN : n;
};

// Get all teachers
const getAllTeachers = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        s.id AS id,
        NULL::integer AS class_id,
        NULL::integer AS subject_id,
        s.father_name,
        s.mother_name,
        s.marital_status,
        s.languages_known,
        NULL::text AS blood_group,
        s.previous_school_name,
        s.previous_school_address,
        s.previous_school_phone,
        u.current_address,
        u.permanent_address,
        sal.pan_number,
        s.id_number,
        sal.bank_name,
        sal.branch,
        sal.ifsc_code AS ifsc,
        sal.contract_type,
        sal.shift,
        sal.work_location,
        u.facebook,
        u.twitter,
        u.linkedin,
        s.status,
        s.created_at,
        s.resume,
        s.joining_letter,
        s.updated_at AS updated_at,
        s.id AS staff_id,
        s.user_id,
        s.employee_code,
        u.first_name,
        u.last_name,
        u.gender,
        u.date_of_birth,
        u.blood_group_id,
        u.phone,
        u.email,
        u.current_address AS address,
        s.emergency_contact_name,
        s.emergency_contact_phone,
        s.designation_id,
        s.department_id,
        s.joining_date,
        sal.basic_salary AS salary,
        s.qualification,
        s.experience_years,
        s.photo_url,
        u.is_active AS is_active,
        u.youtube,
        u.instagram,
        s.other_info,
        sal.account_name,
        sal.account_no AS account_number,
        NULL::text AS class_name,
        NULL::text AS subject_name
      FROM staff s
      INNER JOIN users u ON u.id = s.user_id
      LEFT JOIN LATERAL (
        SELECT
          ssa.pan_number,
          ssa.bank_name,
          ssa.account_name,
          ssa.account_no,
          ssa.branch,
          ssa.ifsc_code,
          ssa.contract_type,
          ssa.shift,
          ssa.work_location,
          ssa.basic_salary
        FROM staff_salary_assignments ssa
        WHERE ssa.staff_id = s.id
          AND ssa.valid_period @> CURRENT_DATE::date
        ORDER BY ssa.id DESC
        LIMIT 1
      ) sal ON true
      WHERE s.deleted_at IS NULL AND u.role_id = 2
      ORDER BY u.first_name ASC, u.last_name ASC, u.id ASC
    `);

    return success(res, 200, 'Teachers fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return errorResponse(res, 500, 'Failed to fetch teachers');
  }
};

// Get current logged-in teacher (by user_id from JWT via staff)
const getCurrentTeacher = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return errorResponse(res, 401, 'Not authenticated');
    }

    const result = await query(`
      SELECT
        s.id AS id,
        NULL::integer AS class_id,
        NULL::integer AS subject_id,
        s.father_name,
        s.mother_name,
        s.marital_status,
        s.languages_known,
        NULL::text AS blood_group,
        s.previous_school_name,
        s.previous_school_address,
        s.previous_school_phone,
        u.current_address,
        u.permanent_address,
        sal.pan_number,
        s.id_number,
        sal.bank_name,
        sal.branch,
        sal.ifsc_code AS ifsc,
        sal.contract_type,
        sal.shift,
        sal.work_location,
        u.facebook,
        u.twitter,
        u.linkedin,
        s.status,
        s.created_at,
        s.resume,
        s.joining_letter,
        s.updated_at AS updated_at,
        s.id AS staff_id,
        s.employee_code,
        u.first_name,
        u.last_name,
        u.gender,
        u.date_of_birth,
        u.blood_group_id,
        u.phone,
        u.email,
        u.current_address AS address,
        s.emergency_contact_name,
        s.emergency_contact_phone,
        s.designation_id,
        s.department_id,
        s.joining_date,
        sal.basic_salary AS salary,
        s.qualification,
        s.experience_years,
        s.photo_url,
        u.is_active AS is_active,
        u.youtube,
        u.instagram,
        s.other_info,
        sal.account_name,
        sal.account_no AS account_number,
        NULL::text AS class_name,
        NULL::text AS subject_name
      FROM staff s
      INNER JOIN users u ON u.id = s.user_id
      LEFT JOIN LATERAL (
        SELECT
          ssa.pan_number,
          ssa.bank_name,
          ssa.account_name,
          ssa.account_no,
          ssa.branch,
          ssa.ifsc_code,
          ssa.contract_type,
          ssa.shift,
          ssa.work_location,
          ssa.basic_salary
        FROM staff_salary_assignments ssa
        WHERE ssa.staff_id = s.id
          AND ssa.valid_period @> CURRENT_DATE::date
        ORDER BY ssa.id DESC
        LIMIT 1
      ) sal ON true
      WHERE s.user_id = $1 AND s.deleted_at IS NULL
      LIMIT 1
    `, [userId]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Teacher not found for this user');
    }

    return success(res, 200, 'Teacher fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching current teacher:', error);
    return errorResponse(res, 500, 'Failed to fetch teacher');
  }
};

// Get teacher by ID
const getTeacherById = async (req, res) => {
  try {
    const { id } = req.params;
    const requester = req.user;
    const roleId = requester?.role_id != null ? parseInt(requester.role_id, 10) : null;
    if (!requester?.id || roleId == null) {
      return errorResponse(res, 401, 'Not authenticated');
    }

    const result = await query(`
      SELECT
        s.id,
        sta.class_id,
        sta.class_subject_id AS subject_id,
        s.father_name,
        s.mother_name,
        s.marital_status,
        s.languages_known,
        bg.blood_group_name AS blood_group,
        s.previous_school_name,
        s.previous_school_address,
        s.previous_school_phone,
        u.current_address,
        u.permanent_address,
        sal.pan_number,
        s.id_number,
        sal.bank_name,
        sal.branch,
        sal.ifsc_code AS ifsc,
        sal.contract_type,
        sal.shift,
        sal.work_location,
        u.facebook,
        u.twitter,
        u.linkedin,
        u.youtube,
        u.instagram,
        s.other_info,
        sal.account_name,
        sal.account_no AS account_number,
        s.status,
        s.created_at,
        s.resume,
        s.joining_letter,
        s.updated_at AS updated_at,
        s.id AS staff_id,
        s.user_id,
        s.employee_code,
        u.first_name,
        u.last_name,
        u.gender,
        u.date_of_birth,
        u.blood_group_id,
        u.phone,
        u.email,
        u.current_address AS address,
        u.permanent_address,
        s.emergency_contact_name,
        s.emergency_contact_phone,
        s.designation_id,
        s.department_id,
        s.joining_date,
        sal.basic_salary AS salary,
        s.qualification,
        s.experience_years,
        s.photo_url,
        u.is_active AS is_active,
        sal.epf_no,
        c.class_name,
        sub.subject_name,
        COALESCE(tr.route_id::integer, NULL) AS route_id,
        tr.pickup_point_id,
        tr.vehicle_id,
        tr.transport_assigned_fee_id,
        tr.transport_assigned_fee_amount,
        tr.transport_is_free AS transport_is_free,
        tr.route_alloc_name AS route_name,
        tr.pickup_alloc_name AS pickup_point_name,
        tr.vehicle_alloc_no AS vehicle_number,
        tr.plan_name AS transport_fee_plan_name,
        false AS is_transport_required,
        false AS is_hostel_required,
        NULL::text AS hostel_name,
        NULL::text AS hostel_room_number
      FROM staff s
      INNER JOIN users u ON s.user_id = u.id
      LEFT JOIN blood_groups bg ON u.blood_group_id = bg.id
      LEFT JOIN LATERAL (
        SELECT * FROM staff_salary_assignments
        WHERE staff_id = s.id
        ORDER BY valid_period DESC LIMIT 1
      ) sal ON TRUE
      LEFT JOIN LATERAL (
        SELECT * FROM subject_teacher_assignments
        WHERE staff_id = s.id
        ORDER BY valid_period DESC LIMIT 1
      ) sta ON TRUE
      LEFT JOIN classes c ON sta.class_id = c.id
      LEFT JOIN subjects sub ON sta.class_subject_id = sub.id
      LEFT JOIN LATERAL (
        SELECT
          ta.route_id,
          ta.pickup_point_id,
          ta.vehicle_id,
          ta.fee_master_id AS transport_assigned_fee_id,
          ta.assigned_amount AS transport_assigned_fee_amount,
          ta.is_free AS transport_is_free,
          rt.route_name AS route_alloc_name,
          COALESCE(pp.point_name, pp.address) AS pickup_alloc_name,
          v.vehicle_number AS vehicle_alloc_no,
          tfm.plan_name
        FROM transport_allocations ta
        LEFT JOIN routes rt ON rt.id = ta.route_id
        LEFT JOIN pickup_points pp ON pp.id = ta.pickup_point_id
        LEFT JOIN transport_vehicles v ON v.id = ta.vehicle_id
        LEFT JOIN transport_fee_master tfm ON tfm.id = ta.fee_master_id
        WHERE ta.staff_id = s.id
          AND LOWER(COALESCE(ta.status, '')) = 'active'
          AND ta.deleted_at IS NULL
          AND (ta.end_date IS NULL OR ta.end_date >= CURRENT_DATE)
        ORDER BY ta.id DESC
        LIMIT 1
      ) tr ON TRUE
      WHERE s.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Teacher not found');
    }

    const row = result.rows[0];
    const isAdmin = roleId != null && ADMIN_ROLE_IDS.includes(roleId);
    const isSelf = String(row?.user_id) === String(requester.id) || String(row?.staff_id) === String(requester.staff_id);
    if (!isAdmin && !isSelf) {
      return errorResponse(res, 403, 'Access denied. Insufficient permissions.');
    }

    const classTeacherParams = [row.staff_id];
    const classTeacherResult = await query(
      `SELECT
         c.id AS class_id,
         c.class_name,
         c.class_code,
         c.is_active
       FROM class_teachers ct
       INNER JOIN classes c ON c.id = ct.class_id
       WHERE ct.staff_id = $1
         AND ct.class_section_id IS NULL
         AND ct.deleted_at IS NULL
       ORDER BY c.class_name ASC`,
      classTeacherParams
    );

    const sectionTeacherParams = [row.staff_id];
    const sectionTeacherResult = await query(
      `SELECT
         csec.id AS section_id,
         sec.section_name,
         csec.is_active,
         csec.class_id,
         c.class_name,
         c.class_code
       FROM class_teachers ct
       INNER JOIN class_sections csec ON csec.id = ct.class_section_id
       INNER JOIN sections sec ON sec.id = csec.section_id
       INNER JOIN classes c ON c.id = csec.class_id
       WHERE ct.staff_id = $1
         AND ct.deleted_at IS NULL
       ORDER BY c.class_name ASC, sec.section_name ASC`,
      sectionTeacherParams
    );

    const subjectTeacherParams = [row.staff_id];
    const subjectTeacherResult = await query(
      `SELECT
         ta.id,
         c.class_name,
         c.class_code,
         sec.section_name,
         sub.subject_name,
         sub.subject_type
       FROM subject_teacher_assignments ta
       INNER JOIN classes c ON c.id = ta.class_id
       LEFT JOIN class_sections cs ON cs.id = ta.class_section_id
       LEFT JOIN sections sec ON sec.id = cs.section_id
       INNER JOIN class_subjects csub ON csub.id = ta.class_subject_id
       INNER JOIN subjects sub ON sub.id = csub.subject_id
       WHERE ta.staff_id = $1
         AND ta.deleted_at IS NULL
       ORDER BY c.class_name ASC, sec.section_name ASC, sub.subject_name ASC`,
      subjectTeacherParams
    );

    const enrichedRow = {
      ...row,
      class_teacher_of: classTeacherResult.rows.map((item) => ({
        classId: item.class_id,
        className: item.class_name,
        classCode: item.class_code,
        isActive: item.is_active,
      })),
      section_teacher_of: sectionTeacherResult.rows.map((item) => ({
        sectionId: item.section_id,
        sectionName: item.section_name,
        isActive: item.is_active,
        classId: item.class_id,
        className: item.class_name,
        classCode: item.class_code,
      })),
      subject_assignments: subjectTeacherResult.rows.map((item) => ({
        id: item.id,
        className: item.class_name,
        classCode: item.class_code,
        sectionName: item.section_name,
        subjectName: item.subject_name,
      })),
    };

    return success(res, 200, 'Teacher fetched successfully', enrichedRow);
  } catch (error) {
    console.error('Error fetching teacher:', error);
    return errorResponse(res, 500, 'Failed to fetch teacher');
  }
};

// Get teachers by class
const getTeachersByClass = async (req, res) => {
  try {
    const { classId } = req.params;

    const access = await canAccessClass(req, classId);
    if (!access.ok) {
      return errorResponse(res, access.status || 403, access.message || 'Access denied', 'FORBIDDEN');
    }

    const result = await query(`
      SELECT
        s.id,
        sta.class_id,
        sta.class_subject_id AS subject_id,
        s.father_name,
        s.mother_name,
        s.marital_status,
        s.languages_known,
        bg.blood_group_name AS blood_group,
        s.previous_school_name,
        s.previous_school_address,
        s.previous_school_phone,
        u.current_address,
        u.permanent_address,
        sal.pan_number,
        s.id_number,
        sal.bank_name,
        sal.branch,
        sal.ifsc_code AS ifsc,
        sal.contract_type,
        sal.shift,
        sal.work_location,
        u.facebook,
        u.twitter,
        u.linkedin,
        u.youtube,
        u.instagram,
        s.other_info,
        sal.account_name,
        sal.account_no AS account_number,
        s.status,
        s.created_at,
        s.resume,
        s.joining_letter,
        s.updated_at AS updated_at,
        s.id AS staff_id,
        s.user_id,
        s.employee_code,
        u.first_name,
        u.last_name,
        u.gender,
        u.date_of_birth,
        u.blood_group_id,
        u.phone,
        u.email,
        u.current_address AS address,
        s.emergency_contact_name,
        s.emergency_contact_phone,
        s.designation_id,
        s.department_id,
        s.joining_date,
        sal.basic_salary AS salary,
        s.qualification,
        s.experience_years,
        s.photo_url,
        u.is_active AS is_active,
        sal.epf_no,
        c.class_name,
        sub.subject_name
      FROM staff s
      INNER JOIN users u ON s.user_id = u.id
      LEFT JOIN blood_groups bg ON u.blood_group_id = bg.id
      LEFT JOIN LATERAL (
        SELECT * FROM staff_salary_assignments
        WHERE staff_id = s.id
        ORDER BY valid_period DESC LIMIT 1
      ) sal ON TRUE
      LEFT JOIN LATERAL (
        SELECT * FROM subject_teacher_assignments
        WHERE staff_id = s.id
        ORDER BY valid_period DESC LIMIT 1
      ) sta ON TRUE
      LEFT JOIN classes c ON sta.class_id = c.id
      LEFT JOIN subjects sub ON sta.class_subject_id = sub.id
      WHERE sta.class_id = $1
      ORDER BY u.first_name ASC, u.last_name ASC
    `, [classId]);

    return success(res, 200, 'Teachers fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching teachers by class:', error);
    return errorResponse(res, 500, 'Failed to fetch teachers');
  }
};

// Get teacher routine by teacher ID
const getTeacherRoutine = async (req, res) => {
  try {
    const { id } = req.params;
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    
    if (academicYearId == null || Number.isNaN(academicYearId) || academicYearId <= 0) {
      return errorResponse(res, 400, 'academic_year_id query parameter is required');
    }

    const teacherCheck = await query(
      `SELECT id FROM staff WHERE id = $1 AND (status IS NULL OR LOWER(TRIM(status)) = 'active')`,
      [id]
    );

    if (teacherCheck.rows.length === 0) {
      return errorResponse(res, 404, 'Teacher not found');
    }

    const staffId = parseId(teacherCheck.rows[0].id);
    if (!staffId) {
      return success(res, 200, 'Teacher routine fetched successfully', { routine: [], slots: [] });
    }

    const ctx = getAuthContext(req);
    if (!isAdmin(ctx)) {
      const myTeacherId = await resolveTeacherIdForUser(ctx.userId);
      if (!myTeacherId || myTeacherId !== parseId(id)) {
        return errorResponse(res, 403, 'You can only view your own routine');
      }
    }

    const slotsRes = await query(
      "SELECT id, slot_name, start_time, end_time, duration, is_break FROM timetable_time_slots WHERE is_active IS DISTINCT FROM false ORDER BY start_time ASC NULLS LAST, id ASC"
    );
    const slots = slotsRes.rows;

    const routineRes = await query(`
      SELECT 
        cs.id, cs.class_id, cs.class_section_id, cs.class_subject_id, cs.time_slot_id, cs.day_of_week, cs.class_room_id,
        c.class_name, sec.section_name, sub.subject_name, r.room_number,
        ts.slot_name, ts.start_time, ts.end_time, ts.is_break
      FROM class_schedules cs
      INNER JOIN timetable_time_slots ts ON ts.id = cs.time_slot_id
      LEFT JOIN classes c ON c.id = cs.class_id
      LEFT JOIN class_sections csec ON csec.id = cs.class_section_id
      LEFT JOIN sections sec ON sec.id = csec.section_id
      LEFT JOIN class_subjects csub ON csub.id = cs.class_subject_id
      LEFT JOIN subjects sub ON sub.id = csub.subject_id
      LEFT JOIN class_rooms r ON r.id = cs.class_room_id
      WHERE cs.teacher_id = $1 AND cs.academic_year_id = $2
    `, [staffId, academicYearId]);

    const routine = routineRes.rows.map(row => ({
      id: row.id,
      classId: row.class_id,
      className: row.class_name || '',
      sectionId: row.class_section_id,
      sectionName: row.section_name || '',
      subjectId: row.class_subject_id,
      subjectName: row.subject_name || '',
      timeSlotId: row.time_slot_id,
      slotName: row.slot_name,
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][row.day_of_week - 1] || 'Unknown',
      roomNumber: row.room_number || '—',
      startTime: row.start_time,
      endTime: row.end_time,
      isBreak: row.is_break,
      academicYearId: academicYearId
    }));

    return success(res, 200, 'Teacher routine fetched successfully', {
      routine,
      slots,
      count: routine.length
    });
  } catch (error) {
    console.error('Error fetching teacher routine:', error);
    return errorResponse(res, 500, 'Failed to fetch teacher routine', error.message);
  }
};

// Create teacher (staff + users + teachers) — Admin / Administrative only (route RBAC)
const createTeacher = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      first_name, last_name, email, phone, password,
      gender, date_of_birth, address,
      emergency_contact_name, emergency_contact_phone,
      designation_id, department_id, joining_date, salary, qualification, experience_years,
      blood_group_id,
      class_id, subject_id,
      father_name, mother_name, marital_status, languages_known,
      blood_group,
      previous_school_name, previous_school_address, previous_school_phone,
      current_address, permanent_address, pan_number, id_number,
      bank_name, branch, ifsc, contract_type, shift, work_location,
      facebook, twitter, linkedin,
      youtube, instagram, other_info,
      account_name, account_number, epf_no,
      employee_code: clientEmployeeCode,
      status, is_active,
    } = body;

    const fn = (first_name || '').toString().trim();
    const ln = (last_name || '').toString().trim();
    const em = (email || '').toString().trim();
    const ph = (phone || '').toString().trim();

    if (!fn || !ln) {
      return errorResponse(res, 400, 'First name and last name are required', 'VALIDATION_ERROR');
    }
    if (!em) {
      return errorResponse(res, 400, 'Email is required', 'VALIDATION_ERROR');
    }
    if (!ph) {
      return errorResponse(res, 400, 'Phone is required', 'VALIDATION_ERROR');
    }
    if (!isValidTeacherEmail(em)) {
      return errorResponse(res, 400, 'Invalid email format', 'VALIDATION_ERROR');
    }
    if (!isValidTeacherPhone(ph)) {
      return errorResponse(res, 400, 'Phone must contain 7–15 digits', 'VALIDATION_ERROR');
    }

    const pwdIn = password != null ? String(password).trim() : '';
    if (pwdIn && pwdIn.length < 6) {
      return errorResponse(res, 400, 'Password must be at least 6 characters', 'VALIDATION_ERROR');
    }

    const hasClassInput = class_id != null && String(class_id).trim() !== '';
    const hasSubjectInput = subject_id != null && String(subject_id).trim() !== '';
    if (hasClassInput !== hasSubjectInput) {
      return errorResponse(res, 400, 'Provide both class and subject, or omit both', 'VALIDATION_ERROR');
    }
    let classId = null;
    let subjectId = null;
    if (hasClassInput) {
      const ci = parseInt(class_id, 10);
      const si = parseInt(subject_id, 10);
      if (!ci || Number.isNaN(ci) || ci < 1) {
        return errorResponse(res, 400, 'Valid class is required when subject is set', 'VALIDATION_ERROR');
      }
      if (!si || Number.isNaN(si) || si < 1) {
        return errorResponse(res, 400, 'Valid subject is required when class is set', 'VALIDATION_ERROR');
      }
      classId = ci;
      subjectId = si;
    }

    const desigParsed = parsePositiveIntOrNull(designation_id);
    const deptParsed = parsePositiveIntOrNull(department_id);
    const bgParsed = parsePositiveIntOrNull(blood_group_id);
    if (desigParsed == null) {
      return errorResponse(res, 400, 'Designation is required', 'VALIDATION_ERROR');
    }
    if (deptParsed == null) {
      return errorResponse(res, 400, 'Department is required', 'VALIDATION_ERROR');
    }
    if (designation_id != null && designation_id !== '' && Number.isNaN(desigParsed)) {
      return errorResponse(res, 400, 'Invalid designation', 'VALIDATION_ERROR');
    }
    if (department_id != null && department_id !== '' && Number.isNaN(deptParsed)) {
      return errorResponse(res, 400, 'Invalid department', 'VALIDATION_ERROR');
    }
    if (blood_group_id != null && blood_group_id !== '' && Number.isNaN(bgParsed)) {
      return errorResponse(res, 400, 'Invalid blood group', 'VALIDATION_ERROR');
    }

    let isActiveBoolean = true;
    if (status === 'Inactive' || status === 'inactive') isActiveBoolean = false;
    else if (is_active === false || is_active === 'false' || is_active === 0) isActiveBoolean = false;

    const statusValue = isActiveBoolean ? 'Active' : 'Inactive';
    const genderNorm = normalizeGender(gender);
    const languagesArr = Array.isArray(languages_known)
      ? languages_known
      : (typeof languages_known === 'string'
        ? languages_known.split(',').map((s) => s.trim()).filter(Boolean)
        : null);

    const desigId = desigParsed;
    const deptId = deptParsed;
    const bgId = bgParsed;
    const expYears = experience_years != null && experience_years !== '' ? parseInt(experience_years, 10) : null;
    const salaryNum = salary != null && salary !== '' ? parseFloat(salary) : null;

    const panVal = pan_number != null && String(pan_number).trim() !== '' ? String(pan_number).trim() : null;
    const bgText = (blood_group != null && String(blood_group).trim() !== '')
      ? String(blood_group).trim()
      : 'UNKNOWN';

    const addr = (address || '').toString().trim() || null;
    const currAddr = (current_address || addr || '').toString().trim() || null;
    const permAddr = (permanent_address || '').toString().trim() || null;

    const createdBy = req.user?.id != null ? parseInt(req.user.id, 10) : null;
    const resolvedAyCreate = await resolveAcademicYearId(body.academic_year_id);

    // Single DB transaction: staff INSERT → user INSERT → teachers INSERT.
    // executeTransaction runs BEGIN / COMMIT or ROLLBACK on any failure — no partial teacher rows.
    const teacherRow = await executeTransaction(async (client) => {
      if (classId != null && subjectId != null) {
        const clsOk = await client.query('SELECT 1 FROM classes WHERE id = $1 LIMIT 1', [classId]);
        if (!clsOk.rows.length) {
          const err = new Error('Selected class does not exist or is no longer available.');
          err.teacherInputError = { status: 400, code: 'INVALID_CLASS' };
          throw err;
        }
        const subOk = await client.query(
          `SELECT 1 FROM subjects WHERE id = $1 AND (class_id IS NULL OR class_id = $2) LIMIT 1`,
          [subjectId, classId]
        );
        if (!subOk.rows.length) {
          const err = new Error('Selected subject is not valid for the chosen class.');
          err.teacherInputError = { status: 400, code: 'INVALID_SUBJECT' };
          throw err;
        }
      }

      const customCode = (clientEmployeeCode || '').toString().trim().slice(0, 20);
      let employeeCode = customCode;
      if (!employeeCode) {
        employeeCode = `TMP${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20);
      }

      const userId = await createTeacherUser(client, {
        email: em,
        phone: ph,
        first_name: fn,
        last_name: ln,
        password,
        gender: genderNorm,
        date_of_birth,
        blood_group_id: bgId,
        current_address: currAddr,
        permanent_address: permAddr,
        facebook,
        twitter,
        linkedin,
        youtube,
        instagram,
      });
      if (!userId) {
        const err = new Error('Failed to create login account for teacher');
        err.statusCode = 500;
        throw err;
      }

      const staffIns = await client.query(
        `INSERT INTO staff (
          user_id, employee_code, marital_status, father_name, mother_name,
          id_number, emergency_contact_name, emergency_contact_phone,
          designation_id, department_id, joining_date, qualification, experience_years,
          languages_known, other_info, previous_school_name, previous_school_address,
          previous_school_phone, status, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW()
        ) RETURNING id`,
        [
          userId,
          employeeCode,
          marital_status || null,
          father_name || null,
          mother_name || null,
          id_number || null,
          emergency_contact_name || null,
          emergency_contact_phone || null,
          desigId && !Number.isNaN(desigId) ? desigId : null,
          deptId && !Number.isNaN(deptId) ? deptId : null,
          joining_date || null,
          qualification || null,
          expYears != null && !Number.isNaN(expYears) ? expYears : null,
          languagesArr,
          other_info || null,
          previous_school_name || null,
          previous_school_address || null,
          previous_school_phone || null,
          statusValue,
          createdBy && !Number.isNaN(createdBy) ? createdBy : null,
        ]
      );
      const staffId = staffIns.rows[0].id;
      if (!customCode) {
        const finalCode = (`TCH${staffId}`).slice(0, 20);
        await client.query(`UPDATE staff SET employee_code = $1 WHERE id = $2`, [finalCode, staffId]);
      }

      // Insert salary assignment
      await client.query(
        `INSERT INTO staff_salary_assignments (
          staff_id, basic_salary, epf_no, pan_number, bank_name, account_name, account_no, branch, ifsc_code,
          contract_type, shift, work_location, valid_period, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, daterange(CURRENT_DATE, NULL, '[)'), NOW(), NOW()
        )`,
        [
          staffId,
          salaryNum || 0,
          epf_no || null,
          panVal,
          bank_name || null,
          account_name || null,
          account_number || null,
          branch || null,
          ifsc || null,
          contract_type || null,
          shift || null,
          work_location || null,
        ]
      );

      // Insert subject teacher assignment
      if (classId && subjectId) {
        await client.query(
          `INSERT INTO subject_teacher_assignments (
            staff_id, class_id, class_subject_id, academic_year_id, valid_period, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, daterange(CURRENT_DATE, NULL, '[)'), NOW(), NOW()
          )`,
          [staffId, classId, subjectId, resolvedAyCreate]
        );
      }


      return { teacherId: staffId, staffId };
    });

    let payload;
    try {
      const full = await query(
        `
      SELECT
        s.id,
        sta.class_id,
        sta.class_subject_id AS subject_id,
        s.father_name,
        s.mother_name,
        s.marital_status,
        s.languages_known,
        bg.blood_group_name AS blood_group,
        s.previous_school_name,
        s.previous_school_address,
        s.previous_school_phone,
        u.current_address,
        u.permanent_address,
        sal.pan_number,
        s.id_number,
        sal.bank_name,
        sal.branch,
        sal.ifsc_code AS ifsc,
        sal.contract_type,
        sal.shift,
        sal.work_location,
        u.facebook,
        u.twitter,
        u.linkedin,
        u.youtube,
        u.instagram,
        s.other_info,
        sal.account_name,
        sal.account_no AS account_number,
        s.status,
        s.created_at,
        s.resume,
        s.joining_letter,
        s.updated_at AS updated_at,
        s.id AS staff_id,
        s.user_id,
        s.employee_code,
        u.first_name,
        u.last_name,
        u.gender,
        u.date_of_birth,
        u.blood_group_id,
        u.phone,
        u.email,
        u.current_address AS address,
        s.emergency_contact_name,
        s.emergency_contact_phone,
        s.designation_id,
        s.department_id,
        s.joining_date,
        sal.basic_salary AS salary,
        s.qualification,
        s.experience_years,
        s.photo_url,
        u.is_active AS is_active,
        sal.epf_no,
        c.class_name,
        sub.subject_name
      FROM staff s
      INNER JOIN users u ON s.user_id = u.id
      LEFT JOIN blood_groups bg ON u.blood_group_id = bg.id
      LEFT JOIN LATERAL (
        SELECT * FROM staff_salary_assignments
        WHERE staff_id = s.id
        ORDER BY valid_period DESC LIMIT 1
      ) sal ON TRUE
      LEFT JOIN LATERAL (
        SELECT * FROM subject_teacher_assignments
        WHERE staff_id = s.id
        ORDER BY valid_period DESC LIMIT 1
      ) sta ON TRUE
      LEFT JOIN classes c ON sta.class_id = c.id
      LEFT JOIN subjects sub ON sta.class_subject_id = sub.id
      WHERE s.id = $1
    `,
        [teacherRow.staffId]
      );
      payload = full.rows[0] || { id: teacherRow.staffId };
    } catch (readErr) {
      console.error('Teacher created but failed to load full row:', readErr);
      payload = { id: teacherRow.staffId };
    }

    return success(res, 201, 'Teacher created successfully', payload);
  } catch (error) {
    console.error('Error creating teacher:', error);
    if (error.teacherInputError) {
      return errorResponse(
        res,
        error.teacherInputError.status,
        error.message,
        error.teacherInputError.code,
      );
    }
    if (error.code === '23505') {
      return errorResponse(
        res,
        409,
        mapUniqueConstraintToMessage(error.constraint),
        'CONFLICT'
      );
    }
    if (error.code === '23503') {
      return errorResponse(res, 400, 'Invalid class, subject, or related reference', 'FK_VIOLATION');
    }
    return errorResponse(res, 500, `Failed to create teacher: ${error.message}`, 'INTERNAL_ERROR');
  }
};

// Update teacher (full update: staff + teachers tables)
const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const teacherIdNum = parseInt(id, 10);
    if (!teacherIdNum || Number.isNaN(teacherIdNum)) {
      return errorResponse(res, 400, 'Invalid teacher ID', 'VALIDATION_ERROR');
    }
    const {
      status, is_active,
      first_name, last_name, gender, date_of_birth, phone, email, address,
      emergency_contact_name, emergency_contact_phone, designation_id, department_id,
      joining_date, salary, qualification, experience_years,
      class_id, subject_id, father_name, mother_name, marital_status, languages_known,
      blood_group, blood_group_id, previous_school_name, previous_school_address, previous_school_phone,
      current_address, permanent_address, pan_number, id_number,
      bank_name, branch, ifsc, account_name, account_number, epf_no, contract_type, shift, work_location,
      facebook, twitter, linkedin, youtube, instagram, other_info, photo_url
    } = req.body;

    let isActiveBoolean = false;
    if (status === 'Active' || status === 'active') isActiveBoolean = true;
    else if (status === 'Inactive' || status === 'inactive') isActiveBoolean = false;
    else if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 't' || is_active === 'T') isActiveBoolean = true;
    else if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'f' || is_active === 'F') isActiveBoolean = false;

    if (email !== undefined && email !== null) {
      const eTrim = String(email).trim();
      if (eTrim && !isValidTeacherEmail(eTrim)) {
        return errorResponse(res, 400, 'Invalid email format', 'VALIDATION_ERROR');
      }
    }
    if (phone !== undefined && phone !== null) {
      const pTrim = String(phone).trim();
      if (pTrim && !isValidTeacherPhone(pTrim)) {
        return errorResponse(res, 400, 'Invalid phone number', 'VALIDATION_ERROR');
      }
    }

    const staffCheck = await query(
      `SELECT s.id AS staff_id, s.user_id, s.photo_url 
       FROM staff s
       WHERE s.id = $1`,
      [teacherIdNum]
    );
    if (staffCheck.rows.length === 0) {
      return errorResponse(res, 404, 'Teacher (staff) not found');
    }
    const { staff_id: staffId, user_id: userId, photo_url: existingPhoto } = staffCheck.rows[0];
    const statusValue = isActiveBoolean ? 'Active' : 'Inactive';

    const languagesArr = Array.isArray(languages_known) ? languages_known : (typeof languages_known === 'string' ? languages_known.split(',').map(s => s.trim()).filter(Boolean) : null);

    const result = await executeTransaction(async (client) => {
      // 1. Update User info
      if (first_name != null || last_name != null || gender != null || date_of_birth != null ||
          phone != null || email != null || facebook != null || twitter != null || linkedin != null || youtube != null || instagram != null || address != null || permanent_address != null || current_address != null || blood_group_id != null) {
        
        const userUpdates = [];
        const userParams = [];
        let uIdx = 1;
        const addU = (col, val) => { if (val !== undefined && val !== null) { userUpdates.push(`${col} = $${uIdx}`); userParams.push(val); uIdx++; } };
        
        addU('first_name', first_name);
        addU('last_name', last_name);
        if (gender !== undefined && gender !== null && String(gender).trim() !== '') {
          const gn = normalizeGender(gender);
          if (gn) addU('gender', gn);
        }
        addU('date_of_birth', date_of_birth);
        addU('phone', phone);
        addU('email', email);
        addU('current_address', current_address || address);
        addU('permanent_address', permanent_address);
        addU('facebook', facebook);
        addU('twitter', twitter);
        addU('linkedin', linkedin);
        addU('youtube', youtube);
        addU('instagram', instagram);
        addU('blood_group_id', blood_group_id || null);
        userUpdates.push(`updated_at = NOW()`);

        if (userUpdates.length > 0 && userId) {
          userParams.push(userId);
          await client.query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = $${uIdx}`, userParams);
        }
      }

      // 2. Update Staff info
      if (emergency_contact_name != null || emergency_contact_phone != null || designation_id != null || 
          department_id != null || joining_date != null || qualification != null || experience_years != null || 
          photo_url !== undefined || statusValue != null || father_name != null || mother_name != null || 
          marital_status != null || languagesArr != null || other_info != null || id_number != null || 
          previous_school_name != null || previous_school_address != null || previous_school_phone != null || is_active !== undefined) {

        const staffUpdates = [];
        const staffParams = [];
        let sIdx = 1;
        const addS = (col, val) => { if (val !== undefined && val !== null) { staffUpdates.push(`${col} = $${sIdx}`); staffParams.push(val); sIdx++; } };
        
        addS('emergency_contact_name', emergency_contact_name);
        addS('emergency_contact_phone', emergency_contact_phone);
        addS('designation_id', designation_id || null);
        addS('department_id', department_id || null);
        addS('joining_date', joining_date);
        addS('qualification', qualification);
        addS('experience_years', experience_years != null ? parseInt(experience_years, 10) : null);
        addS('father_name', father_name);
        addS('mother_name', mother_name);
        addS('marital_status', marital_status);
        addS('languages_known', languagesArr);
        addS('other_info', other_info);
        addS('id_number', id_number);
        addS('previous_school_name', previous_school_name);
        addS('previous_school_address', previous_school_address);
        addS('previous_school_phone', previous_school_phone);
        addS('status', statusValue);

        if (photo_url !== undefined) {
          addS('photo_url', (photo_url || '').toString().trim().slice(0, 500) || null);
        }
        staffUpdates.push(`updated_at = NOW()`);

        if (staffUpdates.length > 0) {
          staffParams.push(staffId);
          await client.query(`UPDATE staff SET ${staffUpdates.join(', ')} WHERE id = $${sIdx}`, staffParams);

          if (photo_url !== undefined && existingPhoto && existingPhoto !== photo_url) {
            const { deleteFileIfExist } = require('../utils/fileDeleteHelper');
            await deleteFileIfExist(existingPhoto);
          }
        }
      }

      // 3. Handle Salary / Bank info updates
      if (salary != null || epf_no != null || pan_number != null || bank_name != null || account_name != null || 
          account_number != null || branch != null || ifsc != null || contract_type != null || shift != null || work_location != null) {
        
        const panVal = (pan_number || '').toString().trim().toUpperCase().slice(0, 10);
        
        // Update existing or create new salary assignment
        const existingSal = await client.query(
          `SELECT id FROM staff_salary_assignments WHERE staff_id = $1 AND valid_period @> CURRENT_DATE LIMIT 1`,
          [staffId]
        );

        if (existingSal.rows.length > 0) {
          const salId = existingSal.rows[0].id;
          const salUpdates = [];
          const salParams = [];
          let salIdx = 1;
          const addSal = (col, val) => { if (val !== undefined && val !== null) { salUpdates.push(`${col} = $${salIdx}`); salParams.push(val); salIdx++; } };
          
          addSal('basic_salary', salary);
          addSal('epf_no', epf_no);
          addSal('pan_number', panVal);
          addSal('bank_name', bank_name);
          addSal('account_name', account_name);
          addSal('account_no', account_number);
          addSal('branch', branch);
          addSal('ifsc_code', ifsc);
          addSal('contract_type', contract_type);
          addSal('shift', shift);
          addSal('work_location', work_location);
          salUpdates.push(`updated_at = NOW()`);

          if (salUpdates.length > 0) {
            salParams.push(salId);
            await client.query(`UPDATE staff_salary_assignments SET ${salUpdates.join(', ')} WHERE id = $${salIdx}`, salParams);
          }
        } else {
          await client.query(
            `INSERT INTO staff_salary_assignments (
              staff_id, basic_salary, epf_no, pan_number, bank_name, account_name, account_no, branch, ifsc_code,
              contract_type, shift, work_location, valid_period, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, daterange(CURRENT_DATE, NULL, '[)'), NOW(), NOW()
            )`,
            [staffId, salary || 0, epf_no || null, panVal, bank_name || null, account_name || null, account_number || null, branch || null, ifsc || null, contract_type || null, shift || null, work_location || null]
          );
        }
      }

      // 4. Handle Class/Subject assignment updates
      if (class_id !== undefined || subject_id !== undefined) {
        const existingSta = await client.query(
          `SELECT id FROM subject_teacher_assignments WHERE staff_id = $1 AND valid_period @> CURRENT_DATE LIMIT 1`,
          [staffId]
        );

        if (existingSta.rows.length > 0) {
          const staId = existingSta.rows[0].id;
          const staUpdates = [];
          const staParams = [];
          let staIdx = 1;
          if (class_id !== undefined) { staUpdates.push(`class_id = $${staIdx}`); staParams.push(class_id); staIdx++; }
          if (subject_id !== undefined) { staUpdates.push(`class_subject_id = $${staIdx}`); staParams.push(subject_id); staIdx++; }
          
          if (staUpdates.length > 0) {
            staParams.push(staId);
            await client.query(`UPDATE subject_teacher_assignments SET ${staUpdates.join(', ')}, updated_at = NOW() WHERE id = $${staIdx}`, staParams);
          }
        } else if (class_id && subject_id) {
          const ayId = await resolveAcademicYearForTeacher(req);
          await client.query(
            `INSERT INTO subject_teacher_assignments (staff_id, class_id, class_subject_id, academic_year_id, valid_period, created_at, updated_at)
             VALUES ($1, $2, $3, $4, daterange(CURRENT_DATE, NULL, '[)'), NOW(), NOW())`,
            [staffId, class_id, subject_id, ayId]
          );
        }
      }

      // Fetch final record
      const full = await client.query(
        `
        SELECT
          s.id,
          sta.class_id,
          sta.class_subject_id AS subject_id,
          s.father_name,
          s.mother_name,
          s.marital_status,
          s.languages_known,
          bg.blood_group_name AS blood_group,
          s.previous_school_name,
          s.previous_school_address,
          s.previous_school_phone,
          u.current_address,
          u.permanent_address,
          sal.pan_number,
          s.id_number,
          sal.bank_name,
          sal.branch,
          sal.ifsc_code AS ifsc,
          sal.contract_type,
          sal.shift,
          sal.work_location,
          u.facebook,
          u.twitter,
          u.linkedin,
          u.youtube,
          u.instagram,
          s.other_info,
          sal.account_name,
          sal.account_no AS account_number,
          s.status,
          s.created_at,
          s.updated_at AS updated_at,
          s.id AS staff_id,
          s.user_id,
          s.employee_code,
          u.first_name,
          u.last_name,
          u.gender,
          u.date_of_birth,
          u.blood_group_id,
          u.phone,
          u.email,
          u.current_address AS address,
          s.emergency_contact_name,
          s.emergency_contact_phone,
          s.designation_id,
          s.department_id,
          s.joining_date,
          sal.basic_salary AS salary,
          s.qualification,
          s.experience_years,
          s.photo_url,
          u.is_active AS is_active,
          sal.epf_no,
          s.resume,
          s.joining_letter,
          c.class_name,
          sub.subject_name
        FROM staff s
        INNER JOIN users u ON s.user_id = u.id
        LEFT JOIN blood_groups bg ON u.blood_group_id = bg.id
        LEFT JOIN LATERAL (
          SELECT * FROM staff_salary_assignments
          WHERE staff_id = s.id
          ORDER BY valid_period DESC LIMIT 1
        ) sal ON TRUE
        LEFT JOIN LATERAL (
          SELECT * FROM subject_teacher_assignments
          WHERE staff_id = s.id
          ORDER BY valid_period DESC LIMIT 1
        ) sta ON TRUE
        LEFT JOIN classes c ON sta.class_id = c.id
        LEFT JOIN subjects sub ON sta.class_subject_id = sub.id
        WHERE s.id = $1
      `,
        [staffId]
      );
      return full.rows[0];
    });

    return success(res, 200, 'Teacher updated successfully', result);
  } catch (error) {
    console.error('Error updating teacher:', error);
    if (error.code === '23505') {
      return errorResponse(
        res,
        409,
        mapUniqueConstraintToMessage(error.constraint),
        'CONFLICT'
      );
    }
    if (error.code === '23503') {
      return errorResponse(res, 400, 'Invalid reference data', 'FK_VIOLATION');
    }
    return errorResponse(res, 500, 'Failed to update teacher', 'INTERNAL_ERROR');
  }
};

// Get attendance for students in teacher's classes (for Teacher Dashboard)
const getTeacherClassAttendance = async (req, res) => {
  try {
    const teacherId = parseInt(req.params.id, 10);
    if (!teacherId || Number.isNaN(teacherId)) {
      return errorResponse(res, 400, 'Invalid teacher ID');
    }
    const userId = req.user?.id;
    const roleId = req.user?.role_id != null ? parseInt(req.user.role_id, 10) : null;
    const ROLES = require('../config/roles').ROLES;
    if (roleId === ROLES.TEACHER && userId) {
      const ownStaff = await query('SELECT s.id FROM staff s WHERE s.user_id = $1 LIMIT 1', [userId]);
      if (ownStaff.rows.length > 0 && parseInt(ownStaff.rows[0].id, 10) !== teacherId) {
        return errorResponse(res, 403, 'Access denied', 'FORBIDDEN');
      }
    }

    const staffCheck = await query('SELECT id FROM staff WHERE id = $1', [teacherId]);
    if (!staffCheck.rows.length) {
      return errorResponse(res, 404, 'Teacher (staff) not found');
    }
    const staffId = teacherId;

    const days = parseInt(req.query.days, 10);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    const hasAcademicYearFilter = academicYearId != null && !Number.isNaN(academicYearId);
    let dateFilter = '';
    // $1 = staff id for class_schedules.teacher_id; $2 = teachers.id for homeroom class match
    let params = [staffId, teacherId];
    if (days > 0 && days <= 365) {
      if (offset > 0) {
        dateFilter = `AND a.attendance_date >= CURRENT_DATE - ($3 + $4) * INTERVAL '1 day'
                      AND a.attendance_date < CURRENT_DATE - $4 * INTERVAL '1 day'`;
        params = [staffId, teacherId, days, offset];
      } else {
        dateFilter = `AND a.attendance_date >= CURRENT_DATE - $3 * INTERVAL '1 day'`;
        params = [staffId, teacherId, days];
      }
    }
    if (hasAcademicYearFilter) {
      params.push(academicYearId);
    }
    const rowLimit = days === 0 ? 5000 : 500; // All Time: higher limit to fetch more records
    const academicYearFilter = hasAcademicYearFilter ? `AND s.academic_year_id = $${params.length}` : '';

    // Use EXISTS to avoid duplicates; include BOTH class_schedules (staff id) AND class_teachers/subject_teacher_assignments
    const result = await query(
      `SELECT a.id, a.student_id, a.class_id, a.section_id, a.attendance_date, a.status,
              a.check_in_time, a.check_out_time, a.marked_by, a.remarks
       FROM student_attendance a
       INNER JOIN students s ON a.student_id = s.id AND s.status = 'Active'
       WHERE (
         EXISTS (
           SELECT 1 FROM class_schedules cs
           WHERE cs.teacher_id = $1
             AND cs.class_id = a.class_id
             AND (cs.section_id = a.section_id OR cs.section_id IS NULL)
         )
         OR EXISTS (
           SELECT 1 FROM class_teachers ct
           WHERE ct.staff_id = $1 AND ct.class_id = a.class_id
             AND (ct.class_section_id = a.section_id OR ct.class_section_id IS NULL)
             AND (ct.valid_period @> CURRENT_DATE)
         )
         OR EXISTS (
           SELECT 1
           FROM subject_teacher_assignments sta
           WHERE sta.staff_id = $1
             AND sta.class_id = a.class_id
             AND (sta.valid_period @> CURRENT_DATE)
         )
       )
       ${academicYearFilter}
       ${dateFilter}
       ORDER BY a.attendance_date DESC
       LIMIT ${rowLimit}`,
      params
    );

    const normalizeStatus = (s) => {
      const v = (s || '').toString().trim().toLowerCase().replace(/\s+/g, '_');
      if (v === 'half_day' || v === 'halfday' || v === 'half' || v === 'half_day') return 'half_day';
      if (v === 'absent' || v === 'absence' || v === 'a' || v === 'ab') return 'absent';
      if (v === 'present' || v === 'p' || v === 'pres') return 'present';
      if (v === 'late' || v === 'l') return 'late';
      return v;
    };

    const records = result.rows.map((r) => {
      const status = normalizeStatus(r.status);
      return {
        id: r.id,
        studentId: r.student_id,
        classId: r.class_id,
        sectionId: r.section_id,
        attendanceDate: r.attendance_date,
        status,
        checkInTime: r.check_in_time,
        checkOutTime: r.check_out_time,
        markedBy: r.marked_by,
        remark: r.remarks,
      };
    });

    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;
    const halfDay = records.filter((r) => r.status === 'half_day' || r.status === 'halfday').length;
    const late = records.filter((r) => r.status === 'late').length;

    return success(res, 200, 'Teacher class attendance fetched successfully', {
      records,
      summary: { present, absent, halfDay, late },
    });
  } catch (error) {
    console.error('Error fetching teacher class attendance:', error);
    return errorResponse(res, 500, 'Failed to fetch teacher class attendance');
  }
};

function unlinkTeacherDocStored(relPath) {
  const abs = resolveTeacherDocumentPath(relPath);
  if (!abs) return;
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    console.error('unlinkTeacherDocStored:', e);
  }
}

function unlinkMulterTemp(file) {
  if (!file?.path) return;
  try {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  } catch (e) {
    console.error('unlinkMulterTemp:', e);
  }
}

const uploadTeacherDocuments = async (req, res) => {
  try {
    const teacherId = parseInt(req.params.id, 10);
    if (!teacherId || Number.isNaN(teacherId)) {
      return errorResponse(res, 400, 'Invalid teacher ID', 'VALIDATION_ERROR');
    }

    const resumeArr = req.files?.resume;
    const letterArr = req.files?.joining_letter;
    const resumeFile = Array.isArray(resumeArr) && resumeArr[0] ? resumeArr[0] : null;
    const letterFile = Array.isArray(letterArr) && letterArr[0] ? letterArr[0] : null;

    if (!resumeFile && !letterFile) {
      return errorResponse(res, 400, 'No files uploaded. Use multipart fields resume and/or joining_letter.', 'VALIDATION_ERROR');
    }

    const dbName = req.tenant?.db_name;
    if (!dbName || !String(dbName).trim()) {
      if (resumeFile) unlinkMulterTemp(resumeFile);
      if (letterFile) unlinkMulterTemp(letterFile);
      return errorResponse(res, 500, 'Tenant context missing', 'CONFIG_ERROR');
    }

    // Re-bind tenant so query() hits the correct school DB (not primary fallback).
    return await runWithTenant(dbName, async () => {
      const tenant = sanitizeTenant(req.tenant?.db_name || dbName || 'default_tenant') || 'default_tenant';

      const prev = await query('SELECT resume, joining_letter FROM staff WHERE id = $1', [teacherId]);
      if (!prev.rows.length) {
        if (resumeFile) unlinkMulterTemp(resumeFile);
        if (letterFile) unlinkMulterTemp(letterFile);
        return errorResponse(res, 404, 'Teacher (staff) not found', 'NOT_FOUND');
      }

      const oldResume = prev.rows[0].resume;
      const oldLetter = prev.rows[0].joining_letter;

      const newResumeRel = resumeFile ? `${tenant}/${resumeFile.filename}` : null;
      const newLetterRel = letterFile ? `${tenant}/${letterFile.filename}` : null;

      const upd = await query(
        `UPDATE staff SET
          resume = COALESCE($1, resume),
          joining_letter = COALESCE($2, joining_letter),
          updated_at = NOW()
        WHERE id = $3`,
        [newResumeRel, newLetterRel, teacherId]
      );

      if (upd.rowCount < 1) {
        if (resumeFile) unlinkMulterTemp(resumeFile);
        if (letterFile) unlinkMulterTemp(letterFile);
        return errorResponse(res, 404, 'Teacher (staff) not found or could not update', 'NOT_FOUND');
      }

      if (resumeFile && oldResume && oldResume !== newResumeRel) unlinkTeacherDocStored(oldResume);
      if (letterFile && oldLetter && oldLetter !== newLetterRel) unlinkTeacherDocStored(oldLetter);

      const refreshed = await query(
        `SELECT resume, joining_letter, updated_at FROM staff WHERE id = $1`,
        [teacherId]
      );
      return success(res, 200, 'Documents uploaded successfully', refreshed.rows[0] || {});
    });
  } catch (error) {
    console.error('uploadTeacherDocuments:', error);
    return errorResponse(res, 500, 'Failed to upload documents', 'INTERNAL_ERROR');
  }
};

const getTeacherDocument = async (req, res) => {
  try {
    const teacherId = parseInt(req.params.id, 10);
    const docTypeRaw = String(req.params.docType || '').toLowerCase();
    if (!teacherId || Number.isNaN(teacherId)) {
      return errorResponse(res, 400, 'Invalid teacher ID', 'VALIDATION_ERROR');
    }
    const column = docTypeRaw === 'joining-letter' ? 'joining_letter' : docTypeRaw === 'resume' ? 'resume' : null;
    if (!column) {
      return errorResponse(res, 400, 'Invalid document type', 'VALIDATION_ERROR');
    }

    const requester = req.user;
    const roleId = requester?.role_id != null ? parseInt(requester.role_id, 10) : null;
    if (!requester?.id || roleId == null) {
      return errorResponse(res, 401, 'Not authenticated');
    }

    const dbName = req.tenant?.db_name;
    if (!dbName || !String(dbName).trim()) {
      return errorResponse(res, 500, 'Tenant context missing', 'CONFIG_ERROR');
    }

    return await runWithTenant(dbName, async () => {
      const result = await query(
        `SELECT s.${column} AS doc_path, s.user_id, s.id AS staff_id
         FROM staff s
         WHERE s.id = $1`,
        [teacherId]
      );

      if (!result.rows.length) {
        return errorResponse(res, 404, 'Teacher not found');
      }

      const row = result.rows[0];
      const isAdmin = roleId != null && ADMIN_ROLE_IDS.includes(roleId);
      const isSelf = String(row.user_id) === String(requester.id);
      const staffIdMatch = requester.staff_id != null && String(row.staff_id) === String(requester.staff_id);
      if (!isAdmin && !isSelf && !staffIdMatch) {
        return errorResponse(res, 403, 'Access denied. Insufficient permissions.');
      }

      const rel = row.doc_path;
      const abs = resolveTeacherDocumentPath(rel);
      if (!abs || !fs.existsSync(abs)) {
        return errorResponse(res, 404, 'Document not found or file missing');
      }

      const downloadName = column === 'joining_letter' ? 'joining-letter.pdf' : 'resume.pdf';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`);
      return res.sendFile(abs);
    });
  } catch (error) {
    console.error('getTeacherDocument:', error);
    return errorResponse(res, 500, 'Failed to load document', 'INTERNAL_ERROR');
  }
};

module.exports = {
  getAllTeachers,
  getCurrentTeacher,
  getTeacherById,
  getTeachersByClass,
  getTeacherRoutine,
  getTeacherClassAttendance,
  createTeacher,
  updateTeacher,
  uploadTeacherDocuments,
  getTeacherDocument,
};
