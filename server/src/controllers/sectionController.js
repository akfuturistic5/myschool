const { query } = require('../config/database');
const { canAccessClass } = require('../utils/accessControl');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { resolveAcademicYearId } = require('../utils/academicYear');

const normalizeBool = (v, fallback = true) => {
  if (v === undefined || v === null) return fallback;
  if (v === true || v === 'true' || v === 1 || v === '1' || v === 't' || v === 'T') return true;
  if (v === false || v === 'false' || v === 0 || v === '0' || v === 'f' || v === 'F') return false;
  return fallback;
};

const normalizeSectionName = (v) => {
  const s = String(v ?? '').trim();
  return s.length > 10 ? s.slice(0, 10) : s;
};

const emptyToNull = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const normalizeRoomNumber = (v) => {
  const n = emptyToNull(v);
  if (n === null) return null;
  return n.length > 20 ? n.slice(0, 20) : n;
};

const normalizeDescription = (v) => {
  const n = emptyToNull(v);
  if (n === null) return null;
  return n.length > 5000 ? n.slice(0, 5000) : n;
};

const parseOptionalInt = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

const baseSectionSelect = `
  cs.id,
  sec.id AS section_master_id,
  sec.section_name,
  cs.class_id,
  cs.academic_year_id,
  te.staff_id AS section_teacher_id,
  cs.max_students,
  cs.room_number,
  sec.description,
  cs.is_active,
  cs.created_at,
  cs.created_by,
  cs.updated_at AS modified_at,
  (SELECT COUNT(*)::int
   FROM students st
   LEFT JOIN LATERAL (
     SELECT l.to_class_id, l.to_section_id, l.to_academic_year_id
     FROM student_lifecycle_ledger l
     WHERE l.student_id = st.id
     ORDER BY l.event_date DESC NULLS LAST, l.id DESC
     LIMIT 1
   ) le ON true
   WHERE st.deleted_at IS NULL AND COALESCE(st.is_active, true) = true
     AND le.to_class_id = cs.class_id
     AND le.to_section_id = sec.id
     AND le.to_academic_year_id = cs.academic_year_id
  ) AS no_of_students,
  c.class_name,
  c.class_code,
  u_t.first_name AS teacher_first_name,
  u_t.last_name AS teacher_last_name
`;

const fromClassSectionsJoin = `
  FROM class_sections cs
  INNER JOIN sections sec ON sec.id = cs.section_id
  INNER JOIN classes c ON c.id = cs.class_id
  LEFT JOIN LATERAL (
    SELECT staff_id
    FROM class_teachers ct
    WHERE ct.class_section_id = cs.id
      AND ct.academic_year_id = cs.academic_year_id
      AND ct.deleted_at IS NULL
    ORDER BY (ct.role = 'primary') DESC, ct.id DESC
    LIMIT 1
  ) te ON true
  LEFT JOIN staff stf ON stf.id = te.staff_id
  LEFT JOIN users u_t ON u_t.id = stf.user_id
`;

const getAllSections = async (req, res) => {
  try {
    const academicYearId = await resolveAcademicYearId(req.query?.academic_year_id);
    const params = [];
    let where = 'WHERE cs.deleted_at IS NULL';
    if (academicYearId) {
      params.push(academicYearId);
      where += ` AND cs.academic_year_id = $1`;
    }
    const result = await query(
      `SELECT ${baseSectionSelect} ${fromClassSectionsJoin}
       ${where}
       ORDER BY c.class_name ASC, sec.section_name ASC`,
      params
    );
    return success(res, 200, 'Sections fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching sections:', error);
    return errorResponse(res, 500, 'Failed to fetch sections');
  }
};

const getSectionById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT ${baseSectionSelect} ${fromClassSectionsJoin}
       WHERE cs.id = $1 AND cs.deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Section not found');
    }

    return success(res, 200, 'Section fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching section:', error);
    return errorResponse(res, 500, 'Failed to fetch section');
  }
};

const getSectionsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const access = await canAccessClass(req, classId);
    if (!access.ok) {
      return errorResponse(res, access.status || 403, access.message || 'Access denied');
    }
    const academicYearId = await resolveAcademicYearId(req.query?.academic_year_id);
    const params = [classId];
    let where = 'WHERE cs.class_id = $1 AND cs.deleted_at IS NULL';
    if (academicYearId) {
      params.push(academicYearId);
      where += ' AND cs.academic_year_id = $2';
    }
    if (!academicYearId) {
      where += ' AND cs.is_active = true';
    }
    const result = await query(
      `SELECT ${baseSectionSelect} ${fromClassSectionsJoin}
       ${where}
       ORDER BY sec.section_name ASC`,
      params
    );
    return success(res, 200, 'Sections fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching sections by class:', error);
    return errorResponse(res, 500, 'Failed to fetch sections');
  }
};

const createSection = async (req, res) => {
  try {
    const {
      section_name, class_id, section_teacher_id, max_students, room_number,
      description, is_active, academic_year_id: bodyAy,
    } = req.body;

    const nameNorm = normalizeSectionName(section_name);
    const roomNorm = normalizeRoomNumber(room_number);
    const descNorm = normalizeDescription(description);
    const academicYearId = await resolveAcademicYearId(bodyAy);
    if (!academicYearId) {
      return errorResponse(res, 400, 'academic_year_id is required (or set a current academic year)');
    }

    let maxNorm = 30;
    if (max_students !== undefined && max_students !== null) {
      const p = parseOptionalInt(max_students);
      maxNorm = p != null ? p : 30;
    }

    const createdBy = req.user?.id != null ? parseInt(req.user.id, 10) : null;
    const createdByArg = Number.isInteger(createdBy) ? createdBy : null;
    const classExists = await query('SELECT id FROM classes WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [class_id]);
    if (!classExists.rows.length) return errorResponse(res, 400, 'Invalid class');

    const secRow = await query(
      `INSERT INTO sections (section_name, description, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [nameNorm, descNorm, createdByArg]
    );
    const sectionMasterId = secRow.rows[0].id;

    const cs = await query(
      `INSERT INTO class_sections (
         class_id, section_id, academic_year_id, max_students, room_number, is_active, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [class_id, sectionMasterId, academicYearId, maxNorm, roomNorm, normalizeBool(is_active, true), createdByArg]
    );
    const row = cs.rows[0];

    const tid =
      section_teacher_id != null && section_teacher_id !== ''
        ? parseInt(section_teacher_id, 10)
        : null;
    if (Number.isInteger(tid) && tid > 0) {
      await query(
        `INSERT INTO class_teachers (class_id, class_section_id, staff_id, academic_year_id, role, valid_period)
         VALUES ($1, $2, $3, $4, 'primary', daterange(CURRENT_DATE, '9999-12-31', '[]'))`,
        [class_id, row.id, tid, academicYearId]
      ).catch(() => {});
    }

    const enriched = await query(
      `SELECT ${baseSectionSelect} ${fromClassSectionsJoin}
       WHERE cs.id = $1`,
      [row.id]
    );
    return success(res, 201, 'Section created successfully', enriched.rows[0] || row);
  } catch (error) {
    console.error('Error creating section:', error);
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid class or teacher');
    if (error.code === '23505') return errorResponse(res, 409, 'Section already exists');
    return errorResponse(res, 500, 'Failed to create section');
  }
};

const updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const current = await query(
      `SELECT cs.*, sec.section_name AS sec_name, sec.description AS sec_desc
       FROM class_sections cs
       INNER JOIN sections sec ON sec.id = cs.section_id
       WHERE cs.id = $1 AND cs.deleted_at IS NULL`,
      [id]
    );
    if (!current.rows.length) return errorResponse(res, 404, 'Section not found');
    const cur = current.rows[0];

    const sectionTeacherId = Object.prototype.hasOwnProperty.call(payload, 'section_teacher_id')
      ? payload.section_teacher_id
      : null;

    const sectionName = Object.prototype.hasOwnProperty.call(payload, 'section_name')
      ? normalizeSectionName(payload.section_name)
      : cur.sec_name;

    let maxStudents = cur.max_students;
    if (Object.prototype.hasOwnProperty.call(payload, 'max_students')) {
      if (payload.max_students === null || payload.max_students === undefined) {
        maxStudents = 30;
      } else {
        const p = parseOptionalInt(payload.max_students);
        maxStudents = p != null ? p : cur.max_students;
      }
    }

    const roomNumber = Object.prototype.hasOwnProperty.call(payload, 'room_number')
      ? normalizeRoomNumber(payload.room_number)
      : cur.room_number;

    const description = Object.prototype.hasOwnProperty.call(payload, 'description')
      ? normalizeDescription(payload.description)
      : cur.sec_desc;

    const isActive = Object.prototype.hasOwnProperty.call(payload, 'is_active')
      ? normalizeBool(payload.is_active, cur.is_active)
      : cur.is_active;

    await query(
      `UPDATE sections SET section_name = $1, description = $2, updated_by = $3 WHERE id = $4`,
      [
        sectionName,
        description,
        req.user?.id != null ? parseInt(req.user.id, 10) : null,
        cur.section_id,
      ]
    );

    const result = await query(
      `UPDATE class_sections SET
         max_students = $1,
         room_number = $2,
         is_active = $3,
         updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [maxStudents, roomNumber, isActive, id]
    );

    if (sectionTeacherId !== undefined && sectionTeacherId !== null && sectionTeacherId !== '') {
      const tid = parseInt(sectionTeacherId, 10);
      if (Number.isInteger(tid) && tid > 0) {
        await query(
          `UPDATE class_teachers SET deleted_at = NOW(), updated_at = NOW()
           WHERE class_section_id = $1 AND academic_year_id = $2 AND deleted_at IS NULL`,
          [id, cur.academic_year_id]
        ).catch(() => {});
        await query(
          `INSERT INTO class_teachers (class_id, class_section_id, staff_id, academic_year_id, role, valid_period)
           VALUES ($1, $2, $3, $4, 'primary', daterange(CURRENT_DATE, '9999-12-31', '[]'))`,
          [cur.class_id, id, tid, cur.academic_year_id]
        ).catch(() => {});
      }
    }

    return success(res, 200, 'Section updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating section:', error);
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid teacher reference');
    return errorResponse(res, 500, 'Failed to update section');
  }
};

const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE class_sections SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    if (!result.rows.length) return errorResponse(res, 404, 'Section not found');
    return success(res, 200, 'Section deleted successfully', { id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting section:', error);
    if (error.code === '23503') return errorResponse(res, 409, 'Section is referenced by related records');
    return errorResponse(res, 500, 'Failed to delete section');
  }
};

module.exports = {
  getAllSections,
  getSectionById,
  getSectionsByClass,
  createSection,
  updateSection,
  deleteSection,
};
