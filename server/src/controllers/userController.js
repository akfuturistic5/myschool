const { query } = require('../config/database');
const { ROLES } = require('../config/roles');

let parentSplitColumnsSupportPromise = null;
let deleteAccountRequestsTableSupportPromise = null;

function stripSensitiveUserFields(row) {
  if (!row || typeof row !== 'object') return row;
  const copy = { ...row };
  if (Object.prototype.hasOwnProperty.call(copy, 'password_hash')) delete copy.password_hash;
  return copy;
}

async function hasParentSplitUserColumns() {
  if (!parentSplitColumnsSupportPromise) {
    parentSplitColumnsSupportPromise = query(
      `SELECT COUNT(*)::int AS cnt
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'parents'
         AND column_name IN ('father_user_id', 'mother_user_id')`
    )
      .then((r) => Number(r.rows?.[0]?.cnt || 0) >= 2)
      .catch(() => false);
  }
  return parentSplitColumnsSupportPromise;
}

async function ensureDeleteAccountRequestsTable() {
  if (!deleteAccountRequestsTableSupportPromise) {
    deleteAccountRequestsTableSupportPromise = query(
      `
      CREATE TABLE IF NOT EXISTS account_delete_requests (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requisition_date TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        delete_request_date TIMESTAMP WITHOUT TIME ZONE NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        reason TEXT NULL,
        requested_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
        reviewed_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TIMESTAMP WITHOUT TIME ZONE NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT account_delete_requests_status_check CHECK (
          status IN ('pending', 'confirmed', 'rejected', 'cancelled')
        )
      );
      CREATE INDEX IF NOT EXISTS idx_account_delete_requests_user_id
        ON account_delete_requests (user_id);
      CREATE INDEX IF NOT EXISTS idx_account_delete_requests_requisition_date
        ON account_delete_requests (requisition_date DESC);
      CREATE INDEX IF NOT EXISTS idx_account_delete_requests_status
        ON account_delete_requests (status);
      `
    )
      .then(() => true)
      .catch((err) => {
        deleteAccountRequestsTableSupportPromise = null;
        throw err;
      });
  }
  return deleteAccountRequestsTableSupportPromise;
}

// Get all users (optional: filter by role_id) — IDs from user_roles (ROLES)
const getAllUsers = async (req, res) => {
  try {
    const { role_id } = req.query;
    const hasSplitParentColumns = await hasParentSplitUserColumns();
    const parentUserPredicate = hasSplitParentColumns
      ? `(p.user_id = u.id OR p.father_user_id = u.id OR p.mother_user_id = u.id)`
      : `p.user_id = u.id`;

    const classSectionProjection = `
      COALESCE(stu_ctx.class_name, teacher_ctx.class_name, parent_ctx.class_name, guardian_ctx.class_name) AS class_name,
      COALESCE(stu_ctx.section_name, teacher_ctx.section_name, parent_ctx.section_name, guardian_ctx.section_name) AS section_name
    `;

    const classSectionJoins = `
      LEFT JOIN LATERAL (
        SELECT c.class_name, sec.section_name
        FROM students s
        LEFT JOIN classes c ON c.id = s.class_id
        LEFT JOIN sections sec ON sec.id = s.section_id
        WHERE s.user_id = u.id
          AND s.is_active = true
        ORDER BY s.id DESC
        LIMIT 1
      ) AS stu_ctx ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          c.class_name,
          COALESCE(
            sec.section_name,
            sched_sec.section_name
          ) AS section_name
        FROM staff st
        INNER JOIN teachers t ON t.staff_id = st.id
        LEFT JOIN classes c ON c.id = t.class_id
        LEFT JOIN sections sec
          ON sec.section_teacher_id = st.id
         AND (t.class_id IS NULL OR sec.class_id = t.class_id)
        LEFT JOIN LATERAL (
          SELECT sec2.section_name
          FROM class_schedules cs
          INNER JOIN sections sec2 ON sec2.id = cs.section_id
          WHERE cs.teacher_id = t.id
          ORDER BY cs.id DESC
          LIMIT 1
        ) AS sched_sec ON TRUE
        WHERE st.user_id = u.id
          AND st.is_active = true
        ORDER BY t.id DESC
        LIMIT 1
      ) AS teacher_ctx ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          NULLIF(string_agg(DISTINCT c.class_name, ', ' ORDER BY c.class_name), '') AS class_name,
          NULLIF(string_agg(DISTINCT sec.section_name, ', ' ORDER BY sec.section_name), '') AS section_name
        FROM (
          SELECT s.class_id, s.section_id
          FROM parents p
          INNER JOIN students s ON s.id = p.student_id AND s.is_active = true
          WHERE ${parentUserPredicate}
          UNION
          SELECT s2.class_id, s2.section_id
          FROM guardians g
          INNER JOIN students s2 ON s2.id = g.student_id AND s2.is_active = true
          WHERE g.user_id = u.id
            AND g.is_active = true
        ) AS rel
        LEFT JOIN classes c ON c.id = rel.class_id
        LEFT JOIN sections sec ON sec.id = rel.section_id
      ) AS parent_ctx ON TRUE
      LEFT JOIN LATERAL (
        SELECT c.class_name, sec.section_name
        FROM guardians g
        INNER JOIN students s ON s.id = g.student_id AND s.is_active = true
        LEFT JOIN classes c ON c.id = s.class_id
        LEFT JOIN sections sec ON sec.id = s.section_id
        WHERE g.user_id = u.id
          AND g.is_active = true
        ORDER BY s.id DESC
        LIMIT 1
      ) AS guardian_ctx ON TRUE
    `;

    let result;
    if (role_id) {
      // Filter by role - join with role-specific tables for extra data
      const roleNum = parseInt(role_id, 10);
      if (roleNum === ROLES.STUDENT) {
        // Students: users + students + class + section (one row per user)
        result = await query(`
          SELECT DISTINCT ON (u.id)
            u.id, u.username, u.first_name, u.last_name, u.phone, u.email,
            u.role_id, u.is_active, u.created_at,
            ur.role_name,
            s.id as student_id, s.admission_number, s.roll_number, s.gender,
            s.date_of_birth, s.admission_date, s.photo_url,
            c.class_name, sec.section_name
          FROM users u
          LEFT JOIN user_roles ur ON u.role_id = ur.id
          LEFT JOIN students s ON u.id = s.user_id AND s.is_active = true
          LEFT JOIN classes c ON s.class_id = c.id
          LEFT JOIN sections sec ON s.section_id = sec.id
          WHERE u.is_active = true AND u.role_id = $1
          ORDER BY u.id, s.id ASC NULLS LAST, u.first_name ASC, u.last_name ASC
        `, [roleNum]);
      } else if (roleNum === ROLES.TEACHER) {
        // Teachers: one row per user (multiple teacher assignments collapse to one representative row)
        result = await query(`
          SELECT DISTINCT ON (u.id)
            u.id, u.username, u.first_name, u.last_name, u.phone, u.email,
            u.role_id, u.is_active, u.created_at,
            ur.role_name,
            st.id as staff_id, st.employee_code, st.joining_date, st.photo_url,
            st.designation_id, st.department_id,
            t.id as teacher_id, t.status as teacher_status,
            c.class_name, sub.subject_name, d.designation_name
          FROM users u
          LEFT JOIN user_roles ur ON u.role_id = ur.id
          LEFT JOIN staff st ON u.id = st.user_id AND st.is_active = true
          LEFT JOIN teachers t ON st.id = t.staff_id
          LEFT JOIN classes c ON t.class_id = c.id
          LEFT JOIN subjects sub ON t.subject_id = sub.id
          LEFT JOIN designations d ON st.designation_id = d.id
          WHERE u.is_active = true AND u.role_id = $1
          ORDER BY u.id, t.id ASC NULLS LAST, u.first_name ASC, u.last_name ASC
        `, [roleNum]);
      } else if (roleNum === 4 || roleNum === 5) {
        // Parents (4) and Guardians (5): include mapped child class/section where available.
        result = await query(`
          SELECT 
            u.id, u.username, u.first_name, u.last_name, u.phone, u.email,
            u.role_id, u.is_active, u.created_at,
            ur.role_name,
            ${classSectionProjection}
          FROM users u
          LEFT JOIN user_roles ur ON u.role_id = ur.id
          ${classSectionJoins}
          WHERE u.is_active = true AND u.role_id = $1
          ORDER BY u.first_name ASC, u.last_name ASC
        `, [roleNum]);
      } else {
        // Other roles (e.g. admin, administrative) - include class/section if linked indirectly.
        result = await query(`
          SELECT
            u.id, u.username, u.first_name, u.last_name, u.phone, u.email,
            u.role_id, u.is_active, u.created_at,
            ur.role_name,
            ${classSectionProjection}
          FROM users u
          LEFT JOIN user_roles ur ON u.role_id = ur.id
          ${classSectionJoins}
          WHERE u.is_active = true AND u.role_id = $1
          ORDER BY u.id ASC
        `, [roleNum]);
      }
    } else {
      // No filter - all users (one row per user)
      result = await query(`
        SELECT
          u.*,
          ur.role_name,
          ${classSectionProjection}
        FROM users u
        LEFT JOIN user_roles ur ON u.role_id = ur.id
        ${classSectionJoins}
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

const getDeleteAccountRequests = async (req, res) => {
  try {
    await ensureDeleteAccountRequestsTable();

    const rows = await query(
      `
      SELECT
        adr.id,
        adr.user_id,
        adr.requisition_date,
        adr.delete_request_date,
        adr.status,
        u.first_name,
        u.last_name,
        u.username,
        u.avatar
      FROM account_delete_requests adr
      INNER JOIN users u ON u.id = adr.user_id
      WHERE u.is_active = true
      ORDER BY adr.requisition_date DESC, adr.id DESC
      `
    );

    const data = (rows.rows || []).map((row) => {
      const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim();
      return {
        id: row.id,
        user_id: row.user_id,
        name: fullName || row.username || `User ${row.user_id}`,
        avatar: row.avatar || '',
        requisition_date: row.requisition_date,
        delete_request_date: row.delete_request_date,
        status: row.status,
      };
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Delete account requests fetched successfully',
      data,
      count: data.length,
    });
  } catch (error) {
    console.error('Error fetching delete account requests:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch delete account requests',
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

/**
 * GET /api/users/check-unique?mobile=&email=&excludeId=
 * Independent checks for active users; excludeId skips that user (edit mode).
 */
const checkUserUnique = async (req, res) => {
  try {
    const mobileRaw = req.query.mobile != null ? String(req.query.mobile).trim() : '';
    const emailRaw = req.query.email != null ? String(req.query.email).trim() : '';
    const excludeRaw = req.query.excludeId;
    const excludeId =
      excludeRaw != null && String(excludeRaw).trim() !== '' ? parseInt(String(excludeRaw).trim(), 10) : null;
    const excludeOk = Number.isFinite(excludeId) && excludeId > 0;

    let mobileExists = false;
    let emailExists = false;

    if (mobileRaw.length >= 4) {
      const digits = mobileRaw.replace(/\D/g, '');
      if (digits.length >= 4) {
        const r = await query(
          `SELECT 1 FROM users WHERE is_active = true
           AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
           AND ($2::int IS NULL OR id <> $2)
           LIMIT 1`,
          [digits, excludeOk ? excludeId : null]
        );
        mobileExists = r.rows.length > 0;
      }
    }

    if (emailRaw.length > 0) {
      const r = await query(
        `SELECT 1 FROM users WHERE is_active = true
         AND email IS NOT NULL
         AND LOWER(TRIM(email)) = LOWER(TRIM($1))
         AND ($2::int IS NULL OR id <> $2)
         LIMIT 1`,
        [emailRaw, excludeOk ? excludeId : null]
      );
      emailExists = r.rows.length > 0;
    }

    return res.status(200).json({
      status: 'SUCCESS',
      mobileExists,
      emailExists,
    });
  } catch (error) {
    console.error('checkUserUnique:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Uniqueness check failed',
    });
  }
};

module.exports = {
  getAllUsers,
  getDeleteAccountRequests,
  getUserById,
  checkUserUnique,
};
