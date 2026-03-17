const { query } = require('../config/database');
const { ROLES } = require('../config/roles');
const { success, error: errorResponse } = require('../utils/responseHelper');

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
        t.updated_at,
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
        t.updated_at,
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
        t.updated_at,
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
      WHERE t.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Teacher not found');
    }

    const row = result.rows[0];
    const isAdmin = roleId === ROLES.ADMIN;
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
        t.updated_at,
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
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Teachers fetched successfully',
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching teachers by class:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch teachers',
    });
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
      return res.status(404).json({
        status: 'ERROR',
        message: 'Teacher not found'
      });
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
    const yearClause = hasYearFilter ? ' AND c.academic_year_id = $2' : '';
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

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Teacher routine fetched successfully',
      data: {
        routine,
        breaks,
        count: routine.length
      }
    });
  } catch (error) {
    console.error('Error fetching teacher routine:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch teacher routine',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update teacher (full update: staff + teachers tables)
const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
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

    const teacherCheck = await query(`SELECT staff_id FROM teachers WHERE id = $1`, [id]);
    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Teacher not found' });
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
      add('gender', gender);
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
    teacherUpdates.push('updated_at = NOW()');
    teacherParams.push(id);
    await query(`UPDATE teachers SET ${teacherUpdates.join(', ')} WHERE id = $${tidx}`, teacherParams);

    const result = await query(`
      SELECT t.id, t.status, t.staff_id, s.is_active
      FROM teachers t INNER JOIN staff s ON t.staff_id = s.id
      WHERE t.id = $1
    `, [id]);

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Teacher updated successfully',
      data: result.rows[0] || { id, status: statusValue, is_active: isActiveBoolean }
    });
  } catch (error) {
    console.error('Error updating teacher:', error);
    res.status(500).json({
      status: 'ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Failed to update teacher' : `Failed to update teacher: ${error.message || 'Unknown error'}`,
    });
  }
};

// Get attendance for students in teacher's classes (for Teacher Dashboard)
const getTeacherClassAttendance = async (req, res) => {
  try {
    const teacherId = parseInt(req.params.id, 10);
    if (!teacherId || Number.isNaN(teacherId)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid teacher ID' });
    }
    const userId = req.user?.id;
    const roleId = req.user?.role_id != null ? parseInt(req.user.role_id, 10) : null;
    const ROLES = require('../config/roles').ROLES;
    if (roleId === ROLES.TEACHER && userId) {
      const ownTeacher = await query('SELECT t.id FROM teachers t INNER JOIN staff s ON t.staff_id = s.id WHERE s.user_id = $1 LIMIT 1', [userId]);
      if (ownTeacher.rows.length > 0 && parseInt(ownTeacher.rows[0].id, 10) !== teacherId) {
        return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
      }
    }

    const days = parseInt(req.query.days, 10);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
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
    const rowLimit = days === 0 ? 5000 : 500; // All Time: higher limit to fetch more records

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

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Teacher class attendance fetched successfully',
      data: {
        records,
        summary: { present, absent, halfDay, late },
      },
    });
  } catch (error) {
    console.error('Error fetching teacher class attendance:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch teacher class attendance',
    });
  }
};

module.exports = {
  getAllTeachers,
  getCurrentTeacher,
  getTeacherById,
  getTeachersByClass,
  getTeacherRoutine,
  getTeacherClassAttendance,
  updateTeacher
};
