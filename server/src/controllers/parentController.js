const multer = require('multer');
const { query, executeTransaction } = require('../config/database');
const { parsePagination } = require('../utils/pagination');
const { getParentsForUser } = require('../utils/parentUserMatch');
const { getAuthContext, isAdmin, parseId, canAccessStudent } = require('../utils/accessControl');
const { getSchoolIdFromRequest } = require('../utils/schoolContext');
const { getStorageProvider } = require('../storage');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { ROLES } = require('../config/roles');
const {
  normalizeTenantProfilePath,
  createOrReuseParentUser,
  assignFatherGuardian,
} = require('../services/parentFlowService');
const {
  syncStudentGuardians,
  loadStudentLinkedUserIds,
  resolveLinkedUser,
  guardiansIsSlimSchema,
  STUDENT_CONTACT_LATERAL_SELECT,
  STUDENT_CONTACT_LATERAL_JOINS,
} = require('../utils/studentContactSync');

async function fetchParentRowByStudentId(studentId, client = null) {
  const q = client ? client.query.bind(client) : query;
  const sql = `
    SELECT
      s.id,
      s.id AS student_id,
      ${STUDENT_CONTACT_LATERAL_SELECT},
      NULL::text AS father_image_url,
      NULL::text AS mother_image_url,
      s.created_at,
      s.modified_at AS updated_at,
      s.first_name AS student_first_name,
      s.last_name AS student_last_name,
      s.admission_number,
      s.roll_number,
      c.class_name,
      sec.section_name
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN sections sec ON s.section_id = sec.id
    ${STUDENT_CONTACT_LATERAL_JOINS}
    WHERE s.id = $1 AND s.is_active = true
    LIMIT 1`;
  const r = await q(sql, [studentId]);
  return r.rows[0] || null;
}

const createParent = async (req, res) => {
  try {
    const {
      student_id, father_name, father_email, father_phone, father_occupation, father_image_url,
      mother_name, mother_email, mother_phone, mother_occupation, mother_image_url,
    } = req.body;

    if (!student_id) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Student ID is required',
      });
    }

    const parentRow = await executeTransaction(async (client) => {
      const slim = await guardiansIsSlimSchema(client);
      if (!slim) {
        const err = new Error('Database not migrated: run npm run db:migrate:unify');
        err.statusCode = 503;
        throw err;
      }
      const chk = await client.query('SELECT id FROM students WHERE id = $1 AND is_active = true LIMIT 1', [student_id]);
      if (chk.rows.length === 0) {
        const err = new Error('Student not found');
        err.statusCode = 400;
        throw err;
      }

      const warnings = [];
      await syncStudentGuardians(
        client,
        student_id,
        {
          effFatherName: father_name,
          effFatherEmail: father_email,
          effFatherPhone: father_phone,
          effFatherOcc: father_occupation,
          effMotherName: mother_name,
          effMotherEmail: mother_email,
          effMotherPhone: mother_phone,
          effMotherOcc: mother_occupation,
          effGFirst: null,
          effGLast: null,
          effGPhone: null,
          effGEmail: null,
          effGOcc: null,
          effGAddr: null,
          effGRel: null,
          fatherUserId: null,
          motherUserId: null,
          guardianUserId: null,
        },
        warnings
      );

      const linked = await loadStudentLinkedUserIds(client.query.bind(client), student_id);
      if (father_image_url && linked.father_person_id) {
        await client.query(`UPDATE users SET avatar = COALESCE(NULLIF(TRIM($1::text), ''), avatar) WHERE id = $2`, [
          father_image_url,
          linked.father_person_id,
        ]);
      }
      if (mother_image_url && linked.mother_person_id) {
        await client.query(`UPDATE users SET avatar = COALESCE(NULLIF(TRIM($1::text), ''), avatar) WHERE id = $2`, [
          mother_image_url,
          linked.mother_person_id,
        ]);
      }

      return fetchParentRowByStudentId(student_id, client);
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Parent contacts saved successfully',
      data: parentRow,
    });
  } catch (error) {
    console.error('Error creating parent:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ status: 'ERROR', message: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ status: 'ERROR', message: error.message });
    }
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to create parent',
    });
  }
};

const updateParent = async (req, res) => {
  try {
    const studentId = parseId(req.params.id);
    if (!studentId) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }

    const {
      father_name, father_email, father_phone, father_occupation, father_image_url,
      mother_name, mother_email, mother_phone, mother_occupation, mother_image_url,
      father_person_id, mother_person_id, guardian_person_id,
    } = req.body;

    const row = await executeTransaction(async (client) => {
      const slim = await guardiansIsSlimSchema(client);
      if (!slim) {
        const err = new Error('Database not migrated: run npm run db:migrate:unify');
        err.statusCode = 503;
        throw err;
      }
      const chk = await client.query('SELECT id FROM students WHERE id = $1 AND is_active = true LIMIT 1', [studentId]);
      if (chk.rows.length === 0) {
        const err = new Error('Student not found');
        err.statusCode = 404;
        throw err;
      }

      const linked = await loadStudentLinkedUserIds(client.query.bind(client), studentId);
      const hasFather = father_name || father_email || father_phone || father_occupation;
      const hasMother = mother_name || mother_email || mother_phone || mother_occupation;

      let fatherUserId = hasFather ? linked.father_person_id : null;
      let motherUserId = hasMother ? linked.mother_person_id : null;
      let guardianUserId = linked.guardian_person_id;

      if (father_person_id) {
        const u = await resolveLinkedUser(client, father_person_id, [ROLES.PARENT]);
        fatherUserId = u.id;
      }
      if (mother_person_id) {
        const u = await resolveLinkedUser(client, mother_person_id, [ROLES.PARENT]);
        motherUserId = u.id;
      }
      if (guardian_person_id) {
        const u = await resolveLinkedUser(client, guardian_person_id, [ROLES.GUARDIAN]);
        guardianUserId = u.id;
      }

      const warnings = [];
      await syncStudentGuardians(
        client,
        studentId,
        {
          effFatherName: father_name,
          effFatherEmail: father_email,
          effFatherPhone: father_phone,
          effFatherOcc: father_occupation,
          effMotherName: mother_name,
          effMotherEmail: mother_email,
          effMotherPhone: mother_phone,
          effMotherOcc: mother_occupation,
          effGFirst: null,
          effGLast: null,
          effGPhone: null,
          effGEmail: null,
          effGOcc: null,
          effGAddr: null,
          effGRel: null,
          fatherUserId,
          motherUserId,
          guardianUserId,
        },
        warnings
      );

      if (father_image_url && fatherUserId) {
        await client.query(`UPDATE users SET avatar = COALESCE(NULLIF(TRIM($1::text), ''), avatar) WHERE id = $2`, [
          father_image_url,
          fatherUserId,
        ]);
      }
      if (mother_image_url && motherUserId) {
        await client.query(`UPDATE users SET avatar = COALESCE(NULLIF(TRIM($1::text), ''), avatar) WHERE id = $2`, [
          mother_image_url,
          motherUserId,
        ]);
      }

      return fetchParentRowByStudentId(studentId, client);
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
        message: 'Student not found',
      });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ status: 'ERROR', message: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ status: 'ERROR', message: error.message });
    }
    console.error('Error updating parent:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update parent',
    });
  }
};

const getMyParents = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Not authenticated',
      });
    }

    const { parents } = await getParentsForUser(userId);

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Parents fetched successfully',
      data: parents,
      count: parents.length,
      pagination: { page: 1, limit: parents.length, total: parents.length, totalPages: 1 },
    });
  } catch (error) {
    console.error('Error fetching my parents:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch parents',
    });
  }
};

const parentListSelectSql = `
        s.id,
        s.id AS student_id,
        ${STUDENT_CONTACT_LATERAL_SELECT},
        NULL::text AS father_image_url,
        NULL::text AS mother_image_url,
        s.created_at,
        s.modified_at AS updated_at,
        s.first_name AS student_first_name,
        s.last_name AS student_last_name,
        s.admission_number,
        s.roll_number,
        c.class_name,
        sec.section_name,
        (SELECT g.user_id FROM guardians g
          WHERE g.student_id = s.id AND g.is_active = true
            AND LOWER(COALESCE(g.guardian_type::text, '')) = 'father'
          ORDER BY g.id ASC LIMIT 1) AS father_user_id`;

const parentListJoins = `
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN sections sec ON s.section_id = sec.id
        ${STUDENT_CONTACT_LATERAL_JOINS}`;

const getAllParents = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const academicYearId = req.query.academic_year_id ? parseInt(req.query.academic_year_id, 10) : null;
    const hasYearFilter = academicYearId != null && !Number.isNaN(academicYearId);
    const ctx = getAuthContext(req);
    const isTeacherRole = ctx.roleId === ROLES.TEACHER || ctx.roleName === 'teacher';

    if (isTeacherRole) {
      if (!ctx.userId) {
        return res.status(401).json({
          status: 'ERROR',
          message: 'Not authenticated',
        });
      }

      const teacherCheck = await query(
        `SELECT t.id, t.staff_id
         FROM teachers t
         INNER JOIN staff st ON t.staff_id = st.id
         WHERE st.user_id = $1 AND st.is_active = true`,
        [ctx.userId]
      );

      if (!teacherCheck.rows.length) {
        return res.status(403).json({
          status: 'ERROR',
          message: 'Access denied. User is not an active teacher.',
        });
      }

      const teacherIds = [...new Set(teacherCheck.rows.map((row) => parseId(row.id)).filter(Boolean))];
      const teacherStaffIds = [...new Set(teacherCheck.rows.map((row) => parseId(row.staff_id)).filter(Boolean))];
      if (!teacherIds.length || !teacherStaffIds.length) {
        return res.status(403).json({
          status: 'ERROR',
          message: 'Access denied. User is not an active teacher.',
        });
      }

      const teacherParams = [teacherIds, teacherStaffIds];
      const academicYearClause = hasYearFilter ? ` AND s.academic_year_id = $${teacherParams.length + 1}` : '';
      if (hasYearFilter) teacherParams.push(academicYearId);
      const teacherId = parseId(teacherCheck.rows[0].id);
      const staffId = parseId(teacherCheck.rows[0].staff_id);
      const academicYearClause = hasYearFilter ? ' AND s.academic_year_id = $3' : '';
      const teacherParams = hasYearFilter ? [staffId, teacherId, academicYearId] : [staffId, teacherId];

      const result = await query(
        `SELECT ${parentListSelectSql}
        ${parentListJoins}
        WHERE s.is_active = true
          AND (
            EXISTS (
              SELECT 1 FROM class_schedules cs
              WHERE cs.teacher_id = ANY($1::int[])
                AND cs.class_id = s.class_id
                AND (cs.section_id = s.section_id OR cs.section_id IS NULL)
            )
            OR EXISTS (
              SELECT 1 FROM teachers t
              WHERE t.id = ANY($1::int[]) AND t.class_id = s.class_id
            )
            OR EXISTS (
              SELECT 1 FROM sections sec_map
              WHERE sec_map.id = s.section_id
                AND sec_map.section_teacher_id = ANY($2::int[])
            )
            OR EXISTS (
              SELECT 1 FROM classes c_map
              WHERE c_map.id = s.class_id
                AND (c_map.class_teacher_id = ANY($1::int[]) OR c_map.class_teacher_id = ANY($2::int[]))
              WHERE t.id = $2 AND t.class_id = s.class_id
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
        FROM students s
        WHERE s.is_active = true${yearWhere}`,
        countParams
      );
      result = await query(
        `SELECT ${parentListSelectSql}
        ${parentListJoins}
        WHERE s.is_active = true${yearWhere}
        ORDER BY s.first_name ASC, s.last_name ASC
        ${limitOffsetPlaceholders}`,
        listParams
      );
    } catch (queryErr) {
      console.warn('Parent list full query failed, using fallback:', queryErr.message);
      countResult = await query(
        `SELECT COUNT(*)::int as total
        FROM students s
        WHERE s.is_active = true${yearWhere}`,
        countParams
      );
      result = await query(
        `SELECT
          s.id,
          s.id AS student_id,
          ${STUDENT_CONTACT_LATERAL_SELECT},
          NULL::text AS father_image_url,
          NULL::text AS mother_image_url,
          s.created_at,
          s.modified_at AS updated_at,
          s.first_name AS student_first_name,
          s.last_name AS student_last_name,
          s.admission_number,
          s.roll_number,
          NULL::text AS class_name,
          NULL::text AS section_name,
          (SELECT g.user_id FROM guardians g
            WHERE g.student_id = s.id AND g.is_active = true
              AND LOWER(COALESCE(g.guardian_type::text, '')) = 'father'
            ORDER BY g.id ASC LIMIT 1) AS father_user_id
        FROM students s
        ${STUDENT_CONTACT_LATERAL_JOINS}
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
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching parents:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch parents',
    });
  }
};

/** :id is student id (contact aggregate per student). */
const getParentById = async (req, res) => {
  try {
    const sid = parseId(req.params.id);
    if (!sid) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }

    const result = await fetchParentRowByStudentId(sid);
    if (!result) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Parent not found',
      });
    }

    const ctx = getAuthContext(req);
    if (!isAdmin(ctx)) {
      const access = await canAccessStudent(req, sid);
      if (!access.ok) {
        return res.status(access.status || 403).json({ status: 'ERROR', message: access.message || 'Access denied' });
      }
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Parent fetched successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error fetching parent:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch parent',
    });
  }
};

const getParentByStudentId = async (req, res) => {
  try {
    const studentId = parseId(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student ID' });
    }

    const access = await canAccessStudent(req, studentId);
    if (!access.ok) {
      return res.status(access.status || 403).json({ status: 'ERROR', message: access.message || 'Access denied' });
    }

    const result = await fetchParentRowByStudentId(studentId);
    if (!result) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Parent not found for this student',
      });
    }

    res.status(200).json({
      status: 'SUCCESS',
      message: 'Parent fetched successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error fetching parent by student ID:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch parent',
    });
  }
};

/**
 * POST /api/parents/profile-image
 * multipart file — JPG, PNG, SVG; max 4MB. Stored under school_{id}/uploads/ (relative path for users.avatar).
 */
const uploadParentProfileImage = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromRequest(req);
    if (!schoolId) {
      return errorResponse(res, 401, 'School context required');
    }
    if (!req.file?.buffer) {
      return errorResponse(res, 400, 'Missing file');
    }
    const provider = getStorageProvider();
    const { relativePath } = await provider.upload(
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
      },
      schoolId,
      'uploads'
    );
    const seg = relativePath.split('/');
    const schoolKey = seg[0];
    const fileName = seg[seg.length - 1];
    const url = `/api/storage/files/${schoolKey}/uploads/${encodeURIComponent(fileName)}`;
    return success(res, 200, 'Uploaded', {
      relativePath,
      url,
      profileImage: relativePath,
    });
  } catch (err) {
    console.error('uploadParentProfileImage:', err.message);
    if (String(err.message || '').includes('not allowed')) {
      return errorResponse(res, 400, 'Only JPG, PNG, SVG allowed');
    }
    return errorResponse(res, 500, 'Upload failed');
  }
};

function handleParentProfileMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 400, 'File too large (max 4MB)');
    }
    return errorResponse(res, 400, err.message);
  }
  if (err) {
    return errorResponse(res, 400, err.message || 'Upload rejected');
  }
  next();
}

/**
 * POST /api/parents/create-with-child
 * Creates users row (parent role) and optionally links guardian (father) to student.
 */
const createParentWithChild = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromRequest(req);
    if (!schoolId) {
      return errorResponse(res, 401, 'School context required');
    }
    const { name, phone, email, student_id, profile_image_path } = req.body;
    const warnings = [];

    const payload = await executeTransaction(async (client) => {
      const slim = await guardiansIsSlimSchema(client);
      if (!slim) {
        const err = new Error('Database not migrated: run npm run db:migrate:unify');
        err.statusCode = 503;
        throw err;
      }

      const avatarPath = normalizeTenantProfilePath(schoolId, profile_image_path);
      if (profile_image_path && !avatarPath) {
        const err = new Error('Invalid profile_image_path for this school');
        err.statusCode = 400;
        throw err;
      }

      const { userId, reused } = await createOrReuseParentUser(
        client,
        {
          fullName: name,
          phone,
          email,
          avatarRelativePath: avatarPath,
        },
        warnings
      );

      let guardian = null;
      let studentName = null;
      if (student_id != null) {
        const sid = parseInt(student_id, 10);
        if (!Number.isFinite(sid) || sid <= 0) {
          const err = new Error('Invalid student_id');
          err.statusCode = 400;
          throw err;
        }
        const chk = await client.query('SELECT id, first_name, last_name FROM students WHERE id = $1 AND is_active = true LIMIT 1', [sid]);
        if (chk.rows.length === 0) {
          const err = new Error('Student not found');
          err.statusCode = 400;
          throw err;
        }
        guardian = await assignFatherGuardian(client, { userId, studentId: sid });
        const r = chk.rows[0];
        studentName = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || null;
      }

      return {
        userId,
        reused,
        guardian,
        studentId: student_id != null ? parseInt(student_id, 10) : null,
        studentName,
      };
    });

    return success(res, 201, 'Parent saved successfully', payload, { warnings });
  } catch (error) {
    console.error('createParentWithChild:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ status: 'ERROR', message: error.message });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ status: 'ERROR', message: error.message });
    }
    res.status(500).json({ status: 'ERROR', message: 'Failed to create parent' });
  }
};

module.exports = {
  createParent,
  updateParent,
  getAllParents,
  getMyParents,
  getParentById,
  getParentByStudentId,
  uploadParentProfileImage,
  handleParentProfileMulterError,
  createParentWithChild,
};
