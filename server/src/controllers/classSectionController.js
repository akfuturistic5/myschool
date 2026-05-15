const { query } = require('../config/database');
const { canAccessClass } = require('../utils/accessControl');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { resolveAcademicYearId } = require('../utils/academicYear');

const baseSectionSelect = `
  cs.id,
  cs.section_id,
  COALESCE(sec.section_name, 'General') AS section_name,
  cs.class_id,
  cs.academic_year_id,
  te.staff_id AS section_teacher_id,
  cs.max_students,
  cs.class_room_id,
  cr.room_number,
  COALESCE(sec.description, 'Class-level assignment') AS description,
  cs.is_active,
  cs.created_at,
  cs.created_by,
  cs.updated_at AS updated_at,
  (SELECT COUNT(*)::int
   FROM students st
   LEFT JOIN LATERAL (
     SELECT l.to_class_id, l.to_section_id, l.to_academic_year_id
     FROM student_lifecycle_ledger l
     WHERE l.student_id = st.id
     ORDER BY l.event_date DESC NULLS LAST, l.id DESC
     LIMIT 1
   ) le ON true
   WHERE st.deleted_at IS NULL AND st.status = 'Active'
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
  LEFT JOIN sections sec ON sec.id = cs.section_id
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
  LEFT JOIN class_rooms cr ON cr.id = cs.class_room_id
`;

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

const assignSectionsToClass = async (req, res) => {
  try {
    const { class_id, academic_year_id, section_ids } = req.body;
    const createdBy = req.user?.id != null ? parseInt(req.user.id, 10) : null;
    const ay = await resolveAcademicYearId(academic_year_id);

    if (!ay) {
      return errorResponse(res, 400, 'Academic year is required');
    }

    const validSectionIds = (section_ids || [])
      .map(id => parseInt(id, 10))
      .filter(id => Number.isInteger(id) && id > 0);

    // Soft delete sections not in the new list
    if (validSectionIds.length > 0) {
      await query(
        `UPDATE class_sections SET deleted_at = NOW()
         WHERE class_id = $1 AND academic_year_id = $2 AND deleted_at IS NULL AND section_id != ALL($3::int[])`,
        [class_id, ay, validSectionIds]
      );
    } else {
      await query(
        `UPDATE class_sections SET deleted_at = NOW()
         WHERE class_id = $1 AND academic_year_id = $2 AND deleted_at IS NULL`,
        [class_id, ay]
      );
    }

    // Upsert new sections
    const results = [];
    for (const item of (section_ids || [])) {
      const isObject = typeof item === 'object' && item !== null;
      const rawSid = isObject ? item.section_id : item;
      const sid = (rawSid === null || rawSid === undefined || rawSid === "") ? null : parseInt(String(rawSid), 10);

      let classRoomId = null;
      if (isObject && item.class_room_id !== undefined && item.class_room_id !== null && item.class_room_id !== "") {
        const parsedRoomId = parseInt(String(item.class_room_id), 10);
        classRoomId = isNaN(parsedRoomId) ? null : parsedRoomId;
      }

      let maxStudents = 30;
      if (isObject && item.max_students !== undefined && item.max_students !== null) {
        const parsedMax = parseInt(String(item.max_students), 10);
        maxStudents = isNaN(parsedMax) ? 30 : parsedMax;
      }

      if (sid !== null && (!Number.isInteger(sid) || sid <= 0)) continue;

      // [VALIDATION] Check if classroom is already assigned elsewhere in this AY
      if (classRoomId) {
        const existingAssignment = await query(
          `SELECT c.class_name, COALESCE(s.section_name, 'General') AS section_name 
           FROM class_sections cs
           JOIN classes c ON c.id = cs.class_id
           LEFT JOIN sections s ON s.id = cs.section_id
           WHERE cs.academic_year_id = $1 AND cs.class_room_id = $2 
           AND (cs.class_id != $3 OR COALESCE(cs.section_id, -1) != COALESCE($4, -1))
           AND cs.deleted_at IS NULL`,
          [ay, classRoomId, class_id, sid]
        );

        if (existingAssignment.rows.length > 0) {
          const e = existingAssignment.rows[0];
          return errorResponse(res, `Room is already assigned to Class ${e.class_name} - Section ${e.section_name}`, 400);
        }
      }

      // 1. Try to restore a soft-deleted assignment first to maintain ID stability
      const restoreResult = await query(
        `UPDATE class_sections SET deleted_at = NULL, updated_at = NOW(), updated_by = $6, class_room_id = $4, max_students = $5
         WHERE class_id = $1 AND COALESCE(section_id, -1) = COALESCE($2, -1) AND academic_year_id = $3 AND deleted_at IS NOT NULL
         RETURNING *`,
        [class_id, sid, ay, classRoomId, maxStudents, createdBy]
      );

      if (restoreResult.rows.length > 0) {
        results.push(restoreResult.rows[0]);
      } else {
        const row = await query(
          `INSERT INTO class_sections (class_id, section_id, academic_year_id, max_students, class_room_id, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, true, $6)
         ON CONFLICT (class_id, COALESCE(section_id, -1), academic_year_id) WHERE deleted_at IS NULL
         DO UPDATE SET 
           updated_at = NOW(), 
           updated_by = EXCLUDED.created_by,
           class_room_id = EXCLUDED.class_room_id, 
           max_students = EXCLUDED.max_students
         RETURNING *`,
          [class_id, sid, ay, maxStudents, classRoomId, createdBy]
        ).then(r => r.rows[0]);
        results.push(row);
      }
    }

    return success(res, 200, 'Sections assigned successfully', results);
  } catch (error) {
    console.error('Error assigning sections to class:', error);
    return errorResponse(res, 500, 'Failed to assign sections');
  }
};

const updateClassSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { class_room_id, max_students, is_active } = req.body;

    const current = await query('SELECT * FROM class_sections WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (!current.rows.length) return errorResponse(res, 404, 'Assignment not found');
    const cur = current.rows[0];

    let parsedRoomId = undefined;
    if (class_room_id !== undefined) {
      const pr = parseInt(String(class_room_id), 10);
      parsedRoomId = isNaN(pr) ? null : pr;
    }

    let parsedMax = undefined;
    if (max_students !== undefined) {
      const pm = parseInt(String(max_students), 10);
      parsedMax = isNaN(pm) ? cur.max_students : pm;
    }

    // [VALIDATION] Check if classroom is already assigned elsewhere
    const targetRoomId = parsedRoomId !== undefined ? parsedRoomId : cur.class_room_id;
    if (targetRoomId) {
      const existingAssignment = await query(
        `SELECT c.class_name, s.section_name 
         FROM class_sections cs
         JOIN classes c ON c.id = cs.class_id
         JOIN sections s ON s.id = cs.section_id
         WHERE cs.academic_year_id = $1 AND cs.class_room_id = $2 
         AND cs.id != $3
         AND cs.deleted_at IS NULL`,
        [cur.academic_year_id, targetRoomId, id]
      );

      if (existingAssignment.rows.length > 0) {
        const e = existingAssignment.rows[0];
        return errorResponse(res, 400, `Room is already assigned to Class ${e.class_name} - Section ${e.section_name}`);
      }
    }

    const userId = req.user?.id != null ? parseInt(req.user.id, 10) : null;
    const result = await query(
      `UPDATE class_sections SET
         class_room_id = $1,
         max_students = $2,
         is_active = $3,
         updated_at = NOW(),
         updated_by = $4
       WHERE id = $5
       RETURNING *`,
      [
        parsedRoomId !== undefined ? parsedRoomId : cur.class_room_id,
        parsedMax !== undefined ? parsedMax : cur.max_students,
        is_active !== undefined ? !!is_active : cur.is_active,
        userId,
        id
      ]
    );

    return success(res, 200, 'Class section updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating class section:', error);
    return errorResponse(res, 500, 'Failed to update class section');
  }
};

const removeSectionFromClass = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id != null ? parseInt(req.user.id, 10) : null;
    const result = await query(
      `UPDATE class_sections SET deleted_at = NOW(), updated_at = NOW(), updated_by = $2
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id, userId]
    );
    if (!result.rows.length) {
      return errorResponse(res, 404, 'Assignment not found');
    }
    return success(res, 200, 'Section removed from class successfully', { id: result.rows[0].id });
  } catch (error) {
    console.error('Error removing section from class:', error);
    return errorResponse(res, 500, 'Failed to remove section from class');
  }
};

const getClassSectionsSummary = async (req, res) => {
  try {
    const academicYearId = await resolveAcademicYearId(req.query?.academic_year_id);
    const params = [];
    let ayCond = '';
    if (academicYearId) {
      params.push(academicYearId);
      ayCond = 'AND cs.academic_year_id = $1';
    }

    const result = await query(
      `
      SELECT
        c.id,
        c.class_name,
        c.class_code,
        c.is_active,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', cs.id,
              'section_id', sec.id,
              'section_name', COALESCE(sec.section_name, 'General'),
              'class_room_id', cs.class_room_id,
              'room_number', cr.room_number,
              'max_students', cs.max_students,
              'is_active', cs.is_active
            ) ORDER BY sec.section_name NULLS FIRST)
            FROM class_sections cs
            LEFT JOIN sections sec ON sec.id = cs.section_id
            LEFT JOIN class_rooms cr ON cr.id = cs.class_room_id
            WHERE cs.class_id = c.id AND cs.deleted_at IS NULL ${ayCond}
          ),
          '[]'::json
        ) AS sections
      FROM classes c
      WHERE c.deleted_at IS NULL
      ORDER BY c.class_name ASC
      `,
      params
    );

    return success(res, 200, 'Class section summary fetched successfully', result.rows);
  } catch (error) {
    console.error('Error fetching class sections summary:', error);
    return errorResponse(res, 500, 'Failed to fetch summary');
  }
};

module.exports = {
  getSectionsByClass,
  assignSectionsToClass,
  updateClassSection,
  removeSectionFromClass,
  getClassSectionsSummary,
};
