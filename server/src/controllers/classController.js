const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { resolveAcademicYearId } = require('../utils/academicYear');

const normalizeBool = (v, fallback = true) => {
  if (v === undefined || v === null) return fallback;
  if (v === true || v === 'true' || v === 1 || v === '1' || v === 't' || v === 'T') return true;
  if (v === false || v === 'false' || v === 0 || v === '0' || v === 'f' || v === 'F') return false;
  return fallback;
};

const emptyToNull = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const normalizeClassCode = (v) => {
  const n = emptyToNull(v);
  if (n === null) return null;
  return n.length > 10 ? n.slice(0, 10) : n;
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

const pickPayload = (payload, key, current) =>
  Object.prototype.hasOwnProperty.call(payload, key) ? payload[key] : current;

const getAllClasses = async (req, res) => {
  try {
    const academicYearId = await resolveAcademicYearId(req.query?.academic_year_id);
    const params = [];
    let p = 0;
    const ayCondSubjects = academicYearId ? 'AND csj.academic_year_id = $1' : '';
    const ayCondTeacher = academicYearId ? 'AND ct.academic_year_id = $1' : '';
    const ayCondSections = academicYearId ? 'AND csx.academic_year_id = $1' : '';
    if (academicYearId) {
      p += 1;
      params.push(academicYearId);
    }

    const result = await query(
      `
      SELECT
        c.id,
        c.class_name,
        c.class_code,
        ct.staff_id AS class_teacher_id,
        c.max_students,
        NULL::numeric AS class_fee,
        c.description,
        c.is_active,
        EXISTS (
          SELECT 1 FROM class_sections csx
          WHERE csx.class_id = c.id AND csx.deleted_at IS NULL
        ) AS has_sections,
        (SELECT COALESCE(json_agg(csx.section_id), '[]'::json)
         FROM class_sections csx
         WHERE csx.class_id = c.id AND csx.deleted_at IS NULL
           ${ayCondSections}
        ) AS section_ids,
        c.created_at,
        (SELECT COUNT(*)::int
         FROM students st
         LEFT JOIN LATERAL (
           SELECT l.to_class_id
           FROM student_lifecycle_ledger l
           WHERE l.student_id = st.id
           ORDER BY l.event_date DESC NULLS LAST, l.id DESC
           LIMIT 1
         ) le ON true
         WHERE st.deleted_at IS NULL AND st.status = \'Active\'
           AND le.to_class_id = c.id
        ) AS no_of_students,
        (SELECT COUNT(DISTINCT csj.subject_id)::int
         FROM class_subjects csj
         WHERE csj.class_id = c.id AND csj.deleted_at IS NULL
           ${ayCondSubjects}
        ) AS no_of_subjects,
        u.first_name AS teacher_first_name,
        u.last_name AS teacher_last_name
      FROM classes c
      LEFT JOIN LATERAL (
        SELECT staff_id, academic_year_id
        FROM class_teachers ct
        WHERE ct.class_id = c.id
          AND ct.class_section_id IS NULL
          AND ct.deleted_at IS NULL
          ${ayCondTeacher}
        ORDER BY (ct.role = 'primary') DESC, ct.id DESC
        LIMIT 1
      ) ct ON true
      LEFT JOIN staff sf ON sf.id = ct.staff_id
      LEFT JOIN users u ON u.id = sf.user_id
      WHERE c.deleted_at IS NULL
      ORDER BY c.class_name ASC
    `,
      params
    );

    return success(res, 200, 'Classes fetched successfully', result.rows, { count: result.rows.length });
  } catch (error) {
    console.error('Error fetching classes:', error);
    return errorResponse(res, 500, 'Failed to fetch classes');
  }
};

const getClassById = async (req, res) => {
  try {
    const { id } = req.params;
    const academicYearId = await resolveAcademicYearId(req.query?.academic_year_id);
    const params = [id];
    const ayCondSubjects = academicYearId ? 'AND csj.academic_year_id = $2' : '';
    const ayCondTeacher = academicYearId ? 'AND ct.academic_year_id = $2' : '';
    const ayCondSections = academicYearId ? 'AND csx.academic_year_id = $2' : '';
    if (academicYearId) params.push(academicYearId);

    const result = await query(
      `
      SELECT
        c.id,
        c.class_name,
        c.class_code,
        ct.staff_id AS class_teacher_id,
        c.max_students,
        NULL::numeric AS class_fee,
        c.description,
        c.is_active,
        EXISTS (
          SELECT 1 FROM class_sections csx
          WHERE csx.class_id = c.id AND csx.deleted_at IS NULL
        ) AS has_sections,
        (SELECT COALESCE(json_agg(csx.section_id), '[]'::json)
         FROM class_sections csx
         WHERE csx.class_id = c.id AND csx.deleted_at IS NULL
           ${ayCondSections}
        ) AS section_ids,
        c.created_at,
        (SELECT COUNT(*)::int
         FROM students st
         LEFT JOIN LATERAL (
           SELECT l.to_class_id
           FROM student_lifecycle_ledger l
           WHERE l.student_id = st.id
           ORDER BY l.event_date DESC NULLS LAST, l.id DESC
           LIMIT 1
         ) le ON true
         WHERE st.deleted_at IS NULL AND st.status = \'Active\'
           AND le.to_class_id = c.id
        ) AS no_of_students,
        (SELECT COUNT(DISTINCT csj.subject_id)::int
         FROM class_subjects csj
         WHERE csj.class_id = c.id AND csj.deleted_at IS NULL
           ${ayCondSubjects}
        ) AS no_of_subjects,
        u.first_name AS teacher_first_name,
        u.last_name AS teacher_last_name
      FROM classes c
      LEFT JOIN LATERAL (
        SELECT staff_id, academic_year_id
        FROM class_teachers ct
        WHERE ct.class_id = c.id
          AND ct.class_section_id IS NULL
          AND ct.deleted_at IS NULL
          ${ayCondTeacher}
        ORDER BY (ct.role = 'primary') DESC, ct.id DESC
        LIMIT 1
      ) ct ON true
      LEFT JOIN staff sf ON sf.id = ct.staff_id
      LEFT JOIN users u ON u.id = sf.user_id
      WHERE c.id = $1 AND c.deleted_at IS NULL
    `,
      params
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Class not found');
    }

    return success(res, 200, 'Class fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching class:', error);
    return errorResponse(res, 500, 'Failed to fetch class');
  }
};

const createClass = async (req, res) => {
  try {
    const {
      class_name,
      class_code,
      class_teacher_id,
      max_students,
      class_fee: _classFee,
      description,
      is_active,
      has_sections: _hasSections,
      academic_year_id,
      section_ids,
    } = req.body;

    const codeNorm = normalizeClassCode(class_code);
    const descNorm = normalizeDescription(description);
    let maxNorm;
    if (max_students === undefined) maxNorm = 30;
    else if (max_students === null) maxNorm = null;
    else maxNorm = parseOptionalInt(max_students);
    const createdBy = req.user?.id != null ? parseInt(req.user.id, 10) : null;
    const createdByArg = Number.isInteger(createdBy) ? createdBy : null;

    const row = await query(
      `INSERT INTO classes (
        class_name, class_code, max_students, description, is_active, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *`,
      [
        String(class_name).trim(),
        codeNorm,
        maxNorm,
        descNorm,
        normalizeBool(is_active, true),
        createdByArg,
      ]
    ).then(r => r.rows[0]);
    const classId = row.id;
    const ay = await resolveAcademicYearId(req.body?.academic_year_id);

    if (ay) {
      if (Array.isArray(section_ids) && section_ids.length > 0) {
        for (const sectionId of section_ids) {
          const sid = parseInt(sectionId, 10);
          if (Number.isInteger(sid) && sid > 0) {
            await query(
              `INSERT INTO class_sections (class_id, section_id, academic_year_id, max_students, is_active, created_by)
               VALUES ($1, $2, $3, 30, true, $4)
               ON CONFLICT (class_id, section_id, academic_year_id) DO UPDATE SET deleted_at = NULL, updated_at = NOW()`,
              [classId, sid, ay, createdByArg]
            ).catch(e => console.error('Error assigning section to class:', e));
          }
        }
      }
    }

    return success(res, 201, 'Class created successfully', row);
  } catch (error) {
    console.error('Error creating class:', error);
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid teacher');
    if (error.code === '23505') return errorResponse(res, 409, 'Class already exists');
    return errorResponse(res, 500, 'Failed to create class');
  }
};

const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const current = await query('SELECT * FROM classes WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (!current.rows.length) return errorResponse(res, 404, 'Class not found');
    const cur = current.rows[0];

    const classTeacherId = pickPayload(payload, 'class_teacher_id', null);
    const className = pickPayload(payload, 'class_name', cur.class_name);

    let classCode = cur.class_code;
    if (Object.prototype.hasOwnProperty.call(payload, 'class_code')) {
      classCode = normalizeClassCode(payload.class_code);
    }

    let description = cur.description;
    if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
      description = normalizeDescription(payload.description);
    }

    let maxStudents = cur.max_students;
    if (Object.prototype.hasOwnProperty.call(payload, 'max_students')) {
      maxStudents =
        payload.max_students === null ? null : parseOptionalInt(payload.max_students);
    }

    const nameFinal = typeof className === 'string' ? className.trim() : className;
    if (!nameFinal) return errorResponse(res, 400, 'class_name cannot be empty');

    const is_active = Object.prototype.hasOwnProperty.call(payload, 'is_active')
      ? normalizeBool(payload.is_active, cur.is_active)
      : cur.is_active;

    const row = await query(
      `UPDATE classes
       SET class_name = $1, class_code = $2, max_students = $3, description = $4, is_active = $5, updated_at = NOW()
       WHERE id = $6 AND deleted_at IS NULL
       RETURNING *`,
      [nameFinal, classCode, maxStudents, description, is_active, id]
    ).then(r => r.rows[0]);

    const ay = await resolveAcademicYearId(payload?.academic_year_id);

    if (ay && Object.prototype.hasOwnProperty.call(payload, 'section_ids') && Array.isArray(payload.section_ids)) {
      const validSectionIds = payload.section_ids
        .map(id => parseInt(id, 10))
        .filter(id => Number.isInteger(id) && id > 0);

      // Soft delete sections not in the new list
      if (validSectionIds.length > 0) {
        await query(
          `UPDATE class_sections SET deleted_at = NOW()
           WHERE class_id = $1 AND academic_year_id = $2 AND deleted_at IS NULL AND section_id != ALL($3::int[])`,
          [id, ay, validSectionIds]
        );
      } else {
        await query(
          `UPDATE class_sections SET deleted_at = NOW()
           WHERE class_id = $1 AND academic_year_id = $2 AND deleted_at IS NULL`,
          [id, ay]
        );
      }

      // Upsert new sections
      for (const sid of validSectionIds) {
        await query(
          `INSERT INTO class_sections (class_id, section_id, academic_year_id, max_students, is_active, created_by)
           VALUES ($1, $2, $3, 30, true, $4)
           ON CONFLICT (class_id, section_id, academic_year_id)
           DO UPDATE SET deleted_at = NULL, updated_at = NOW()`,
          [id, sid, ay, req.user?.id || null]
        ).catch(e => console.error('Error assigning section to class:', e));
      }
    }

    if (classTeacherId !== undefined && classTeacherId !== null && classTeacherId !== '') {
      const tid = parseInt(classTeacherId, 10);
      if (Number.isInteger(tid) && tid > 0 && ay) {
        await query(
          `UPDATE class_teachers SET deleted_at = NOW(), updated_at = NOW()
           WHERE class_id = $1 AND class_section_id IS NULL AND academic_year_id = $2 AND deleted_at IS NULL`,
          [id, ay]
        ).catch(() => {});
        await query(
          `INSERT INTO class_teachers (class_id, class_section_id, staff_id, academic_year_id, role, valid_period)
           VALUES ($1, NULL, $2, $3, 'primary', daterange(CURRENT_DATE, '9999-12-31', '[]'))`,
          [id, tid, ay]
        ).catch(() => {});
      }
    }

    return success(res, 200, 'Class updated successfully', row);
  } catch (error) {
    console.error('Error updating class:', error);
    if (error.code === '23503') return errorResponse(res, 400, 'Invalid teacher');
    return errorResponse(res, 500, 'Failed to update class');
  }
};

const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE classes SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    if (!result.rows.length) return errorResponse(res, 404, 'Class not found');
    return success(res, 200, 'Class deleted successfully', { id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting class:', error);
    return errorResponse(res, 500, 'Failed to delete class');
  }
};

module.exports = {
  getAllClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
};
