const { query, executeTransaction } = require('../config/database');
const { getParentsForUser } = require('../utils/parentUserMatch');
const { ROLES } = require('../config/roles');
const { jsonSafeRow } = require('../utils/jsonSafeRow');
const { canAccessStudent } = require('../utils/accessControl');

const VALID_FINAL_LEAVE_STATUSES = new Set(['approved', 'rejected', 'cancelled']);

async function resolveActorStaffId(userId) {
  if (!userId) return null;
  const actorStaff = await query('SELECT id FROM staff WHERE user_id = $1 LIMIT 1', [userId]);
  return actorStaff.rows[0]?.id || null;
}

async function resolveTeacherScopeIds(userId) {
  if (!userId) return { teacherIds: [], staffIds: [] };
  const staffRes = await query(
    `SELECT id
     FROM staff
     WHERE user_id = $1
       AND is_active = true
     LIMIT 1`,
    [userId]
  );
  const actorStaffId = Number(staffRes.rows?.[0]?.id);
  const teacherRes = await query(
    `SELECT t.id, t.staff_id
     FROM teachers t
     INNER JOIN staff st ON st.id = t.staff_id
     WHERE st.user_id = $1
       AND st.is_active = true`,
    [userId]
  );
  const staffIds = (teacherRes.rows || [])
    .map((r) => Number(r.staff_id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (Number.isFinite(actorStaffId) && actorStaffId > 0) {
    staffIds.push(actorStaffId);
  }
  return {
    teacherIds: [...new Set((teacherRes.rows || []).map((r) => Number(r.id)).filter((id) => Number.isFinite(id) && id > 0))],
    staffIds: [...new Set(staffIds)],
  };
}

// Seed leave types if table is empty (handles case when migration seed didn't run)
const seedLeaveTypesIfEmpty = async () => {
  let check;
  try {
    check = await query('SELECT COUNT(*) AS c FROM leave_types');
  } catch (e) {
    // Tenant schema might not have leave_types yet (new/empty school DB).
    // In that case we can't seed; caller should handle gracefully.
    return;
  }
  if (parseInt(check.rows[0]?.c || '0', 10) > 0) return;
  const types = [
    ['Medical Leave', 'Leave for medical reasons', 10],
    ['Casual Leave', 'Casual leave', 12],
    ['Special Leave', 'Special leave', 5],
    ['Maternity Leave', 'Maternity leave', 90],
    ['Paternity Leave', 'Paternity leave', 15],
    ['Emergency Leave', 'Emergency situations', 5],
  ];
  for (const [lt, desc, maxDays] of types) {
    await query(
      'INSERT INTO leave_types (leave_type, description, max_days) VALUES ($1, $2, $3) ON CONFLICT (leave_type) DO NOTHING',
      [lt, desc, maxDays]
    );
  }
};

// Get all leave types from leave_types table
const getLeaveTypes = async (req, res) => {
  try {
    await seedLeaveTypesIfEmpty();
    let result;
    try {
      result = await query(
        `SELECT id, leave_type, max_days, max_days AS max_days_per_year
         FROM leave_types
         WHERE is_active = true
         ORDER BY leave_type`
      );
    } catch (e) {
      // If the tenant DB doesn't have this table yet, don't break the dashboard.
      // Return an empty list; UI can still render.
      return res.status(200).json({
        status: 'SUCCESS',
        message: 'Leave types fetched successfully',
        data: [],
        count: 0,
      });
    }
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Leave types fetched successfully',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch leave types',
    });
  }
};

// Create leave application (student or staff)
const createLeaveApplication = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }
    const { leave_type_id, student_id, staff_id, start_date, end_date, reason, emergency_contact } = req.body;

    if (!leave_type_id || !start_date || !end_date) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Leave type, start date and end date are required',
      });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Reason is required',
      });
    }
    if (!student_id && !staff_id) {
      const staffByUser = await query('SELECT id FROM staff WHERE user_id = $1 LIMIT 1', [userId]);
      if (staffByUser.rows.length > 0) {
        req.body.staff_id = staffByUser.rows[0].id;
      } else {
        return res.status(400).json({
          status: 'ERROR',
          message: 'Either student_id or staff_id is required',
        });
      }
    }
    let reqStaffId = req.body.staff_id ?? staff_id;
    let reqStudentId = student_id;

    if (reqStudentId && reqStaffId) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Provide only student_id OR staff_id, not both',
      });
    }

    let resolvedStudentId = null;
    let resolvedStaffId = null;

    if (reqStudentId) {
      const studCheck = await query(
        'SELECT id FROM students WHERE id = $1 AND user_id = $2',
        [reqStudentId, userId]
      );
      if (studCheck.rows.length === 0) {
        const parentCheck = await getParentsForUser(userId);
        const childIds = parentCheck.studentIds || [];
        if (!childIds.includes(Number(reqStudentId))) {
          const guardianCheck = await query(
            `SELECT student_id FROM guardians g
             WHERE g.user_id = $1 AND g.student_id = $2`,
            [userId, reqStudentId]
          );
          if (guardianCheck.rows.length === 0) {
            return res.status(403).json({
              status: 'ERROR',
              message: 'You can only apply leave for your own or your children/wards',
            });
          }
        }
      }
      resolvedStudentId = reqStudentId;
    } else {
      const staffCheck = await query(
        'SELECT id FROM staff WHERE id = $1 AND user_id = $2',
        [reqStaffId, userId]
      );
      if (staffCheck.rows.length === 0) {
        const teacherCheck = await query(
          'SELECT s.id FROM teachers t INNER JOIN staff s ON t.staff_id = s.id WHERE s.id = $1 AND s.user_id = $2',
          [reqStaffId, userId]
        );
        if (teacherCheck.rows.length === 0) {
          return res.status(403).json({
            status: 'ERROR',
            message: 'You can only apply leave for your own staff account',
          });
        }
      }
      resolvedStaffId = reqStaffId;
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Invalid start or end date',
      });
    }
    if (end < start) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'End date must be on or after start date',
      });
    }
    const totalDays = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1);
    const applicantType = resolvedStudentId ? 'student' : 'staff';

    const result = await executeTransaction(async (client) => {
      // Lock applicant row so balance checks and insert remain atomic per applicant.
      if (resolvedStudentId) {
        await client.query('SELECT id FROM students WHERE id = $1 FOR UPDATE', [resolvedStudentId]);
      } else if (resolvedStaffId) {
        await client.query('SELECT id FROM staff WHERE id = $1 FOR UPDATE', [resolvedStaffId]);
      }

      const typeResult = await client.query(
        `SELECT id, leave_type, max_days, applicable_for, is_active
         FROM leave_types
         WHERE id = $1
         FOR UPDATE`,
        [leave_type_id]
      );
      if (typeResult.rows.length === 0) {
        const err = new Error('Invalid leave type selected');
        err.statusCode = 400;
        throw err;
      }
      const leaveType = typeResult.rows[0];
      if (!leaveType.is_active) {
        const err = new Error('Selected leave type is inactive');
        err.statusCode = 400;
        throw err;
      }
      const applicableFor = String(leaveType.applicable_for || 'both').toLowerCase();
      if (applicableFor !== 'both' && applicableFor !== applicantType) {
        const err = new Error(`Selected leave type is not applicable for ${applicantType} applicants`);
        err.statusCode = 400;
        throw err;
      }

      const maxDaysPerYear = Number(leaveType.max_days);
      if (Number.isFinite(maxDaysPerYear) && maxDaysPerYear > 0) {
        const yearStart = `${start.getFullYear()}-01-01`;
        const yearEnd = `${start.getFullYear()}-12-31`;
        const balanceResult = await client.query(
          `
          SELECT COALESCE(SUM(total_days), 0)::int AS used_days
          FROM leave_applications
          WHERE leave_type_id = $1
            AND status IN ('pending', 'approved')
            AND start_date <= $2::date
            AND end_date >= $3::date
            AND (
              ($4::int IS NOT NULL AND student_id = $4::int)
              OR
              ($5::int IS NOT NULL AND staff_id = $5::int)
            )
          `,
          [leave_type_id, yearEnd, yearStart, resolvedStudentId, resolvedStaffId]
        );
        const usedDays = Number(balanceResult.rows[0]?.used_days || 0);
        if (usedDays + totalDays > maxDaysPerYear) {
          const err = new Error(`Leave limit exceeded. Allowed ${maxDaysPerYear} days/year, already used ${usedDays} days.`);
          err.statusCode = 400;
          throw err;
        }
      }

      return client.query(
        `INSERT INTO leave_applications (
           leave_type_id, student_id, staff_id, applicant_type, start_date, end_date, total_days, reason, emergency_contact, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
         RETURNING *`,
        [
          leave_type_id,
          resolvedStudentId,
          resolvedStaffId,
          applicantType,
          start_date,
          end_date,
          totalDays,
          String(reason).trim(),
          emergency_contact || null,
        ]
      );
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Leave application submitted successfully',
      data: jsonSafeRow(result.rows[0]),
    });
  } catch (error) {
    console.error('Error creating leave application:', error);
    const detail = error.detail || error.message || '';
    const knownStatus = Number(error.statusCode) || (['23503', '22P02', '23514'].includes(error.code) ? 400 : 500);
    res.status(knownStatus).json({
      status: 'ERROR',
      message: knownStatus === 400 ? String(error.message || 'Invalid leave request') : 'Failed to submit leave application',
      detail: process.env.NODE_ENV === 'development' ? String(detail) : undefined,
    });
  }
};

// Update leave application status (approve/reject)
const updateLeaveApplicationStatus = async (req, res) => {
  try {
    const leaveId = parseInt(String(req.params.id || '').trim(), 10);
    const { status, rejection_reason } = req.body;
    const actorUserId = req.user?.id;
    if (!Number.isFinite(leaveId) || leaveId < 1) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid leave application ID' });
    }
    const statusVal = String(status || '').trim().toLowerCase();
    if (!['approved', 'rejected'].includes(statusVal)) {
      return res.status(400).json({ status: 'ERROR', message: 'Status must be approved or rejected' });
    }
    if (statusVal === 'rejected' && !String(rejection_reason || '').trim()) {
      return res.status(400).json({ status: 'ERROR', message: 'Rejection reason is required when rejecting leave' });
    }
    const existing = await query(
      'SELECT id, status, student_id, staff_id FROM leave_applications WHERE id = $1 LIMIT 1',
      [leaveId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Leave application not found' });
    }
    const target = existing.rows[0];
    const roleId = Number(req.user?.user_role_id ?? req.user?.role_id);
    const roleName = String(req.user?.role_name || req.user?.role || '').trim().toLowerCase();
    const isTeacher = roleId === ROLES.TEACHER || roleName === 'teacher' || roleName.includes('teacher');
    const isHeadmasterOrAdministrative =
      roleId === ROLES.ADMIN ||
      roleId === ROLES.ADMINISTRATIVE ||
      ['admin', 'headmaster', 'administrator', 'administrative'].includes(roleName);

    if (target.student_id) {
      if (!isTeacher) {
        return res.status(403).json({
          status: 'ERROR',
          message: 'Only teachers can approve or reject student leave requests.',
        });
      }
      const { teacherIds, staffIds } = await resolveTeacherScopeIds(req.user?.id);
      if (!teacherIds.length && !staffIds.length) {
        return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
      }
      const studentScopeCheck = await query(
        `
        SELECT s.id
        FROM students s
        WHERE s.id = $1
          AND (
            EXISTS (
              SELECT 1
              FROM class_schedules cs
              WHERE cs.teacher_id = ANY($2::int[])
                AND cs.class_id = s.class_id
                AND (cs.section_id = s.section_id OR cs.section_id IS NULL)
                AND (cs.academic_year_id = s.academic_year_id OR cs.academic_year_id IS NULL)
            )
            OR EXISTS (
              SELECT 1
              FROM teachers t
              WHERE t.id = ANY($2::int[])
                AND t.class_id = s.class_id
            )
            OR EXISTS (
              SELECT 1
              FROM sections sec_map
              WHERE sec_map.id = s.section_id
                AND sec_map.section_teacher_id = ANY($3::int[])
            )
            OR EXISTS (
              SELECT 1
              FROM classes c_map
              WHERE c_map.id = s.class_id
                AND (
                  c_map.class_teacher_id = ANY($2::int[])
                  OR c_map.class_teacher_id = ANY($3::int[])
                )
            )
          )
        LIMIT 1
        `,
        [target.student_id, teacherIds, staffIds]
      );
      if (studentScopeCheck.rows.length === 0) {
        return res.status(403).json({
          status: 'ERROR',
          message: 'Access denied. You can only approve leaves for your assigned students.',
        });
      }
    } else if (target.staff_id) {
      if (!isHeadmasterOrAdministrative) {
        return res.status(403).json({
          status: 'ERROR',
          message: 'Only headmaster or administrative users can approve or reject staff leave requests.',
        });
      }
    } else {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Invalid leave request target.',
      });
    }

    const currentStatus = String(existing.rows[0].status || '').trim().toLowerCase();
    if (currentStatus !== 'pending') {
      return res.status(400).json({ status: 'ERROR', message: 'Only pending leave applications can be updated' });
    }
    const rawApproverId = await resolveActorStaffId(actorUserId);
    const approverStaffId =
      Number.isFinite(Number(rawApproverId)) && Number(rawApproverId) > 0 ? Number(rawApproverId) : null;
    const rejectionVal =
      statusVal === 'rejected' ? String(rejection_reason || '').trim() || null : null;
    const result = await query(
      `UPDATE leave_applications la
       SET status = $1::text,
           approved_by = $2,
           approved_date = CURRENT_DATE,
           rejection_reason = CASE WHEN $5::text = 'rejected' THEN $3 ELSE NULL END,
           modified_at = CURRENT_TIMESTAMP
       WHERE la.id = $4
         AND LOWER(TRIM(COALESCE(la.status, ''))) = 'pending'
       RETURNING *`,
      [statusVal, approverStaffId, rejectionVal, leaveId, statusVal]
    );
    if (!result.rows || result.rows.length === 0) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'This leave request is no longer pending (it may have been updated already). Refresh the list and try again.',
      });
    }
    res.status(200).json({
      status: 'SUCCESS',
      message: `Leave ${statusVal} successfully`,
      data: jsonSafeRow(result.rows[0]),
    });
  } catch (error) {
    console.error('Error updating leave status:', error?.message || error, error?.code, error?.detail);
    if (error && error.code === '23503') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Could not record approver on this leave request. Ensure your user is linked to a valid staff profile.',
      });
    }
    if (error && error.code === '42703') {
      return res.status(503).json({
        status: 'ERROR',
        message:
          'Leave database schema is missing required columns. Run migration 019_leave_applications_approval_columns.sql on this school database, then retry.',
      });
    }
    if (error && error.code === '23514') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Leave update blocked by database rules for this row. Check status and applicant fields.',
      });
    }
    const devDetail = process.env.NODE_ENV !== 'production' ? String(error?.message || error) : undefined;
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update leave status',
      ...(devDetail ? { detail: devDetail } : {}),
    });
  }
};

// Get leave applications for the current user (student or staff/teacher by user_id from JWT).
// Used on Student Dashboard (student leaves) and Teacher Dashboard (staff leaves).
const getMyLeaveApplications = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Not authenticated'
      });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const roleIdRaw = req.user?.role_id;
    const roleId =
      roleIdRaw != null && roleIdRaw !== '' ? parseInt(roleIdRaw, 10) : NaN;
    const roleNameNorm = String(req.user?.role_name || '')
      .trim()
      .toLowerCase();

    // Teacher & Administrative JWT roles must ONLY see their own staff leave rows.
    // Otherwise a mistaken students.user_id link or email/phone match can show other people's leaves.
    const isStaffFacingLoginRole =
      roleId === ROLES.TEACHER ||
      roleId === ROLES.ADMINISTRATIVE ||
      roleNameNorm === 'teacher' ||
      roleNameNorm === 'administrative';

    if (isStaffFacingLoginRole) {
      const staffOnly = await query(
        `
        SELECT
          la.*,
          lt.leave_type AS leave_type_name,
          s.first_name AS applicant_first_name,
          s.last_name AS applicant_last_name,
          s.photo_url AS applicant_photo_url,
          COALESCE(d.designation_name, 'Staff') AS applicant_role
        FROM leave_applications la
        INNER JOIN staff s ON la.staff_id = s.id AND s.user_id = $1
        LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
        LEFT JOIN designations d ON s.designation_id = d.id
        WHERE la.staff_id IS NOT NULL
        ORDER BY la.start_date DESC NULLS LAST
        LIMIT $2
        `,
        [userId, limit]
      );
      return res.status(200).json({
        status: 'SUCCESS',
        message: 'Leave applications fetched successfully',
        data: staffOnly.rows,
        count: staffOnly.rows.length,
      });
    }

    // Staff/administrative/teacher accounts must never use the student email/phone fallback below,
    // or they can incorrectly see another student's leaves when contact details match.
    const staffLinkCheck = await query(
      'SELECT 1 FROM staff WHERE user_id = $1 AND is_active = true LIMIT 1',
      [userId]
    );
    const isLinkedStaffAccount = staffLinkCheck.rows.length > 0;

    // First try student leaves (by students.user_id)
    let result = await query(
      `
      SELECT
        la.*,
        lt.leave_type AS leave_type_name,
        st.first_name AS applicant_first_name,
        st.last_name AS applicant_last_name,
        st.photo_url AS applicant_photo_url,
        'Student' AS applicant_role
      FROM leave_applications la
      INNER JOIN students st ON la.student_id = st.id AND st.user_id = $1
      LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
      WHERE la.student_id IS NOT NULL
      ORDER BY la.start_date DESC NULLS LAST
      LIMIT $2
      `,
      [userId, limit]
    );

    // Fallback: if no student by user_id, try matching user email/phone to student (when user_id not set).
    // Skip for staff-linked logins so office users never inherit a student's leave list by contact match.
    if (result.rows.length === 0 && !isLinkedStaffAccount) {
      const userRow = await query(
        'SELECT email, phone FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );
      if (userRow.rows.length > 0) {
        const u = userRow.rows[0];
        const userEmail = (u.email || '').toString().trim().toLowerCase();
        const userPhone = (u.phone || '').toString().trim();
        if (userEmail || userPhone) {
          result = await query(
            `SELECT la.*, lt.leave_type AS leave_type_name,
              st.first_name AS applicant_first_name, st.last_name AS applicant_last_name,
              st.photo_url AS applicant_photo_url, 'Student' AS applicant_role
             FROM leave_applications la
             INNER JOIN students st ON la.student_id = st.id AND st.is_active = true
             LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
             WHERE la.student_id IS NOT NULL
               AND (st.user_id IS NULL OR st.user_id != $1)
               AND (
                 (LOWER(TRIM(COALESCE(st.email, ''))) = $2 AND $2 != '')
                 OR (TRIM(COALESCE(st.phone, '')) = $3 AND $3 != '')
                 OR EXISTS (
                   SELECT 1 FROM guardians gx
                   INNER JOIN users ux ON ux.id = gx.user_id
                   WHERE gx.student_id = st.id AND gx.is_active = true
                     AND (
                       (LOWER(TRIM(COALESCE(ux.email, ''))) = $2 AND $2 != '')
                       OR (TRIM(COALESCE(ux.phone, '')) = $3 AND $3 != '')
                     )
                 )
               )
             ORDER BY la.start_date DESC NULLS LAST
             LIMIT $4`,
            [userId, userEmail, userPhone, limit]
          );
        }
      }
    }

    // If no student leaves, try staff/teacher leaves
    if (result.rows.length === 0) {
      result = await query(
        `
        SELECT
          la.*,
          lt.leave_type AS leave_type_name,
          s.first_name AS applicant_first_name,
          s.last_name AS applicant_last_name,
          s.photo_url AS applicant_photo_url,
          COALESCE(d.designation_name, 'Teacher') AS applicant_role
        FROM leave_applications la
        INNER JOIN staff s ON la.staff_id = s.id AND s.user_id = $1
        LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
        LEFT JOIN designations d ON s.designation_id = d.id
        WHERE la.staff_id IS NOT NULL
        ORDER BY la.start_date DESC NULLS LAST
        LIMIT $2
        `,
        [userId, limit]
      );
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Leave applications fetched successfully',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching my leave applications:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch leave applications',
    });
  }
};

// Get leave applications for parent's children (students linked via parents table).
// Used on Parent Dashboard - uses parentUserMatch (username+@email.com, then email, then phone).
const getParentChildrenLeaves = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Not authenticated'
      });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    let studentIds = [];
    try {
      const { studentIds: rawIds } = await getParentsForUser(userId);
      studentIds = [...new Set(rawIds)].filter(Boolean);
    } catch (err) {
      console.error('getParentChildrenLeaves: getParentsForUser failed', err);
      return res.status(200).json({ status: 'SUCCESS', message: 'Leave applications fetched successfully', data: [], count: 0 });
    }
    if (studentIds.length === 0) {
      return res.status(200).json({ status: 'SUCCESS', message: 'Leave applications fetched successfully', data: [], count: 0 });
    }

    const placeholders = studentIds.map((_, i) => `$${i + 1}`).join(', ');
    const limitParam = studentIds.length + 1;
    const result = await query(
      `SELECT
        la.*,
        lt.leave_type AS leave_type_name,
        st.first_name AS applicant_first_name,
        st.last_name AS applicant_last_name,
        st.photo_url AS applicant_photo_url,
        st.id AS student_id,
        'Student' AS applicant_role
       FROM leave_applications la
       INNER JOIN students st ON la.student_id = st.id
       LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
       WHERE la.student_id IN (${placeholders})
       ORDER BY la.start_date DESC NULLS LAST
       LIMIT $${limitParam}`,
      [...studentIds, limit]
    );

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Leave applications fetched successfully',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching parent children leaves:', error);
    res.status(200).json({
      status: 'SUCCESS',
      data: [],
      count: 0,
      message: 'Leave applications fetched successfully',
    });
  }
};

// Get leave applications for guardian's wards (students linked to this guardian).
// Used on Guardian Dashboard - guardian matched by user email/phone.
const getGuardianWardLeaves = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Not authenticated'
      });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    const userResult = await query('SELECT id FROM users WHERE id = $1 AND is_active = true', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(200).json({ status: 'SUCCESS', message: 'Leave applications fetched successfully', data: [], count: 0 });
    }
    const guardianResult = await query(
      `SELECT g.student_id
       FROM guardians g
       INNER JOIN students s ON s.id = g.student_id AND s.is_active = true
       WHERE g.user_id = $1 AND g.is_active = true`,
      [userId]
    );
    const studentIds = guardianResult.rows.map(r => r.student_id).filter(Boolean);
    if (studentIds.length === 0) {
      return res.status(200).json({ status: 'SUCCESS', message: 'Leave applications fetched successfully', data: [], count: 0 });
    }

    const placeholders = studentIds.map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(
      `SELECT
        la.*,
        lt.leave_type AS leave_type_name,
        st.first_name AS applicant_first_name,
        st.last_name AS applicant_last_name,
        st.photo_url AS applicant_photo_url,
        st.id AS student_id,
        'Student' AS applicant_role
       FROM leave_applications la
       INNER JOIN students st ON la.student_id = st.id
       LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
       WHERE la.student_id IN (${placeholders})
       ORDER BY la.start_date DESC NULLS LAST
       LIMIT $${studentIds.length + 1}`,
      [...studentIds, limit]
    );

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Leave applications fetched successfully',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching guardian ward leaves:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch leave applications',
    });
  }
};

// Cancel leave application (owner/linked parent/guardian, pending only)
const cancelLeaveApplication = async (req, res) => {
  try {
    const userId = req.user?.id;
    const leaveId = parseInt(req.params.id, 10);
    if (!userId) {
      return res.status(401).json({ status: 'ERROR', message: 'Not authenticated' });
    }
    if (!Number.isFinite(leaveId) || leaveId < 1) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid leave application ID' });
    }

    const leaveRes = await query(
      `SELECT id, status, student_id, staff_id
       FROM leave_applications
       WHERE id = $1
       LIMIT 1`,
      [leaveId]
    );
    if (leaveRes.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Leave application not found' });
    }
    const leaveRow = leaveRes.rows[0];
    const currentStatus = String(leaveRow.status || '').toLowerCase();
    if (currentStatus !== 'pending') {
      return res.status(400).json({ status: 'ERROR', message: 'Only pending leave applications can be cancelled' });
    }

    let canCancel = false;
    if (leaveRow.student_id) {
      const ownStudent = await query(
        'SELECT 1 FROM students WHERE id = $1 AND user_id = $2 LIMIT 1',
        [leaveRow.student_id, userId]
      );
      canCancel = ownStudent.rows.length > 0;
      if (!canCancel) {
        const parentCheck = await getParentsForUser(userId);
        canCancel = (parentCheck.studentIds || []).includes(Number(leaveRow.student_id));
      }
      if (!canCancel) {
        const guardianCheck = await query(
          'SELECT 1 FROM guardians WHERE user_id = $1 AND student_id = $2 LIMIT 1',
          [userId, leaveRow.student_id]
        );
        canCancel = guardianCheck.rows.length > 0;
      }
    } else if (leaveRow.staff_id) {
      const ownStaff = await query(
        'SELECT 1 FROM staff WHERE id = $1 AND user_id = $2 LIMIT 1',
        [leaveRow.staff_id, userId]
      );
      canCancel = ownStaff.rows.length > 0;
    }

    if (!canCancel) {
      return res.status(403).json({ status: 'ERROR', message: 'You can only cancel your own pending leave applications' });
    }

    const updated = await query(
      `UPDATE leave_applications
       SET status = 'cancelled',
           modified_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [leaveId]
    );
    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Leave application cancelled successfully',
      data: jsonSafeRow(updated.rows[0]),
    });
  } catch (error) {
    console.error('Error cancelling leave application:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Failed to cancel leave application',
    });
  }
};

function parseLeaveDateQuery(q, keys) {
  if (!q || !keys) return null;
  for (let k = 0; k < keys.length; k += 1) {
    const key = keys[k];
    const val = q[key];
    if (val == null || val === '') continue;
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  return null;
}

// Get leave applications for dashboard (e.g. pending or recent).
// Optional filters: ?student_id=X, ?staff_id=X (for admin viewing specific student/teacher).
// Optional: ?academic_year_id=X - filter student leaves by academic year.
// Optional: ?leave_from=&leave_to= or ?from_date=&to_date= (YYYY-MM-DD) — overlap filter on leave range.
// Optional: ?pending_only=1 — only rows with status pending (Headmaster dashboard "requests awaiting action").
const getLeaveApplications = async (req, res) => {
  try {
    const pageSize = Math.min(parseInt(req.query.page_size || req.query.limit, 10) || 20, 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * pageSize;
    const studentId = req.query.student_id ? parseInt(req.query.student_id, 10) : null;
    const staffId = req.query.staff_id ? parseInt(req.query.staff_id, 10) : null;
    const classId = req.query.class_id ? parseInt(req.query.class_id, 10) : null;
    const sectionId = req.query.section_id ? parseInt(req.query.section_id, 10) : null;
    const departmentId = req.query.department_id ? parseInt(req.query.department_id, 10) : null;
    const designationId = req.query.designation_id ? parseInt(req.query.designation_id, 10) : null;
    const leaveTypeId = req.query.leave_type_id ? parseInt(req.query.leave_type_id, 10) : null;
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    const hasYearFilter = academicYearId != null && !Number.isNaN(academicYearId);
    const leaveFrom = parseLeaveDateQuery(req.query, ['leave_from', 'from_date']);
    const leaveTo = parseLeaveDateQuery(req.query, ['leave_to', 'to_date']);
    const statusFilter = String(req.query.status || '').trim().toLowerCase();
    const applicantTypeRaw = String(req.query.applicant_type || '').trim().toLowerCase();
    const applicantType = applicantTypeRaw === 'student' || applicantTypeRaw === 'staff' ? applicantTypeRaw : null;
    const pendingOnlyRaw = String(req.query.pending_only || '').trim().toLowerCase();
    const pendingOnly = pendingOnlyRaw === '1' || pendingOnlyRaw === 'true' || pendingOnlyRaw === 'yes';
    const validStatusFilter = VALID_FINAL_LEAVE_STATUSES.has(statusFilter) || statusFilter === 'pending' ? statusFilter : null;
    const sortByRaw = String(req.query.sort_by || '').trim().toLowerCase();
    const sortOrderRaw = String(req.query.sort_order || '').trim().toLowerCase();
    const sortOrder = sortOrderRaw === 'asc' ? 'ASC' : 'DESC';
    const roleId = Number(req.user?.user_role_id ?? req.user?.role_id);
    const roleName = String(req.user?.role_name || req.user?.role || '').trim().toLowerCase();
    const isTeacher = roleId === ROLES.TEACHER || roleName === 'teacher' || roleName.includes('teacher');

    const conditions = [];
    const params = [];
    let i = 1;

    if (studentId && !Number.isNaN(studentId)) {
      conditions.push(`la.student_id = $${i++}`);
      params.push(studentId);
    } else if (staffId && !Number.isNaN(staffId)) {
      conditions.push(`la.staff_id = $${i++}`);
      params.push(staffId);
    } else if (hasYearFilter) {
      conditions.push(`(la.student_id IS NULL OR st.academic_year_id = $${i++})`);
      params.push(academicYearId);
    }

    if (classId && !Number.isNaN(classId)) {
      conditions.push(`st.class_id = $${i++}`);
      params.push(classId);
    }
    if (sectionId && !Number.isNaN(sectionId)) {
      conditions.push(`st.section_id = $${i++}`);
      params.push(sectionId);
    }
    if (departmentId && !Number.isNaN(departmentId)) {
      conditions.push(`la.staff_id IS NOT NULL`);
      conditions.push(`s.department_id = $${i++}`);
      params.push(departmentId);
    }
    if (designationId && !Number.isNaN(designationId)) {
      conditions.push(`la.staff_id IS NOT NULL`);
      conditions.push(`s.designation_id = $${i++}`);
      params.push(designationId);
    }

    if (leaveFrom) {
      conditions.push(`la.end_date >= $${i++}::date`);
      params.push(leaveFrom);
    }
    if (leaveTo) {
      conditions.push(`la.start_date <= $${i++}::date`);
      params.push(leaveTo);
    }

    if (leaveTypeId && !Number.isNaN(leaveTypeId)) {
      conditions.push(`la.leave_type_id = $${i++}`);
      params.push(leaveTypeId);
    }

    if (pendingOnly) {
      conditions.push(`LOWER(TRIM(COALESCE(la.status, ''))) = 'pending'`);
    } else if (validStatusFilter) {
      conditions.push(`LOWER(TRIM(COALESCE(la.status, ''))) = $${i++}`);
      params.push(validStatusFilter);
    }
    if (applicantType) {
      conditions.push(`LOWER(TRIM(COALESCE(la.applicant_type, ''))) = $${i++}`);
      params.push(applicantType);
    }

    const shouldApplyTeacherScope = isTeacher && !(studentId && !Number.isNaN(studentId));

    if (isTeacher && studentId && !Number.isNaN(studentId)) {
      const access = await canAccessStudent(req, studentId);
      if (!access.ok) {
        return res.status(access.status || 403).json({
          status: 'ERROR',
          message: access.message || 'Access denied',
        });
      }
    }

    if (shouldApplyTeacherScope) {
      const { teacherIds, staffIds } = await resolveTeacherScopeIds(req.user?.id);
      if (!teacherIds.length && !staffIds.length) {
        return res.status(200).json({
          status: 'SUCCESS',
          message: 'Leave applications fetched successfully',
          data: [],
          count: 0,
          pagination: { page, page_size: pageSize, total: 0, total_pages: 1 },
        });
      }
      conditions.push(`la.student_id IS NOT NULL`);
      params.push(teacherIds);
      const teacherIdsRef = `$${i++}`;
      params.push(staffIds);
      const staffIdsRef = `$${i++}`;
      conditions.push(`(
        EXISTS (
          SELECT 1
          FROM class_schedules cs
          WHERE cs.teacher_id = ANY(${teacherIdsRef}::int[])
            AND cs.class_id = st.class_id
            AND (cs.section_id = st.section_id OR cs.section_id IS NULL)
            AND (cs.academic_year_id = st.academic_year_id OR cs.academic_year_id IS NULL)
        )
        OR EXISTS (
          SELECT 1
          FROM teachers t
          WHERE t.id = ANY(${teacherIdsRef}::int[])
            AND t.class_id = st.class_id
        )
        OR EXISTS (
          SELECT 1
          FROM sections sec_map
          WHERE sec_map.id = st.section_id
            AND sec_map.section_teacher_id = ANY(${staffIdsRef}::int[])
        )
        OR EXISTS (
          SELECT 1
          FROM classes c_map
          WHERE c_map.id = st.class_id
            AND (
              c_map.class_teacher_id = ANY(${teacherIdsRef}::int[])
              OR c_map.class_teacher_id = ANY(${staffIdsRef}::int[])
            )
        )
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumns = {
      created_at: 'COALESCE(la.created_at, la.modified_at, la.start_date::timestamp)',
      start_date: 'la.start_date',
      end_date: 'la.end_date',
      status: 'LOWER(TRIM(COALESCE(la.status, \'\')))',
      leave_type: 'LOWER(TRIM(COALESCE(lt.leave_type, \'\')))',
      applicant_name: 'LOWER(TRIM(COALESCE(s.first_name, st.first_name, \'\')))',
    };
    const sortExpr = sortColumns[sortByRaw] || (pendingOnly
      ? 'COALESCE(la.created_at, la.modified_at, la.start_date::timestamp)'
      : 'la.start_date');
    const orderBy = `ORDER BY ${sortExpr} ${sortOrder} NULLS LAST`;
    params.push(pageSize, offset);
    const limitIdx = i++;
    const offsetIdx = i++;

    const result = await query(
      `
      SELECT
        la.*,
        lt.leave_type AS leave_type_name,
        COALESCE(s.first_name, st.first_name) AS applicant_first_name,
        COALESCE(s.last_name, st.last_name) AS applicant_last_name,
        COALESCE(s.photo_url, st.photo_url) AS applicant_photo_url,
        COALESCE(d.designation_name, 'Student') AS applicant_role
      FROM leave_applications la
      LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
      LEFT JOIN staff s ON la.staff_id = s.id
      LEFT JOIN designations d ON s.designation_id = d.id
      LEFT JOIN students st ON la.student_id = st.id
      ${whereClause}
      ${orderBy}
      LIMIT $${limitIdx}
      OFFSET $${offsetIdx}
      `,
      params
    );

    const countParams = params.slice(0, -2);
    const countResult = await query(
      `
      SELECT COUNT(*)::int AS total
      FROM leave_applications la
      LEFT JOIN leave_types lt ON la.leave_type_id = lt.id
      LEFT JOIN staff s ON la.staff_id = s.id
      LEFT JOIN students st ON la.student_id = st.id
      ${whereClause}
      `,
      countParams
    );
    const total = parseInt(countResult.rows[0]?.total || '0', 10) || 0;

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Leave applications fetched successfully',
      data: result.rows,
      count: result.rows.length,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    console.error('Error fetching leave applications:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch leave applications',
    });
  }
};

module.exports = {
  getLeaveTypes,
  createLeaveApplication,
  updateLeaveApplicationStatus,
  cancelLeaveApplication,
  getLeaveApplications,
  getMyLeaveApplications,
  getParentChildrenLeaves,
  getGuardianWardLeaves,
};
