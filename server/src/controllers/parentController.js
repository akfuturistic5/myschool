const { query, executeTransaction } = require('../config/database');
const { parsePagination } = require('../utils/pagination');
const { createParentIndividualUser } = require('../utils/createPersonUser');
const { getParentsForUser } = require('../utils/parentUserMatch');
const { getAuthContext, isAdmin, parseId } = require('../utils/accessControl');

// Create new parent
const createParent = async (req, res) => {
  try {
    const {
      student_id, father_name, father_email, father_phone, father_occupation, father_image_url,
      mother_name, mother_email, mother_phone, mother_occupation, mother_image_url
    } = req.body;

    // Validate required fields
    if (!student_id) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Student ID is required'
      });
    }

    // Check if parent already exists for this student
    const existingParent = await query(
      'SELECT id FROM parents WHERE student_id = $1',
      [student_id]
    );

    if (existingParent.rows.length > 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Parent record already exists for this student'
      });
    }

    const parentRow = await executeTransaction(async (client) => {
      const result = await client.query(`
        INSERT INTO parents (
          student_id, father_name, father_email, father_phone, father_occupation, father_image_url,
          mother_name, mother_email, mother_phone, mother_occupation, mother_image_url,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING *
      `, [
        student_id, father_name || null, father_email || null, father_phone || null,
        father_occupation || null, father_image_url || null, mother_name || null,
        mother_email || null, mother_phone || null, mother_occupation || null,
        mother_image_url || null
      ]);
      const row = result.rows[0];
      let fatherUserId = null;
      let motherUserId = null;
      try {
        if (father_phone || father_email) {
          fatherUserId = await createParentIndividualUser(client, {
            full_name: father_name,
            email: father_email,
            phone: father_phone,
            parent_row_id: row.id,
            side: 'father',
          });
        }
        if (mother_phone || mother_email) {
          motherUserId = await createParentIndividualUser(client, {
            full_name: mother_name,
            email: mother_email,
            phone: mother_phone,
            parent_row_id: row.id,
            side: 'mother',
          });
        }
      } catch (e) {
        console.warn('createParent: could not create parent users:', e.message);
      }
      await client.query(
        `UPDATE parents SET
          father_user_id = $1::integer,
          mother_user_id = $2::integer,
          user_id = COALESCE($1::integer, $2::integer),
          updated_at = NOW()
        WHERE id = $3::integer`,
        [fatherUserId, motherUserId, row.id]
      );
      row.father_user_id = fatherUserId;
      row.mother_user_id = motherUserId;
      row.user_id = fatherUserId || motherUserId || row.user_id;
      return row;
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Parent created successfully',
      data: parentRow
    });
  } catch (error) {
    console.error('Error creating parent:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to create parent',
    });
  }
};

// Update parent
const updateParent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      father_name, father_email, father_phone, father_occupation, father_image_url,
      mother_name, mother_email, mother_phone, mother_occupation, mother_image_url
    } = req.body;

    const row = await executeTransaction(async (client) => {
      const result = await client.query(
        `
      UPDATE parents SET
        father_name = $1,
        father_email = $2,
        father_phone = $3,
        father_occupation = $4,
        father_image_url = $5,
        mother_name = $6,
        mother_email = $7,
        mother_phone = $8,
        mother_occupation = $9,
        mother_image_url = $10,
        updated_at = NOW()
      WHERE id = $11
      RETURNING id, father_user_id, mother_user_id
    `,
        [
          father_name || null,
          father_email || null,
          father_phone || null,
          father_occupation || null,
          father_image_url || null,
          mother_name || null,
          mother_email || null,
          mother_phone || null,
          mother_occupation || null,
          mother_image_url || null,
          id,
        ]
      );

      if (result.rows.length === 0) {
        const err = new Error('Parent not found');
        err.statusCode = 404;
        throw err;
      }

      const p = result.rows[0];
      let newFatherUserId = null;
      let newMotherUserId = null;
      try {
        if ((father_phone || father_email) && !p.father_user_id) {
          newFatherUserId = await createParentIndividualUser(client, {
            full_name: father_name,
            email: father_email,
            phone: father_phone,
            parent_row_id: p.id,
            side: 'father',
          });
        }
        if ((mother_phone || mother_email) && !p.mother_user_id) {
          newMotherUserId = await createParentIndividualUser(client, {
            full_name: mother_name,
            email: mother_email,
            phone: mother_phone,
            parent_row_id: p.id,
            side: 'mother',
          });
        }
      } catch (e) {
        console.warn('updateParent: could not create parent users:', e.message);
      }

      await client.query(
        `UPDATE parents SET
          father_user_id = COALESCE($1::integer, father_user_id),
          mother_user_id = COALESCE($2::integer, mother_user_id),
          user_id = COALESCE(user_id, father_user_id, mother_user_id),
          updated_at = NOW()
        WHERE id = $3`,
        [newFatherUserId, newMotherUserId, p.id]
      );

      const full = await client.query('SELECT * FROM parents WHERE id = $1', [p.id]);
      return full.rows[0];
    });

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Parent updated successfully',
      data: row,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Parent not found',
      });
    }
    console.error('Error updating parent:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update parent',
    });
  }
};

// Get parents for current logged-in user (Parent role)
// Uses parentUserMatch: 1) username+@email.com (unique), 2) email, 3) phone
const getMyParents = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Not authenticated'
      });
    }

    const { parents } = await getParentsForUser(userId);

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Parents fetched successfully',
      data: parents,
      count: parents.length,
      pagination: { page: 1, limit: parents.length, total: parents.length, totalPages: 1 }
    });
  } catch (error) {
    console.error('Error fetching my parents:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch parents',
    });
  }
};

// Get all parents (optional query: academic_year_id - only parents whose student is in that year)
const getAllParents = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    const hasYearFilter = academicYearId != null && !Number.isNaN(academicYearId);
    const ctx = getAuthContext(req);
    const isTeacherRole = ctx.roleId === 3 || ctx.roleName === 'teacher';

    if (isTeacherRole) {
      if (!ctx.userId) {
        return res.status(401).json({
          status: 'ERROR',
          message: 'Not authenticated',
        });
      }

      const teacherCheck = await query(
        `SELECT t.id
         FROM teachers t
         INNER JOIN staff st ON t.staff_id = st.id
         WHERE st.user_id = $1 AND st.is_active = true
         LIMIT 1`,
        [ctx.userId]
      );

      if (!teacherCheck.rows.length) {
        return res.status(403).json({
          status: 'ERROR',
          message: 'Access denied. User is not an active teacher.',
        });
      }

      const teacherId = parseId(teacherCheck.rows[0].id);
      const academicYearClause = hasYearFilter ? ' AND s.academic_year_id = $2' : '';
      const teacherParams = hasYearFilter ? [teacherId, academicYearId] : [teacherId];

      const result = await query(
        `SELECT
          p.id,
          p.student_id,
          p.father_name,
          p.father_email,
          p.father_phone,
          p.father_occupation,
          p.father_image_url,
          p.mother_name,
          p.mother_email,
          p.mother_phone,
          p.mother_occupation,
          p.mother_image_url,
          p.created_at,
          p.updated_at,
          s.first_name as student_first_name,
          s.last_name as student_last_name,
          s.admission_number,
          s.roll_number,
          c.class_name,
          sec.section_name
        FROM parents p
        INNER JOIN students s ON p.student_id = s.id
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN sections sec ON s.section_id = sec.id
        WHERE s.is_active = true
          AND (
            EXISTS (
              SELECT 1 FROM class_schedules cs
              WHERE cs.teacher_id = $1
                AND cs.class_id = s.class_id
                AND (cs.section_id = s.section_id OR cs.section_id IS NULL)
            )
            OR EXISTS (
              SELECT 1 FROM teachers t
              WHERE t.id = $1 AND t.class_id = s.class_id
            )
          )${academicYearClause}
        ORDER BY s.first_name ASC, s.last_name ASC`,
        teacherParams
      );

      return res.status(200).json({
        status: 'SUCCESS',
        message: 'Parents fetched successfully',
        data: result.rows,
        count: result.rows.length,
        pagination: { page: 1, limit: result.rows.length, total: result.rows.length, totalPages: 1 },
      });
    }

    if (!isAdmin(ctx)) {
      return res.status(403).json({
        status: 'ERROR',
        message: 'Access denied',
      });
    }

    const yearWhere = hasYearFilter ? ' AND s.academic_year_id = $1' : '';
    const countParams = hasYearFilter ? [academicYearId] : [];
    const listParams = hasYearFilter ? [academicYearId, limit, offset] : [limit, offset];
    const limitOffsetPlaceholders = hasYearFilter ? 'LIMIT $2 OFFSET $3' : 'LIMIT $1 OFFSET $2';

    let countResult;
    let result;
    try {
      countResult = await query(
        `SELECT COUNT(*)::int as total
        FROM parents p
        LEFT JOIN students s ON p.student_id = s.id
        WHERE s.is_active = true${yearWhere}`,
        countParams
      );
      result = await query(
        `SELECT
          p.id,
          p.student_id,
          p.father_name,
          p.father_email,
          p.father_phone,
          p.father_occupation,
          p.father_image_url,
          p.mother_name,
          p.mother_email,
          p.mother_phone,
          p.mother_occupation,
          p.mother_image_url,
          p.created_at,
          p.updated_at,
          s.first_name as student_first_name,
          s.last_name as student_last_name,
          s.admission_number,
          s.roll_number,
          c.class_name,
          sec.section_name
        FROM parents p
        LEFT JOIN students s ON p.student_id = s.id
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN sections sec ON s.section_id = sec.id
        WHERE s.is_active = true${yearWhere}
        ORDER BY s.first_name ASC, s.last_name ASC
        ${limitOffsetPlaceholders}`,
        listParams
      );
    } catch (queryErr) {
      // Fallback: simpler query if classes/sections tables are missing or have schema issues
      console.warn('Parent list full query failed, using fallback:', queryErr.message);
      countResult = await query(
        `SELECT COUNT(*)::int as total
        FROM parents p
        LEFT JOIN students s ON p.student_id = s.id
        WHERE s.is_active = true${yearWhere}`,
        countParams
      );
      result = await query(
        `SELECT
          p.id,
          p.student_id,
          p.father_name,
          p.father_email,
          p.father_phone,
          p.father_occupation,
          p.father_image_url,
          p.mother_name,
          p.mother_email,
          p.mother_phone,
          p.mother_occupation,
          p.mother_image_url,
          p.created_at,
          p.updated_at,
          s.first_name as student_first_name,
          s.last_name as student_last_name,
          s.admission_number,
          s.roll_number,
          NULL::text as class_name,
          NULL::text as section_name
        FROM parents p
        LEFT JOIN students s ON p.student_id = s.id
        WHERE s.is_active = true${yearWhere}
        ORDER BY s.first_name ASC, s.last_name ASC
        ${limitOffsetPlaceholders}`,
        listParams
      );
    }

    const total = countResult.rows[0].total;
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Parents fetched successfully',
      data: result.rows,
      count: result.rows.length,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching parents:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch parents',
    });
  }
};

// Get parent by ID
const getParentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { canAccessStudent, parseId, isAdmin, getAuthContext } = require('../utils/accessControl');
    const pid = parseId(id);
    if (!pid) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid parent ID' });
    }
    
    const result = await query(`
      SELECT
        p.id,
        p.student_id,
        p.father_name,
        p.father_email,
        p.father_phone,
        p.father_occupation,
        p.father_image_url,
        p.mother_name,
        p.mother_email,
        p.mother_phone,
        p.mother_occupation,
        p.mother_image_url,
        p.created_at,
        p.updated_at,
        s.first_name as student_first_name,
        s.last_name as student_last_name,
        s.admission_number,
        s.roll_number,
        c.class_name,
        sec.section_name
      FROM parents p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE p.id = $1 AND s.is_active = true
    `, [pid]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Parent not found'
      });
    }

    const ctx = getAuthContext(req);
    if (!isAdmin(ctx)) {
      const sid = result.rows[0]?.student_id;
      const access = await canAccessStudent(req, sid);
      if (!access.ok) {
        return res.status(access.status || 403).json({ status: 'ERROR', message: access.message || 'Access denied' });
      }
    }
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Parent fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching parent:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch parent',
    });
  }
};

// Get parent by student ID
const getParentByStudentId = async (req, res) => {
  try {
    const { canAccessStudent, parseId } = require('../utils/accessControl');
    const studentId = parseId(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }

    const access = await canAccessStudent(req, studentId);
    if (!access.ok) {
      return res.status(access.status || 403).json({ status: 'ERROR', message: access.message || 'Access denied' });
    }
    
    const result = await query(`
      SELECT
        p.id,
        p.student_id,
        p.father_name,
        p.father_email,
        p.father_phone,
        p.father_occupation,
        p.father_image_url,
        p.mother_name,
        p.mother_email,
        p.mother_phone,
        p.mother_occupation,
        p.mother_image_url,
        p.created_at,
        p.updated_at,
        s.first_name as student_first_name,
        s.last_name as student_last_name,
        s.admission_number,
        s.roll_number,
        c.class_name,
        sec.section_name
      FROM parents p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN sections sec ON s.section_id = sec.id
      WHERE p.student_id = $1 AND s.is_active = true
    `, [studentId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Parent not found for this student'
      });
    }
    
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Parent fetched successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching parent by student ID:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch parent',
    });
  }
};

module.exports = {
  createParent,
  updateParent,
  getAllParents,
  getMyParents,
  getParentById,
  getParentByStudentId
};
