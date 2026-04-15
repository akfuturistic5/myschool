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

const rowToApi = (row) => ({
  id: row.id,
  teacherId: row.teacher_id,
  classId: row.class_id,
  sectionId: row.section_id,
  subjectId: row.subject_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const listTeacherAssignments = async (req, res) => {
  try {
    const teacherId = req.query.teacherId != null ? parseId(req.query.teacherId) : null;
    const classId = req.query.classId != null ? parseId(req.query.classId) : null;
    const params = [];
    let where = 'WHERE 1=1';
    if (teacherId) {
      params.push(teacherId);
      where += ` AND ta.teacher_id = $${params.length}`;
    }
    if (classId) {
      params.push(classId);
      where += ` AND ta.class_id = $${params.length}`;
    }
    const result = await query(
      `SELECT
        ta.id,
        ta.teacher_id,
        ta.class_id,
        ta.section_id,
        ta.subject_id,
        ta.created_at,
        ta.updated_at,
        c.class_name,
        sec.section_name,
        sub.subject_name,
        st.first_name AS teacher_first_name,
        st.last_name AS teacher_last_name
      FROM teacher_assignments ta
      INNER JOIN teachers t ON ta.teacher_id = t.id
      INNER JOIN staff st ON t.staff_id = st.id
      INNER JOIN classes c ON ta.class_id = c.id
      LEFT JOIN sections sec ON ta.section_id = sec.id
      INNER JOIN subjects sub ON ta.subject_id = sub.id
      ${where}
      ORDER BY c.class_name ASC, sec.section_name ASC NULLS FIRST, sub.subject_name ASC`,
      params
    );
    const data = result.rows.map((r) => ({
      ...rowToApi(r),
      className: r.class_name,
      sectionName: r.section_name,
      subjectName: r.subject_name,
      teacherFirstName: r.teacher_first_name,
      teacherLastName: r.teacher_last_name,
    }));
    return success(res, 200, 'Teacher assignments fetched successfully', data, { count: data.length });
  } catch (error) {
    console.error('listTeacherAssignments:', error);
    return errorResponse(res, 500, 'Failed to fetch teacher assignments');
  }
};

const getClassAssignmentMetaHandler = async (req, res) => {
  try {
    const classId = parseId(req.params.classId);
    if (Number.isNaN(classId)) return errorResponse(res, 400, 'Invalid class id');
    const meta = await getClassAssignmentMeta(classId);
    if (!meta.ok) return errorResponse(res, meta.status, meta.message);
    return success(res, 200, 'Assignment rules for class', meta.data);
  } catch (error) {
    console.error('getClassAssignmentMetaHandler:', error);
    return errorResponse(res, 500, 'Failed to load class assignment rules');
  }
};

const createTeacherAssignment = async (req, res) => {
  try {
    const teacherId = parseId(req.body.teacherId ?? req.body.teacher_id);
    const classId = parseId(req.body.classId ?? req.body.class_id);
    const subjectId = parseId(req.body.subjectId ?? req.body.subject_id);
    const sectionRaw = req.body.sectionId ?? req.body.section_id;

    if (Number.isNaN(teacherId) || Number.isNaN(classId) || Number.isNaN(subjectId)) {
      return errorResponse(res, 400, 'teacherId, classId, and subjectId are required');
    }

    const tExists = await query('SELECT 1 FROM teachers WHERE id = $1', [teacherId]);
    if (!tExists.rows.length) return errorResponse(res, 400, 'Teacher not found');

    const subj = await query(
      `SELECT 1 FROM subjects WHERE id = $1 AND (class_id IS NULL OR class_id = $2) LIMIT 1`,
      [subjectId, classId]
    );
    if (!subj.rows.length) {
      return errorResponse(res, 400, 'Subject is not valid for this class');
    }

    const resolved = await resolveSectionForAssignment(classId, sectionRaw);
    if (!resolved.ok) {
      return errorResponse(res, resolved.status, resolved.message);
    }

    const ins = await query(
      `INSERT INTO teacher_assignments (teacher_id, class_id, section_id, subject_id, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [teacherId, classId, resolved.sectionId, subjectId]
    );
    return success(res, 201, 'Teacher assignment created', rowToApi(ins.rows[0]));
  } catch (error) {
    console.error('createTeacherAssignment:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'This assignment already exists');
    }
    if (error.code === '23503') {
      return errorResponse(res, 400, 'Invalid teacher, class, section, or subject reference');
    }
    return errorResponse(res, 500, 'Failed to create teacher assignment');
  }
};

const updateTeacherAssignment = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    const cur = await query('SELECT * FROM teacher_assignments WHERE id = $1', [id]);
    if (!cur.rows.length) return errorResponse(res, 404, 'Assignment not found');

    const teacherId = parseId(req.body.teacherId ?? req.body.teacher_id ?? cur.rows[0].teacher_id);
    const classId = parseId(req.body.classId ?? req.body.class_id ?? cur.rows[0].class_id);
    const subjectId = parseId(req.body.subjectId ?? req.body.subject_id ?? cur.rows[0].subject_id);
    const sectionRaw =
      req.body.sectionId !== undefined || req.body.section_id !== undefined
        ? req.body.sectionId ?? req.body.section_id
        : cur.rows[0].section_id;

    if (Number.isNaN(teacherId) || Number.isNaN(classId) || Number.isNaN(subjectId)) {
      return errorResponse(res, 400, 'Invalid teacherId, classId, or subjectId');
    }

    const tExists = await query('SELECT 1 FROM teachers WHERE id = $1', [teacherId]);
    if (!tExists.rows.length) return errorResponse(res, 400, 'Teacher not found');

    const subj = await query(
      `SELECT 1 FROM subjects WHERE id = $1 AND (class_id IS NULL OR class_id = $2) LIMIT 1`,
      [subjectId, classId]
    );
    if (!subj.rows.length) {
      return errorResponse(res, 400, 'Subject is not valid for this class');
    }

    const resolved = await resolveSectionForAssignment(classId, sectionRaw);
    if (!resolved.ok) {
      return errorResponse(res, resolved.status, resolved.message);
    }

    const upd = await query(
      `UPDATE teacher_assignments SET
        teacher_id = $1,
        class_id = $2,
        section_id = $3,
        subject_id = $4,
        updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [teacherId, classId, resolved.sectionId, subjectId, id]
    );
    return success(res, 200, 'Teacher assignment updated', rowToApi(upd.rows[0]));
  } catch (error) {
    console.error('updateTeacherAssignment:', error);
    if (error.code === '23505') {
      return errorResponse(res, 409, 'This assignment already exists');
    }
    if (error.code === '23503') {
      return errorResponse(res, 400, 'Invalid reference');
    }
    return errorResponse(res, 500, 'Failed to update teacher assignment');
  }
};

const deleteTeacherAssignment = async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid id');
    const del = await query('DELETE FROM teacher_assignments WHERE id = $1 RETURNING id', [id]);
    if (!del.rows.length) return errorResponse(res, 404, 'Assignment not found');
    return success(res, 200, 'Teacher assignment deleted', { id: del.rows[0].id });
  } catch (error) {
    console.error('deleteTeacherAssignment:', error);
    return errorResponse(res, 500, 'Failed to delete teacher assignment');
  }
};

module.exports = {
  listTeacherAssignments,
  getClassAssignmentMetaHandler,
  createTeacherAssignment,
  updateTeacherAssignment,
  deleteTeacherAssignment,
};
