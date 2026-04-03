const { query } = require('../config/database');
const { getParentsForUser } = require('../utils/parentUserMatch');

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
      'INSERT INTO leave_types (leave_type, description, max_days_per_year) VALUES ($1, $2, $3) ON CONFLICT (leave_type) DO NOTHING',
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
        'SELECT id, leave_type FROM leave_types WHERE is_active = true ORDER BY leave_type'
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
    const { leave_type_id, student_id, staff_id, start_date, end_date, reason } = req.body;

    if (!leave_type_id || !start_date || !end_date) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Leave type, start date and end date are required',
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
             INNER JOIN users u ON (LOWER(TRIM(g.email)) = LOWER(TRIM(u.email)) OR (g.phone = u.phone AND g.phone != ''))
             WHERE u.id = $1 AND g.student_id = $2`,
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
    const totalDays = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1);
    const applicantType = resolvedStudentId ? 'student' : 'staff';

    const result = await query(
      `INSERT INTO leave_applications (leave_type_id, student_id, staff_id, applicant_type, start_date, end_date, total_days, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING *`,
      [
        leave_type_id,
        resolvedStudentId,
        resolvedStaffId,
        applicantType,
        start_date,
        end_date,
        totalDays,
        reason || null,
      ]
    );

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Leave application submitted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating leave application:', error);
    const detail = error.detail || error.message || '';
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to submit leave application',
      detail: process.env.NODE_ENV === 'development' ? String(detail) : undefined,
    });
  }
};

// Update leave application status (approve/reject)
const updateLeaveApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!id) {
      return res.status(400).json({ status: 'ERROR', message: 'Leave application ID required' });
    }
    const statusVal = String(status || '').toLowerCase();
    if (!['approved', 'rejected', 'reject', 'pending'].includes(statusVal)) {
      return res.status(400).json({ status: 'ERROR', message: 'Status must be approved or rejected' });
    }
    const dbStatus = statusVal === 'reject' ? 'rejected' : statusVal;
    const result = await query(
      'UPDATE leave_applications SET status = $1 WHERE id = $2 RETURNING *',
      [dbStatus, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Leave application not found' });
    }
    res.status(200).json({
      status: 'SUCCESS',
      message: `Leave ${dbStatus} successfully`,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating leave status:', error);
    res.status(500).json({ status: 'ERROR', message: 'Failed to update leave status' });
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

    // Fallback: if no student by user_id, try matching user email/phone to student (when user_id not set)
    if (result.rows.length === 0) {
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
             LEFT JOIN parents p ON st.parent_id = p.id
             WHERE la.student_id IS NOT NULL
               AND (st.user_id IS NULL OR st.user_id != $1)
               AND (
                 (LOWER(TRIM(COALESCE(st.email, ''))) = $2 AND $2 != '')
                 OR (TRIM(COALESCE(st.phone, '')) = $3 AND $3 != '')
                 OR (LOWER(TRIM(COALESCE(p.father_email, ''))) = $2 AND $2 != '')
                 OR (LOWER(TRIM(COALESCE(p.mother_email, ''))) = $2 AND $2 != '')
                 OR (TRIM(COALESCE(p.father_phone, '')) = $3 AND $3 != '')
                 OR (TRIM(COALESCE(p.mother_phone, '')) = $3 AND $3 != '')
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

    const userResult = await query(
      'SELECT email, phone FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(200).json({ status: 'SUCCESS', message: 'Leave applications fetched successfully', data: [], count: 0 });
    }
    const user = userResult.rows[0];
    const userEmail = (user.email || '').toString().trim();
    const userPhone = (user.phone || '').toString().trim();

    const guardianResult = await query(
      `SELECT student_id FROM guardians
       WHERE (LOWER(TRIM(email)) = LOWER($1) AND $1 != '')
          OR (TRIM(phone) = $2 AND $2 != '')`,
      [userEmail, userPhone]
    );
    const studentIds = guardianResult.rows.map(r => r.student_id).filter(Boolean);
    if (studentIds.length === 0) {
      return res.status(200).json({ status: 'SUCCESS', message: 'Leave applications fetched successfully', data: [], count: 0 });
    }

    const placeholders = studentIds.map((_, i) => `$${i + 2}`).join(', ');
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

// Get leave applications for dashboard (e.g. pending or recent).
// Optional filters: ?student_id=X, ?staff_id=X (for admin viewing specific student/teacher).
// Optional: ?academic_year_id=X - filter student leaves by academic year.
const getLeaveApplications = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const studentId = req.query.student_id ? parseInt(req.query.student_id, 10) : null;
    const staffId = req.query.staff_id ? parseInt(req.query.staff_id, 10) : null;
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    const hasYearFilter = academicYearId != null && !Number.isNaN(academicYearId);

    let whereClause = '';
    const params = [];
    if (studentId) {
      whereClause = ' WHERE la.student_id = $1';
      params.push(studentId);
    } else if (staffId) {
      whereClause = ' WHERE la.staff_id = $1';
      params.push(staffId);
    } else if (hasYearFilter) {
      whereClause = ' WHERE (la.student_id IS NULL OR st.academic_year_id = $1)';
      params.push(academicYearId);
    }
    params.push(limit);

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
      ORDER BY la.start_date DESC NULLS LAST
      LIMIT $${params.length}
      `,
      params
    );

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Leave applications fetched successfully',
      data: result.rows,
      count: result.rows.length,
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
  getLeaveApplications,
  getMyLeaveApplications,
  getParentChildrenLeaves,
  getGuardianWardLeaves,
};
