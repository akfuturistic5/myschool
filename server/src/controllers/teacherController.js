const fs = require('fs');
const { query, executeTransaction, runWithTenant } = require('../config/database');
const { ADMIN_ROLE_IDS } = require('../config/roles');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { canAccessClass } = require('../utils/accessControl');
const { createTeacherUser } = require('../utils/createPersonUser');
const { resolveTeacherDocumentPath, sanitizeTenant } = require('../utils/teacherDocumentStorage');

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
        t.id,
        t.class_id,
        t.subject_id,
        t.father_name,
        t.mother_name,
        t.marital_status,
        t.languages_known,
        t.blood_group,
        t.previous_school_name,
        t.previous_school_address,
        t.previous_school_phone,
        t.current_address,
        t.permanent_address,
        t.pan_number,
        t.id_number,
        t.bank_name,
        t.branch,
        t.ifsc,
        t.contract_type,
        t.shift,
        t.work_location,
        t.facebook,
        t.twitter,
        t.linkedin,
        t.status,
        t.created_at,
        t.resume,
        t.joining_letter,
        t.modified_at AS updated_at,
        t.staff_id,
        s.user_id,
        s.employee_code,
        s.first_name,
        s.last_name,
        s.gender,
        s.date_of_birth,
        s.blood_group_id,
        s.phone,
        s.email,
        s.address,
        s.emergency_contact_name,
        s.emergency_contact_phone,
        s.designation_id,
        s.department_id,
        s.joining_date,
        s.salary,
        s.qualification,
        s.experience_years,
        s.photo_url,
        s.is_active,
        c.class_name,
        sub.subject_name
      FROM teachers t
      INNER JOIN staff s ON t.staff_id = s.id
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN subjects sub ON t.subject_id = sub.id
      ORDER BY s.first_name ASC, s.last_name ASC
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
        t.id,
        t.class_id,
        t.subject_id,
        t.father_name,
        t.mother_name,
        t.marital_status,
        t.languages_known,
        t.blood_group,
        t.previous_school_name,
        t.previous_school_address,
        t.previous_school_phone,
        t.current_address,
        t.permanent_address,
        t.pan_number,
        t.id_number,
        t.bank_name,
        t.branch,
        t.ifsc,
        t.contract_type,
        t.shift,
        t.work_location,
        t.facebook,
        t.twitter,
        t.linkedin,
        t.status,
        t.created_at,
        t.resume,
        t.joining_letter,
        t.modified_at AS updated_at,
        t.staff_id,
        s.employee_code,
        s.first_name,
        s.last_name,
        s.gender,
        s.date_of_birth,
        s.blood_group_id,
        s.phone,
        s.email,
        s.address,
        s.emergency_contact_name,
        s.emergency_contact_phone,
        s.designation_id,
        s.department_id,
        s.joining_date,
        s.salary,
        s.qualification,
        s.experience_years,
        s.photo_url,
        s.is_active,
        c.class_name,
        sub.subject_name
      FROM teachers t
      INNER JOIN staff s ON t.staff_id = s.id
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN subjects sub ON t.subject_id = sub.id
      WHERE s.user_id = $1
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
        t.id,
        t.class_id,
        t.subject_id,
        t.father_name,
        t.mother_name,
        t.marital_status,
        t.languages_known,
        t.blood_group,
        t.previous_school_name,
        t.previous_school_address,
        t.previous_school_phone,
        t.current_address,
        t.permanent_address,
        t.pan_number,
        t.id_number,
        t.bank_name,
        t.branch,
        t.ifsc,
        t.contract_type,
        t.shift,
        t.work_location,
        t.facebook,
        t.twitter,
        t.linkedin,
        t.status,
        t.created_at,
        t.resume,
        t.joining_letter,
        t.modified_at AS updated_at,
        t.staff_id,
        s.employee_code,
        s.first_name,
        s.last_name,
        s.gender,
        s.date_of_birth,
        s.blood_group_id,
        s.phone,
        s.email,
        s.address,
        s.emergency_contact_name,
        s.emergency_contact_phone,
        s.designation_id,
        s.department_id,
        s.joining_date,
        s.salary,
        s.qualification,
        s.experience_years,
        s.photo_url,
        s.is_active,
        s.user_id,
        c.class_name,
        sub.subject_name
      FROM teachers t
      INNER JOIN staff s ON t.staff_id = s.id
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN subjects sub ON t.subject_id = sub.id
      WHERE t.id = $1
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
    
    return success(res, 200, 'Teacher fetched successfully', row);
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
        t.id,
        t.class_id,
        t.subject_id,
        t.father_name,
        t.mother_name,
        t.marital_status,
        t.languages_known,
        t.blood_group,
        t.previous_school_name,
        t.previous_school_address,
        t.previous_school_phone,
        t.current_address,
        t.permanent_address,
        t.pan_number,
        t.id_number,
        t.bank_name,
        t.branch,
        t.ifsc,
        t.contract_type,
        t.shift,
        t.work_location,
        t.facebook,
        t.twitter,
        t.linkedin,
        t.status,
        t.created_at,
        t.resume,
        t.joining_letter,
        t.modified_at AS updated_at,
        t.staff_id,
        s.employee_code,
        s.first_name,
        s.last_name,
        s.gender,
        s.date_of_birth,
        s.blood_group_id,
        s.phone,
        s.email,
        s.address,
        s.emergency_contact_name,
        s.emergency_contact_phone,
        s.designation_id,
        s.department_id,
        s.joining_date,
        s.salary,
        s.qualification,
        s.experience_years,
        s.photo_url,
        s.is_active,
        c.class_name,
        sub.subject_name
      FROM teachers t
      INNER JOIN staff s ON t.staff_id = s.id
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN subjects sub ON t.subject_id = sub.id
      WHERE t.class_id = $1
      ORDER BY s.first_name ASC, s.last_name ASC
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
    console.log('Fetching routine for teacher ID:', id);
    
    // First verify teacher exists
    const teacherCheck = await query(`
      SELECT t.id, t.staff_id 
      FROM teachers t
      WHERE t.id = $1 AND t.status = 'Active'
    `, [id]);
    
    if (teacherCheck.rows.length === 0) {
      console.log('Teacher not found with ID:', id);
      return errorResponse(res, 404, 'Teacher not found');
    }

    console.log('Teacher found, fetching schedules...');

    // First check what data exists for this teacher
    const checkQuery = await query(`SELECT COUNT(*) as count FROM class_schedules WHERE teacher_id = $1`, [id]);
    console.log(`Total schedules for teacher ${id}:`, checkQuery.rows[0].count);
    
    // Get a sample row to see column structure
    const sampleQuery = await query(`SELECT * FROM class_schedules WHERE teacher_id = $1 LIMIT 1`, [id]);
    if (sampleQuery.rows.length > 0) {
      console.log('Sample schedule row columns:', Object.keys(sampleQuery.rows[0]));
      console.log('Sample schedule row:', JSON.stringify(sampleQuery.rows[0], null, 2));
    }

    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    const hasYearFilter = academicYearId != null && !Number.isNaN(academicYearId);
    const yearClause = hasYearFilter
      ? ' AND (cs.academic_year_id = $2 OR c.academic_year_id = $2 OR cs.academic_year_id IS NULL OR c.academic_year_id IS NULL)'
      : '';
    const scheduleParams = hasYearFilter ? [id, academicYearId] : [id];

    // Get class schedules for this teacher
    // Handle both 'slots' and 'time_slots' table names
    let schedulesQuery = `
      SELECT 
        cs.id,
        cs.class_id,
        cs.section_id,
        cs.subject_id,
        cs.time_slot_id,
        cs.day_of_week,
        cs.room_number,
        cs.teacher_id,
        cs.academic_year_id,
        c.class_name,
        sec.section_name,
        sub.subject_name,
        ts.slot_name,
        ts.start_time,
        ts.end_time,
        ts.duration,
        ts.is_break,
        ts.is_active
      FROM class_schedules cs
      LEFT JOIN classes c ON cs.class_id = c.id
      LEFT JOIN sections sec ON cs.section_id = sec.id
      LEFT JOIN subjects sub ON cs.subject_id = sub.id
      LEFT JOIN slots ts ON cs.time_slot_id::text ~ '^[0-9]+$' AND ts.id = (cs.time_slot_id::text)::int
      WHERE cs.teacher_id = $1${yearClause}
      ORDER BY 
        CASE LOWER(TRIM(cs.day_of_week::text))
          WHEN '0' THEN 1
          WHEN '1' THEN 2
          WHEN '2' THEN 3
          WHEN '3' THEN 4
          WHEN '4' THEN 5
          WHEN '5' THEN 6
          WHEN '6' THEN 7
          WHEN 'sunday' THEN 1
          WHEN 'monday' THEN 2
          WHEN 'tuesday' THEN 3
          WHEN 'wednesday' THEN 4
          WHEN 'thursday' THEN 5
          WHEN 'friday' THEN 6
          WHEN 'saturday' THEN 7
          ELSE 8
        END,
        ts.start_time ASC
    `;

    let schedulesResult;
    try {
      schedulesResult = await query(schedulesQuery, scheduleParams);
      console.log('Schedules found:', schedulesResult.rows.length);
      if (schedulesResult.rows.length > 0) {
        console.log('First schedule:', JSON.stringify(schedulesResult.rows[0], null, 2));
      }
    } catch (e) {
      console.error('Error with slots table:', e.message);
      const isSlotsError = e.message.includes('slots') || e.message.includes('does not exist') ||
        e.message.includes('relation') || e.message.includes('invalid input syntax');
      if (isSlotsError) {
        schedulesQuery = `
          SELECT 
            cs.id,
            cs.class_id,
            cs.section_id,
            cs.subject_id,
            cs.time_slot_id,
            cs.day_of_week,
            cs.room_number,
            cs.teacher_id,
            cs.academic_year_id,
            c.class_name,
            sec.section_name,
            sub.subject_name,
            ts.slot_name,
            ts.start_time,
            ts.end_time,
            ts.duration,
            ts.is_break,
            ts.is_active
          FROM class_schedules cs
          LEFT JOIN classes c ON cs.class_id = c.id
          LEFT JOIN sections sec ON cs.section_id = sec.id
          LEFT JOIN subjects sub ON cs.subject_id = sub.id
          LEFT JOIN time_slots ts ON cs.time_slot_id::text ~ '^[0-9]+$' AND ts.id = (cs.time_slot_id::text)::int
          WHERE cs.teacher_id = $1${yearClause}
          ORDER BY 
            CASE LOWER(TRIM(cs.day_of_week::text))
              WHEN '0' THEN 1
              WHEN '1' THEN 2
              WHEN '2' THEN 3
              WHEN '3' THEN 4
              WHEN '4' THEN 5
              WHEN '5' THEN 6
              WHEN '6' THEN 7
              WHEN 'sunday' THEN 1
              WHEN 'monday' THEN 2
              WHEN 'tuesday' THEN 3
              WHEN 'wednesday' THEN 4
              WHEN 'thursday' THEN 5
              WHEN 'friday' THEN 6
              WHEN 'saturday' THEN 7
              ELSE 8
            END,
            ts.start_time ASC
        `;
        schedulesResult = await query(schedulesQuery, scheduleParams);
        console.log('Schedules found with time_slots:', schedulesResult.rows.length);
      } else {
        // If error is not about slots table, try without slot join
        console.log('Trying query without slot join...');
        schedulesQuery = `
          SELECT 
            cs.*,
            c.class_name,
            sec.section_name,
            sub.subject_name
          FROM class_schedules cs
          LEFT JOIN classes c ON cs.class_id = c.id
          LEFT JOIN sections sec ON cs.section_id = sec.id
          LEFT JOIN subjects sub ON cs.subject_id = sub.id
          WHERE cs.teacher_id = $1${yearClause}
        `;
        schedulesResult = await query(schedulesQuery, scheduleParams);
        console.log('Schedules found without slot join:', schedulesResult.rows.length);
      }
    }

    // Get break/lunch times from slots table
    let breaksQuery = `
      SELECT 
        slot_name,
        start_time,
        end_time,
        duration,
        is_break,
        is_active
      FROM slots
      WHERE is_break = true AND is_active = true
      ORDER BY start_time ASC
    `;

    let breaksResult;
    try {
      breaksResult = await query(breaksQuery);
    } catch (e) {
      // Try with time_slots table if slots doesn't exist
      if (e.message.includes('slots') || e.message.includes('does not exist')) {
        breaksQuery = `
          SELECT 
            slot_name,
            start_time,
            end_time,
            duration,
            is_break,
            is_active
          FROM time_slots
          WHERE is_break = true AND is_active = true
          ORDER BY start_time ASC
        `;
        breaksResult = await query(breaksQuery);
      } else {
        breaksResult = { rows: [] };
      }
    }

    // Helper function to convert day to text
    const getDayName = (day) => {
      if (!day && day !== 0) return 'Monday';
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      if (typeof day === 'number') {
        return dayNames[day] || 'Monday';
      }
      if (typeof day === 'string') {
        const dayLower = day.toLowerCase();
        if (dayLower.includes('monday')) return 'Monday';
        if (dayLower.includes('tuesday')) return 'Tuesday';
        if (dayLower.includes('wednesday')) return 'Wednesday';
        if (dayLower.includes('thursday')) return 'Thursday';
        if (dayLower.includes('friday')) return 'Friday';
        if (dayLower.includes('saturday')) return 'Saturday';
        if (dayLower.includes('sunday')) return 'Sunday';
        return day; // Return as is if already formatted
      }
      return 'Monday';
    };

    // Format the response
    const routine = schedulesResult.rows.map(row => {
      // Get day value from any possible column name
      const dayValue = row.day_of_week || row.day || row.weekday || 
                       row['day of week'] || row['dayOfWeek'];
      
      // Get time from slot join or from class_schedules directly
      const startTime = row.start_time || row.startTime || row.period_start;
      const endTime = row.end_time || row.endTime || row.period_end;
      
      return {
        id: row.id,
        classId: row.class_id,
        className: row.class_name || row.className || 'N/A',
        sectionId: row.section_id,
        sectionName: row.section_name || row.sectionName || 'N/A',
        subjectId: row.subject_id,
        subjectName: row.subject_name || row.subjectName || 'N/A',
        timeSlotId: row.time_slot_id || row.time_slot || row.timeSlotId,
        slotName: row.slot_name || row.slotName || '',
        dayOfWeek: getDayName(dayValue),
        roomNumber: row.room_number || row.roomNumber || row.room_number || 'N/A',
        startTime: startTime,
        endTime: endTime,
        duration: row.duration || '',
        isBreak: row.is_break || false,
        academicYearId: row.academic_year_id || row.academicYearId
      };
    });

    console.log('Formatted routine count:', routine.length);
    if (routine.length > 0) {
      console.log('Sample routine item:', JSON.stringify(routine[0], null, 2));
    } else {
      console.log('No routine items found. Checking if teacher_id matches...');
      // Check if there are any schedules at all
      const allSchedules = await query(`SELECT teacher_id, COUNT(*) as count FROM class_schedules GROUP BY teacher_id LIMIT 10`);
      console.log('Sample teacher_ids in class_schedules:', allSchedules.rows);
    }

    const breaks = breaksResult.rows.map(row => ({
      slotName: row.slot_name,
      startTime: row.start_time,
      endTime: row.end_time,
      duration: row.duration
    }));

    return success(res, 200, 'Teacher routine fetched successfully', {
      routine,
      breaks,
      count: routine.length,
    });
  } catch (error) {
    console.error('Error fetching teacher routine:', error);
    return errorResponse(
      res,
      500,
      process.env.NODE_ENV === 'production'
        ? 'Failed to fetch teacher routine'
        : (error.message || 'Failed to fetch teacher routine')
    );
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

    const classId = class_id != null && class_id !== '' ? parseInt(class_id, 10) : NaN;
    const subjectId = subject_id != null && subject_id !== '' ? parseInt(subject_id, 10) : NaN;
    if (!classId || Number.isNaN(classId) || classId < 1) {
      return errorResponse(res, 400, 'Valid class is required', 'VALIDATION_ERROR');
    }
    if (!subjectId || Number.isNaN(subjectId) || subjectId < 1) {
      return errorResponse(res, 400, 'Valid subject is required', 'VALIDATION_ERROR');
    }

    const desigParsed = parsePositiveIntOrNull(designation_id);
    const deptParsed = parsePositiveIntOrNull(department_id);
    const bgParsed = parsePositiveIntOrNull(blood_group_id);
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

    // Single DB transaction: staff INSERT → user INSERT → teachers INSERT.
    // executeTransaction runs BEGIN / COMMIT or ROLLBACK on any failure — no partial teacher rows.
    const teacherRow = await executeTransaction(async (client) => {
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

      const customCode = (clientEmployeeCode || '').toString().trim().slice(0, 20);
      let employeeCode = customCode;
      if (!employeeCode) {
        employeeCode = `TMP${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20);
      }

      const staffIns = await client.query(
        `INSERT INTO staff (
          user_id, employee_code, first_name, last_name, gender, date_of_birth, blood_group_id,
          phone, email, address, emergency_contact_name, emergency_contact_phone,
          designation_id, department_id, joining_date, salary, qualification, experience_years,
          is_active, created_by, created_at, modified_at
        ) VALUES (
          NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW()
        ) RETURNING id`,
        [
          employeeCode,
          fn,
          ln,
          genderNorm,
          date_of_birth || null,
          bgId && !Number.isNaN(bgId) ? bgId : null,
          ph,
          em,
          addr,
          emergency_contact_name || null,
          emergency_contact_phone || null,
          desigId && !Number.isNaN(desigId) ? desigId : null,
          deptId && !Number.isNaN(deptId) ? deptId : null,
          joining_date || null,
          salaryNum != null && !Number.isNaN(salaryNum) ? salaryNum : null,
          qualification || null,
          expYears != null && !Number.isNaN(expYears) ? expYears : null,
          isActiveBoolean,
          createdBy && !Number.isNaN(createdBy) ? createdBy : null,
        ]
      );
      const staffId = staffIns.rows[0].id;
      if (!customCode) {
        const finalCode = (`TCH${staffId}`).slice(0, 20);
        await client.query(`UPDATE staff SET employee_code = $1 WHERE id = $2`, [finalCode, staffId]);
      }

      const userId = await createTeacherUser(client, {
        email: em,
        phone: ph,
        first_name: fn,
        last_name: ln,
        password,
      });
      if (!userId) {
        const err = new Error('Failed to create login account for teacher');
        err.statusCode = 500;
        throw err;
      }
      await client.query(`UPDATE staff SET user_id = $1, modified_at = NOW() WHERE id = $2`, [userId, staffId]);

      const tIns = await client.query(
        `INSERT INTO teachers (
          staff_id, class_id, subject_id, father_name, mother_name, marital_status, languages_known,
          previous_school_name, previous_school_address, previous_school_phone,
          current_address, permanent_address, pan_number, id_number, status,
          bank_name, branch, ifsc, contract_type, shift, work_location,
          facebook, twitter, linkedin, blood_group, resume, joining_letter, created_at, modified_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NULL, NULL, NOW(), NOW()
        ) RETURNING id`,
        [
          staffId,
          classId,
          subjectId,
          father_name || null,
          mother_name || null,
          marital_status || null,
          languagesArr,
          previous_school_name || null,
          previous_school_address || null,
          previous_school_phone || null,
          currAddr,
          permAddr || null,
          panVal,
          id_number || null,
          statusValue,
          bank_name || null,
          branch || null,
          ifsc || null,
          contract_type || null,
          shift || null,
          work_location || null,
          facebook || null,
          twitter || null,
          linkedin || null,
          bgText,
        ]
      );
      return { teacherId: tIns.rows[0].id, staffId };
    });

    let payload;
    try {
      const full = await query(
        `
      SELECT
        t.id,
        t.class_id,
        t.subject_id,
        t.father_name,
        t.mother_name,
        t.marital_status,
        t.languages_known,
        t.blood_group,
        t.previous_school_name,
        t.previous_school_address,
        t.previous_school_phone,
        t.current_address,
        t.permanent_address,
        t.pan_number,
        t.id_number,
        t.bank_name,
        t.branch,
        t.ifsc,
        t.contract_type,
        t.shift,
        t.work_location,
        t.facebook,
        t.twitter,
        t.linkedin,
        t.status,
        t.created_at,
        t.resume,
        t.joining_letter,
        t.modified_at AS updated_at,
        t.staff_id,
        s.user_id,
        s.employee_code,
        s.first_name,
        s.last_name,
        s.gender,
        s.date_of_birth,
        s.blood_group_id,
        s.phone,
        s.email,
        s.address,
        s.emergency_contact_name,
        s.emergency_contact_phone,
        s.designation_id,
        s.department_id,
        s.joining_date,
        s.salary,
        s.qualification,
        s.experience_years,
        s.photo_url,
        s.is_active,
        c.class_name,
        sub.subject_name
      FROM teachers t
      INNER JOIN staff s ON t.staff_id = s.id
      LEFT JOIN classes c ON t.class_id = c.id
      LEFT JOIN subjects sub ON t.subject_id = sub.id
      WHERE t.id = $1
    `,
        [teacherRow.teacherId]
      );
      payload = full.rows[0] || { id: teacherRow.teacherId };
    } catch (readErr) {
      console.error('Teacher created but failed to load full row:', readErr);
      payload = { id: teacherRow.teacherId };
    }

    return success(res, 201, 'Teacher created successfully', payload);
  } catch (error) {
    console.error('Error creating teacher:', error);
    if (error.teacherInputError) {
      return errorResponse(
        res,
        error.teacherInputError.status,
        error.message,
        error.teacherInputError.code
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
    return errorResponse(res, 500, 'Failed to create teacher', 'INTERNAL_ERROR');
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
      bank_name, branch, ifsc, contract_type, shift, work_location,
      facebook, twitter, linkedin
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

    const teacherCheck = await query(`SELECT staff_id FROM teachers WHERE id = $1`, [teacherIdNum]);
    if (teacherCheck.rows.length === 0) {
      return errorResponse(res, 404, 'Teacher not found');
    }
    const staffId = teacherCheck.rows[0].staff_id;
    const statusValue = isActiveBoolean ? 'Active' : 'Inactive';

    const languagesArr = Array.isArray(languages_known) ? languages_known : (typeof languages_known === 'string' ? languages_known.split(',').map(s => s.trim()).filter(Boolean) : null);

    if (first_name != null || last_name != null || gender != null || date_of_birth != null ||
        phone != null || email != null || address != null || emergency_contact_name != null ||
        emergency_contact_phone != null || designation_id != null || department_id != null ||
        joining_date != null || salary != null || qualification != null || experience_years != null) {
      const staffUpdates = [];
      const staffParams = [];
      let idx = 1;
      const add = (col, val) => { if (val !== undefined && val !== null) { staffUpdates.push(`${col} = $${idx}`); staffParams.push(val); idx++; } };
      add('first_name', first_name);
      add('last_name', last_name);
      if (gender !== undefined && gender !== null && String(gender).trim() !== '') {
        const gn = normalizeGender(gender);
        if (gn) add('gender', gn);
      }
      add('date_of_birth', date_of_birth);
      add('phone', phone);
      add('email', email);
      add('address', address);
      add('emergency_contact_name', emergency_contact_name);
      add('emergency_contact_phone', emergency_contact_phone);
      add('designation_id', designation_id || null);
      add('department_id', department_id || null);
      add('joining_date', joining_date);
      add('salary', salary);
      add('qualification', qualification);
      add('experience_years', experience_years != null ? parseInt(experience_years, 10) : null);
      add('blood_group_id', blood_group_id || null);
      add('is_active', isActiveBoolean);
      add('modified_at', new Date());
      if (staffUpdates.length > 0) {
        staffParams.push(staffId);
        await query(`UPDATE staff SET ${staffUpdates.join(', ')} WHERE id = $${idx}`, staffParams);
      } else if (is_active !== undefined) {
        await query(`UPDATE staff SET is_active = $1 WHERE id = $2`, [isActiveBoolean, staffId]);
      }
    } else if (is_active !== undefined) {
      await query(`UPDATE staff SET is_active = $1 WHERE id = $2`, [isActiveBoolean, staffId]);
    }

    const teacherUpdates = [];
    const teacherParams = [];
    let tidx = 1;
    const tadd = (col, val) => { if (val !== undefined && val !== null) { teacherUpdates.push(`${col} = $${tidx}`); teacherParams.push(val); tidx++; } };
    tadd('status', statusValue);
    tadd('class_id', class_id);
    tadd('subject_id', subject_id);
    tadd('father_name', father_name);
    tadd('mother_name', mother_name);
    tadd('marital_status', marital_status);
    tadd('languages_known', languagesArr);
    tadd('blood_group', blood_group);
    tadd('previous_school_name', previous_school_name);
    tadd('previous_school_address', previous_school_address);
    tadd('previous_school_phone', previous_school_phone);
    tadd('current_address', current_address);
    tadd('permanent_address', permanent_address);
    tadd('pan_number', pan_number);
    tadd('id_number', id_number);
    tadd('bank_name', bank_name);
    tadd('branch', branch);
    tadd('ifsc', ifsc);
    tadd('contract_type', contract_type);
    tadd('shift', shift);
    tadd('work_location', work_location);
    tadd('facebook', facebook);
    tadd('twitter', twitter);
    tadd('linkedin', linkedin);
    teacherUpdates.push('modified_at = NOW()');
    teacherParams.push(teacherIdNum);
    await query(`UPDATE teachers SET ${teacherUpdates.join(', ')} WHERE id = $${tidx}`, teacherParams);

    const result = await query(`
      SELECT t.id, t.status, t.staff_id, s.is_active
      FROM teachers t INNER JOIN staff s ON t.staff_id = s.id
      WHERE t.id = $1
    `, [teacherIdNum]);

    return success(res, 200, 'Teacher updated successfully', result.rows[0] || { id: teacherIdNum, status: statusValue, is_active: isActiveBoolean });
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
      const ownTeacher = await query('SELECT t.id FROM teachers t INNER JOIN staff s ON t.staff_id = s.id WHERE s.user_id = $1 LIMIT 1', [userId]);
      if (ownTeacher.rows.length > 0 && parseInt(ownTeacher.rows[0].id, 10) !== teacherId) {
        return errorResponse(res, 403, 'Access denied', 'FORBIDDEN');
      }
    }

    const days = parseInt(req.query.days, 10);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    const hasAcademicYearFilter = academicYearId != null && !Number.isNaN(academicYearId);
    let dateFilter = '';
    let params = [teacherId];
    if (days > 0 && days <= 365) {
      if (offset > 0) {
        dateFilter = `AND a.attendance_date >= CURRENT_DATE - ($2 + $3) * INTERVAL '1 day'
                      AND a.attendance_date < CURRENT_DATE - $3 * INTERVAL '1 day'`;
        params = [teacherId, days, offset];
      } else {
        dateFilter = `AND a.attendance_date >= CURRENT_DATE - $2 * INTERVAL '1 day'`;
        params = [teacherId, days];
      }
    }
    if (hasAcademicYearFilter) {
      params.push(academicYearId);
    }
    const rowLimit = days === 0 ? 5000 : 500; // All Time: higher limit to fetch more records
    const academicYearFilter = hasAcademicYearFilter ? `AND s.academic_year_id = $${params.length}` : '';

    // Use EXISTS to avoid duplicates; include BOTH class_schedules AND teachers.class_id
    const result = await query(
      `SELECT a.id, a.student_id, a.class_id, a.section_id, a.attendance_date, a.status,
              a.check_in_time, a.check_out_time, a.marked_by, a.remarks
       FROM attendance a
       INNER JOIN students s ON a.student_id = s.id AND s.is_active = true
       WHERE (
         EXISTS (
           SELECT 1 FROM class_schedules cs
           WHERE cs.teacher_id = $1
             AND cs.class_id = a.class_id
             AND (cs.section_id = a.section_id OR (cs.section_id IS NULL AND a.section_id IS NULL))
         )
         OR EXISTS (
           SELECT 1 FROM teachers t
           WHERE t.id = $1 AND t.class_id = a.class_id
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

    // Multer runs after auth's runWithTenant(); stream/async boundaries can drop AsyncLocalStorage.
    // Re-bind tenant so query() hits the correct school DB (not primary fallback).
    return await runWithTenant(dbName, async () => {
      const tenant = sanitizeTenant(req.tenant?.db_name || dbName || 'default_tenant') || 'default_tenant';

      const prev = await query('SELECT resume, joining_letter FROM teachers WHERE id = $1', [teacherId]);
      if (!prev.rows.length) {
        if (resumeFile) unlinkMulterTemp(resumeFile);
        if (letterFile) unlinkMulterTemp(letterFile);
        return errorResponse(res, 404, 'Teacher not found', 'NOT_FOUND');
      }

      const oldResume = prev.rows[0].resume;
      const oldLetter = prev.rows[0].joining_letter;

      const newResumeRel = resumeFile ? `${tenant}/${resumeFile.filename}` : null;
      const newLetterRel = letterFile ? `${tenant}/${letterFile.filename}` : null;

      const upd = await query(
        `UPDATE teachers SET
          resume = COALESCE($1, resume),
          joining_letter = COALESCE($2, joining_letter),
          modified_at = NOW()
        WHERE id = $3`,
        [newResumeRel, newLetterRel, teacherId]
      );

      if (upd.rowCount < 1) {
        if (resumeFile) unlinkMulterTemp(resumeFile);
        if (letterFile) unlinkMulterTemp(letterFile);
        return errorResponse(res, 404, 'Teacher not found or could not update', 'NOT_FOUND');
      }

      if (resumeFile && oldResume && oldResume !== newResumeRel) unlinkTeacherDocStored(oldResume);
      if (letterFile && oldLetter && oldLetter !== newLetterRel) unlinkTeacherDocStored(oldLetter);

      const refreshed = await query(
        `SELECT t.resume, t.joining_letter, t.modified_at AS updated_at FROM teachers t WHERE t.id = $1`,
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
        `SELECT t.${column} AS doc_path, s.user_id, s.staff_id
         FROM teachers t
         INNER JOIN staff s ON t.staff_id = s.id
         WHERE t.id = $1`,
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
