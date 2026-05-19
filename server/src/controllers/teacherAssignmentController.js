const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const {
  resolveSectionForAssignment,
  getClassAssignmentMeta,
} = require('../utils/teacherAssignmentRules');

const parseId = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : NaN;
};

async function getClassAcademicYearId(classId) {
  const r = await query('SELECT academic_year_id FROM classes WHERE id = $1 LIMIT 1', [classId]);
  return r.rows[0]?.academic_year_id ?? null;
}

async function resolveClassSubjectId(classId, subjectId, academicYearId) {
  const r = await query(
    'SELECT id FROM class_subjects WHERE class_id = $1 AND subject_id = $2 AND academic_year_id = $3 AND deleted_at IS NULL LIMIT 1',
    [classId, subjectId, academicYearId]
  );
  return r.rows[0]?.id ?? null;
}

// --- Class Teacher Assignments ---

const listClassTeacherAssignments = async (req, res) => {
  try {
    const teacherIdRaw = req.query.teacherId != null ? parseId(req.query.teacherId) : null;
    let teacherId = teacherIdRaw;
    const academicYearId = req.query.academicYearId != null ? parseId(req.query.academicYearId) : null;

    // Fallback: If no teacherId provided but user is logged in as a Teacher, try to resolve their staff record
    const isTeacher =
      req.user?.role_id === 2 ||
      String(req.user?.role_name || req.user?.role || '').trim().toLowerCase() === 'teacher';

    if (!teacherId && req.user?.id && isTeacher) {
      const staffCheck = await query(
        'SELECT id FROM staff WHERE user_id = $1 AND status = \'Active\' AND deleted_at IS NULL LIMIT 1',
        [req.user.id]
      );
      if (staffCheck.rows.length > 0) {
        teacherId = parseInt(staffCheck.rows[0].id, 10);
      }
    }

    const params = [];
    let where = 'WHERE ct.deleted_at IS NULL';

    if (teacherId) {
      params.push(teacherId);
      where += ` AND ct.staff_id = $${params.length}`;
    }
    const classId = req.query.classId != null ? parseId(req.query.classId) : null;
    if (classId) {
      params.push(classId);
      where += ` AND ct.class_id = $${params.length}`;
    }
    if (academicYearId) {
      params.push(academicYearId);
      where += ` AND ct.academic_year_id = $${params.length}`;
    }

    const result = await query(
      `SELECT
        ct.id,
        ct.staff_id,
        ct.class_id,
        ct.class_section_id,
        sec.id AS section_id,
        ct.role,
        ct.academic_year_id,
        ct.created_at,
        ct.updated_at,
        c.class_name,
        sec.section_name,
        u.first_name AS teacher_first_name,
        u.last_name AS teacher_last_name
      FROM class_teachers ct
      INNER JOIN staff st ON ct.staff_id = st.id
      INNER JOIN users u ON st.user_id = u.id
      INNER JOIN classes c ON ct.class_id = c.id
      LEFT JOIN class_sections cs ON ct.class_section_id = cs.id
      LEFT JOIN sections sec ON cs.section_id = sec.id
      ${where}
      ORDER BY c.class_name ASC, sec.section_name ASC NULLS FIRST`,
      params
    );

    const data = result.rows.map((r) => ({
      id: r.id,
      teacherId: r.staff_id,
      classId: r.class_id,
      classSectionId: r.class_section_id,
      sectionId: r.section_id,
      role: r.role,
      academicYearId: r.academic_year_id,
      className: r.class_name,
      sectionName: r.section_name,
      teacherFirstName: r.teacher_first_name,
      teacherLastName: r.teacher_last_name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return success(res, 200, 'Class teacher assignments fetched successfully', data);
  } catch (error) {
    console.error('listClassTeacherAssignments:', error);
    return errorResponse(res, 500, 'Failed to fetch class teacher assignments');
  }
};

const createClassTeacherAssignment = async (req, res) => {
  try {
    const teacherId = parseId(req.body.teacherId ?? req.body.teacher_id);
    const classId = parseId(req.body.classId ?? req.body.class_id);
    const sectionRaw = req.body.classSectionId ?? req.body.class_section_id ?? req.body.sectionId ?? req.body.section_id;
    const role = req.body.role || 'primary';
    const academicYearId = parseId(req.body.academicYearId ?? req.body.academic_year_id) || await getClassAcademicYearId(classId);

    if (Number.isNaN(teacherId) || Number.isNaN(classId) || !academicYearId) {
      return errorResponse(res, 400, 'teacherId, classId, and academicYearId are required');
    }

    const resolved = await resolveSectionForAssignment(classId, sectionRaw, academicYearId);
    if (!resolved.ok) return errorResponse(res, resolved.status, resolved.message);

    const ins = await query(
      `INSERT INTO class_teachers (staff_id, class_id, class_section_id, role, academic_year_id, valid_period, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, daterange(CURRENT_DATE, '9999-12-31'::date, '[]'), NOW(), NOW())
       RETURNING *`,
      [teacherId, classId, resolved.classSectionId, role, academicYearId]
    );

    return success(res, 201, 'Class teacher assignment created', ins.rows[0]);
  } catch (error) {
    console.error('createClassTeacherAssignment:', error);
    if (error.code === '23505' || error.code === '23P01') {
      return errorResponse(res, 409, 'Conflict: A primary teacher is already assigned to this class/section for the given period');
    }
    return errorResponse(res, 500, 'Failed to create class teacher assignment');
  }
};

const updateClassTeacherAssignment = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid assignment id');

    const cur = await query('SELECT * FROM class_teachers WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (!cur.rows.length) return errorResponse(res, 404, 'Assignment not found');

    const teacherId = parseId(req.body.teacherId ?? req.body.teacher_id) || cur.rows[0].staff_id;
    const classId = parseId(req.body.classId ?? req.body.class_id) || cur.rows[0].class_id;
    const sectionRaw = req.body.classSectionId ?? req.body.class_section_id ?? req.body.sectionId ?? req.body.section_id ?? cur.rows[0].class_section_id;
    const role = req.body.role || cur.rows[0].role;
    const academicYearId = parseId(req.body.academicYearId ?? req.body.academic_year_id) || cur.rows[0].academic_year_id;

    const resolved = await resolveSectionForAssignment(classId, sectionRaw, academicYearId);
    if (!resolved.ok) return errorResponse(res, resolved.status, resolved.message);

    const upd = await query(
      `UPDATE class_teachers SET
        staff_id = $1,
        class_id = $2,
        class_section_id = $3,
        role = $4,
        academic_year_id = $5,
        updated_at = NOW()
       WHERE id = $6 AND deleted_at IS NULL
       RETURNING *`,
      [teacherId, classId, resolved.classSectionId, role, academicYearId, id]
    );

    return success(res, 200, 'Class teacher assignment updated', upd.rows[0]);
  } catch (error) {
    console.error('updateClassTeacherAssignment:', error);
    if (error.code === '23505' || error.code === '23P01') {
      return errorResponse(res, 409, 'Conflict: Overlap detected for primary teacher assignment');
    }
    return errorResponse(res, 500, 'Failed to update class teacher assignment');
  }
};

const deleteClassTeacherAssignment = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid assignment id');

    const del = await query('UPDATE class_teachers SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id', [id]);
    if (!del.rows.length) return errorResponse(res, 404, 'Assignment not found');

    return success(res, 200, 'Class teacher assignment deleted', { id: del.rows[0].id });
  } catch (error) {
    console.error('deleteClassTeacherAssignment:', error);
    return errorResponse(res, 500, 'Failed to delete class teacher assignment');
  }
};

// --- Subject Teacher Assignments ---

const listSubjectTeacherAssignments = async (req, res) => {
  try {
    const teacherId = req.query.teacherId != null ? parseId(req.query.teacherId) : null;
    const classId = req.query.classId != null ? parseId(req.query.classId) : null;
    const academicYearId = req.query.academicYearId != null ? parseId(req.query.academicYearId) : null;

    const params = [];
    let where = 'WHERE ta.deleted_at IS NULL';

    if (teacherId) {
      params.push(teacherId);
      where += ` AND ta.staff_id = $${params.length}`;
    }
    if (classId) {
      params.push(classId);
      where += ` AND ta.class_id = $${params.length}`;
    }
    if (academicYearId) {
      params.push(academicYearId);
      where += ` AND ta.academic_year_id = $${params.length}`;
    }

    const result = await query(
      `SELECT
        ta.id,
        ta.staff_id,
        ta.class_id,
        ta.class_section_id,
        ta.class_subject_id,
        cs.subject_id,
        ta.academic_year_id,
        ta.created_at,
        ta.updated_at,
        c.class_name,
        sec.section_name,
        sub.subject_name,
        sub.subject_type,
        u.first_name AS teacher_first_name,
        u.last_name AS teacher_last_name
      FROM subject_teacher_assignments ta
      INNER JOIN staff st ON ta.staff_id = st.id
      INNER JOIN users u ON st.user_id = u.id
      INNER JOIN classes c ON ta.class_id = c.id
      LEFT JOIN class_sections clsec ON ta.class_section_id = clsec.id
      LEFT JOIN sections sec ON clsec.section_id = sec.id
      INNER JOIN class_subjects cs ON ta.class_subject_id = cs.id
      INNER JOIN subjects sub ON cs.subject_id = sub.id
      ${where}
      ORDER BY c.class_name ASC, sec.section_name ASC NULLS FIRST, sub.subject_name ASC`,
      params
    );

    const data = result.rows.map((r) => ({
      id: r.id,
      teacherId: r.staff_id,
      classId: r.class_id,
      classSectionId: r.class_section_id,
      classSubjectId: r.class_subject_id,
      subjectId: r.subject_id,
      academicYearId: r.academic_year_id,
      className: r.class_name,
      sectionName: r.section_name,
      subjectName: r.subject_name,
      subjectType: r.subject_type,
      teacherFirstName: r.teacher_first_name,
      teacherLastName: r.teacher_last_name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return success(res, 200, 'Subject teacher assignments fetched successfully', data);
  } catch (error) {
    console.error('listSubjectTeacherAssignments:', error);
    return errorResponse(res, 500, 'Failed to fetch subject teacher assignments');
  }
};

const createSubjectTeacherAssignment = async (req, res) => {
  try {
    const teacherId = parseId(req.body.teacherId ?? req.body.teacher_id);
    const classId = parseId(req.body.classId ?? req.body.class_id);
    const subjectId = parseId(req.body.subjectId ?? req.body.subject_id);
    const sectionRaw = req.body.classSectionId ?? req.body.class_section_id ?? req.body.sectionId ?? req.body.section_id;
    const academicYearId = parseId(req.body.academicYearId ?? req.body.academic_year_id) || await getClassAcademicYearId(classId);

    if (Number.isNaN(teacherId) || Number.isNaN(classId) || Number.isNaN(subjectId) || !academicYearId) {
      return errorResponse(res, 400, 'teacherId, classId, subjectId, and academicYearId are required');
    }

    const classSubId = await resolveClassSubjectId(classId, subjectId, academicYearId);
    if (!classSubId) return errorResponse(res, 400, 'Subject is not mapped to this class in the selected academic year');

    const resolved = await resolveSectionForAssignment(classId, sectionRaw, academicYearId);
    if (!resolved.ok) return errorResponse(res, resolved.status, resolved.message);

    const ins = await query(
      `INSERT INTO subject_teacher_assignments (staff_id, class_id, class_section_id, class_subject_id, academic_year_id, valid_period, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, daterange(CURRENT_DATE, '9999-12-31'::date, '[]'), NOW(), NOW())
       RETURNING *`,
      [teacherId, classId, resolved.classSectionId, classSubId, academicYearId]
    );

    return success(res, 201, 'Subject teacher assignment created', ins.rows[0]);
  } catch (error) {
    console.error('createSubjectTeacherAssignment:', error);
    if (error.code === '23505' || error.code === '23P01') {
      return errorResponse(res, 409, 'Conflict: Assignment already exists or overlaps');
    }
    return errorResponse(res, 500, 'Failed to create subject teacher assignment');
  }
};

const updateSubjectTeacherAssignment = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid assignment id');

    const cur = await query('SELECT * FROM subject_teacher_assignments WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (!cur.rows.length) return errorResponse(res, 404, 'Assignment not found');

    const teacherId = parseId(req.body.teacherId ?? req.body.teacher_id) || cur.rows[0].staff_id;
    const classId = parseId(req.body.classId ?? req.body.class_id) || cur.rows[0].class_id;
    const subjectId = parseId(req.body.subjectId ?? req.body.subject_id);
    const sectionRaw = req.body.classSectionId ?? req.body.class_section_id ?? req.body.sectionId ?? req.body.section_id ?? cur.rows[0].class_section_id;
    const academicYearId = parseId(req.body.academicYearId ?? req.body.academic_year_id) || cur.rows[0].academic_year_id;

    let classSubId = cur.rows[0].class_subject_id;
    if (subjectId && !Number.isNaN(subjectId)) {
      classSubId = await resolveClassSubjectId(classId, subjectId, academicYearId);
      if (!classSubId) return errorResponse(res, 400, 'Subject is not mapped to this class/year');
    }

    const resolved = await resolveSectionForAssignment(classId, sectionRaw, academicYearId);
    if (!resolved.ok) return errorResponse(res, resolved.status, resolved.message);

    const upd = await query(
      `UPDATE subject_teacher_assignments SET
        staff_id = $1,
        class_id = $2,
        class_section_id = $3,
        class_subject_id = $4,
        academic_year_id = $5,
        updated_at = NOW()
       WHERE id = $6 AND deleted_at IS NULL
       RETURNING *`,
      [teacherId, classId, resolved.classSectionId, classSubId, academicYearId, id]
    );

    return success(res, 200, 'Subject teacher assignment updated', upd.rows[0]);
  } catch (error) {
    console.error('updateSubjectTeacherAssignment:', error);
    if (error.code === '23505' || error.code === '23P01') {
      return errorResponse(res, 409, 'Conflict: Assignment overlaps or already exists');
    }
    return errorResponse(res, 500, 'Failed to update subject teacher assignment');
  }
};

const deleteSubjectTeacherAssignment = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid assignment id');

    const del = await query('UPDATE subject_teacher_assignments SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id', [id]);
    if (!del.rows.length) return errorResponse(res, 404, 'Assignment not found');

    return success(res, 200, 'Subject teacher assignment deleted', { id: del.rows[0].id });
  } catch (error) {
    console.error('deleteSubjectTeacherAssignment:', error);
    return errorResponse(res, 500, 'Failed to delete subject teacher assignment');
  }
};

const getClassAssignmentMetaHandler = async (req, res) => {
  try {
    const classId = parseId(req.params.classId);
    const academicYearId = parseId(req.query.academicYearId);
    if (Number.isNaN(classId)) return errorResponse(res, 400, 'Invalid class id');
    if (Number.isNaN(academicYearId)) return errorResponse(res, 400, 'academicYearId is required for meta');

    const meta = await getClassAssignmentMeta(classId, academicYearId);
    if (!meta.ok) return errorResponse(res, meta.status, meta.message);
    return success(res, 200, 'Assignment rules for class', meta.data);
  } catch (error) {
    console.error('getClassAssignmentMetaHandler:', error);
    return errorResponse(res, 500, 'Failed to load class assignment rules');
  }
};

module.exports = {
  getClassAssignmentMetaHandler,
  // Class Teachers
  listClassTeacherAssignments,
  createClassTeacherAssignment,
  updateClassTeacherAssignment,
  deleteClassTeacherAssignment,
  // Subject Teachers
  listSubjectTeacherAssignments,
  createSubjectTeacherAssignment,
  updateSubjectTeacherAssignment,
  deleteSubjectTeacherAssignment,
};
