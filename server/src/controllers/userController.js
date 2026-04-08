const { query } = require('../config/database');
const { ROLES } = require('../config/roles');

function stripSensitiveUserFields(row) {
  if (!row || typeof row !== 'object') return row;
  const copy = { ...row };
  if (Object.prototype.hasOwnProperty.call(copy, 'password_hash')) delete copy.password_hash;
  return copy;
}

// Get all users (optional: filter by role_id) — IDs from user_roles (ROLES)
const getAllUsers = async (req, res) => {
  try {
    const { role_id } = req.query;

    let result;
    if (role_id) {
      // Filter by role - join with role-specific tables for extra data
      const roleNum = parseInt(role_id, 10);
      if (roleNum === ROLES.STUDENT) {
        // Students: users + students + class + section
        result = await query(`
          SELECT 
            u.id, u.username, u.first_name, u.last_name, u.phone, u.email,
            u.role_id, u.is_active, u.created_at,
            s.id as student_id, s.admission_number, s.roll_number, s.gender,
            s.date_of_birth, s.admission_date, s.photo_url,
            c.class_name, sec.section_name
          FROM users u
          LEFT JOIN students s ON u.id = s.user_id AND s.is_active = true
          LEFT JOIN classes c ON s.class_id = c.id
          LEFT JOIN sections sec ON s.section_id = sec.id
          WHERE u.is_active = true AND u.role_id = $1
          ORDER BY u.first_name ASC, u.last_name ASC
        `, [roleNum]);
      } else if (roleNum === ROLES.TEACHER) {
        // Teachers: users + staff + teachers + class + subject
        result = await query(`
          SELECT 
            u.id, u.username, u.first_name, u.last_name, u.phone, u.email,
            u.role_id, u.is_active, u.created_at,
            st.id as staff_id, st.employee_code, st.joining_date, st.photo_url,
            st.designation_id, st.department_id,
            t.id as teacher_id, t.status as teacher_status,
            c.class_name, sub.subject_name, d.designation_name
          FROM users u
          LEFT JOIN staff st ON u.id = st.user_id AND st.is_active = true
          LEFT JOIN teachers t ON st.id = t.staff_id
          LEFT JOIN classes c ON t.class_id = c.id
          LEFT JOIN subjects sub ON t.subject_id = sub.id
          LEFT JOIN designations d ON st.designation_id = d.id
          WHERE u.is_active = true AND u.role_id = $1
          ORDER BY u.first_name ASC, u.last_name ASC
        `, [roleNum]);
      } else if (roleNum === 4 || roleNum === 5) {
        // Parents (4) and Guardians (5): users table only
        result = await query(`
          SELECT 
            u.id, u.username, u.first_name, u.last_name, u.phone, u.email,
            u.role_id, u.is_active, u.created_at
          FROM users u
          WHERE u.is_active = true AND u.role_id = $1
          ORDER BY u.first_name ASC, u.last_name ASC
        `, [roleNum]);
      } else {
        // Other roles (e.g. admin) - basic user data
        result = await query(`
          SELECT 
            u.id, u.username, u.first_name, u.last_name, u.phone, u.email,
            u.role_id, u.is_active, u.created_at,
            c.class_name, sec.section_name
          FROM users u
          LEFT JOIN students s ON u.id = s.user_id
          LEFT JOIN classes c ON s.class_id = c.id
          LEFT JOIN sections sec ON s.section_id = sec.id
          WHERE u.is_active = true AND u.role_id = $1
          ORDER BY u.id ASC
        `, [roleNum]);
      }
    } else {
      // No filter - all users
      result = await query(`
        SELECT 
          u.*,
          c.class_name,
          sec.section_name
        FROM users u
        LEFT JOIN students s ON u.id = s.user_id
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN sections sec ON s.section_id = sec.id
        WHERE u.is_active = true
        ORDER BY u.id ASC
      `);
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Users fetched successfully',
      data: (result.rows || []).map(stripSensitiveUserFields),
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch users',
    });
  }
};

// Get user by ID
// Returns user data with name and role based on user type (admin/teacher/student)
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    // Use exact table name: users (plural)
    // JOIN with students, staff, and user_roles to get full user info
    // Students: users.id = students.user_id
    // Staff/Teachers: users.id = staff.user_id (or check teachers → staff relationship)
    const result = await query(
      `
      SELECT 
        u.*,
        -- Student info
        s.first_name AS student_first_name,
        s.last_name AS student_last_name,
        c.class_name,
        sec.section_name,
        -- Staff/Teacher info
        st.first_name AS staff_first_name,
        st.last_name AS staff_last_name,
        d.designation_name,
        -- User role
        ur.role_name
      FROM users u
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      LEFT JOIN staff st ON u.id = st.user_id
      LEFT JOIN designations d ON st.designation_id = d.id
      LEFT JOIN user_roles ur ON u.role_id = ur.id
      WHERE u.id = $1 AND u.is_active = true
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'User not found',
      });
    }

    const user = result.rows[0];
    const safeUser = stripSensitiveUserFields(user);
    
    // Determine user name and role based on available data
    let displayName = '';
    let displayRole = '';
    
    // If student data exists, use student name
    if (user.student_first_name || user.student_last_name) {
      displayName = `${user.student_first_name || ''} ${user.student_last_name || ''}`.trim();
      displayRole = 'Student';
    }
    // If staff/teacher data exists, use staff name
    else if (user.staff_first_name || user.staff_last_name) {
      displayName = `${user.staff_first_name || ''} ${user.staff_last_name || ''}`.trim();
      displayRole = user.designation_name || 'Teacher';
    }
    // Otherwise use user table name
    else {
      displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'User';
      displayRole = user.role_name || 'Admin';
    }

    // Add computed fields
    const userData = {
      ...safeUser,
      display_name: displayName,
      display_role: displayRole,
    };

    res.status(200).json({
      status: 'SUCCESS',
      message: 'User fetched successfully',
      data: userData,
    });
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch user',
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
};
