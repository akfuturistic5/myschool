const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

/**
 * Get elective subjects for a class grouped by elective group
 */
const getElectiveSubjects = async (req, res) => {
  try {
    const { class_id, academic_year_id } = req.query;
    if (!class_id || !academic_year_id) return errorResponse(res, 400, 'Class ID and Academic Year are required');

    const result = await query(
      `SELECT 
        cs.id as class_subject_id,
        s.subject_name,
        s.subject_type,
        cs.is_elective,
        cs.elective_group_id,
        seg.group_name as elective_group_name,
        seg.max_subjects,
        seg.selectable_subjects
       FROM class_subjects cs
       JOIN subjects s ON cs.subject_id = s.id
       LEFT JOIN subject_elective_groups seg ON cs.elective_group_id = seg.id
       WHERE cs.class_id = $1 
         AND cs.academic_year_id = $2
         AND cs.is_elective = true 
         AND cs.deleted_at IS NULL
       ORDER BY seg.group_name, s.subject_name`,
      [class_id, academic_year_id]
    );

    return success(res, 200, 'Elective subjects fetched', result.rows);
  } catch (error) {
    console.error('getElectiveSubjects Error:', error.message, error.stack);
    return errorResponse(res, 500, 'Failed to fetch elective subjects');
  }
};

/**
 * Get current elective choices for students in a class/section
 */
const getCurriculumMap = async (req, res) => {
  try {
    const { class_id, section_id, academic_year_id } = req.query;
    if (!class_id || !academic_year_id) return errorResponse(res, 400, 'Class and Academic Year are required');

    // Handle section_id that might come as "null" string or empty
    const sanitizedSectionId = (section_id === 'null' || section_id === '') ? null : section_id;

    const studentsResult = await query(
      `SELECT 
        s.id, u.first_name, u.last_name, s.admission_number, s.roll_number,
        l.to_class_id as class_id, l.to_section_id as section_id,
        string_agg(sub.subject_name, ', ') as selected_electives,
        array_remove(array_agg(cs.id), NULL) as selected_subject_ids
       FROM students s
       JOIN users u ON s.user_id = u.id
       JOIN LATERAL (
         SELECT to_class_id, to_section_id
         FROM student_lifecycle_ledger
         WHERE student_id = s.id AND to_academic_year_id = $3
         ORDER BY event_date DESC, id DESC
         LIMIT 1
       ) l ON true
       LEFT JOIN student_subject_choices ssc ON s.id = ssc.student_id AND ssc.academic_year_id = $3
       LEFT JOIN class_subjects cs ON ssc.class_subject_id = cs.id
       LEFT JOIN subjects sub ON cs.subject_id = sub.id
       WHERE l.to_class_id = $1 
         AND ($2::int IS NULL OR l.to_section_id = $2)
         AND s.deleted_at IS NULL
       GROUP BY s.id, u.first_name, u.last_name, s.admission_number, s.roll_number, l.to_class_id, l.to_section_id
       ORDER BY s.roll_number, u.first_name`,
      [class_id, sanitizedSectionId, academic_year_id]
    );

    return success(res, 200, 'Curriculum map fetched', studentsResult.rows);
  } catch (error) {
    console.error('getCurriculumMap Error:', error.message, error.stack);
    return errorResponse(res, 500, 'Failed to fetch curriculum map', error.message);
  }
};

/**
 * Bulk assign elective subjects to students
 */
const assignElectives = async (req, res) => {
  try {
    const { student_ids, class_subject_ids, academic_year_id } = req.body;
    const userId = req.user?.id != null ? parseInt(req.user.id, 10) : null;

    if (!student_ids?.length || !academic_year_id) {
      return errorResponse(res, 400, 'Missing required fields');
    }

    // Block students, parents, and guardians from editing their selections once saved
    const roleName = String(req.user?.role_name || req.user?.role || '').trim().toLowerCase();
    if (roleName === 'student' || roleName === 'parent' || roleName === 'guardian') {
      const existingChoices = await query(
        `SELECT id FROM student_subject_choices 
         WHERE student_id = $1 AND academic_year_id = $2 AND deleted_at IS NULL LIMIT 1`,
        [student_ids[0], academic_year_id]
      );
      if (existingChoices.rows.length > 0) {
        return errorResponse(res, 403, 'You have already saved your elective choices and they cannot be modified. Please contact the administrator for any changes.');
      }
    }

    // 0. Validate selection limits for each group in the request
    if (class_subject_ids?.length > 0) {
      const groupValidation = await query(
        `SELECT eg.id, eg.group_name, eg.selectable_subjects, COUNT(cs.id) as subjects_in_request
         FROM class_subjects cs
         JOIN subject_elective_groups eg ON cs.elective_group_id = eg.id
         WHERE cs.id = ANY($1::int[])
         GROUP BY eg.id, eg.group_name, eg.selectable_subjects`,
        [class_subject_ids]
      );

      for (const row of groupValidation.rows) {
        const limit = Number(row.selectable_subjects || 0);
        if (limit > 0 && Number(row.subjects_in_request) > limit) {
          return errorResponse(res, 400, `Selection limit exceeded for group "${row.group_name}". Maximum allowed: ${limit}`);
        }
      }
    }

    // Fetch class_id from one of the class_subjects if provided,
    // otherwise fetch it from the student's current enrollment in the ledger
    let classId;
    if (class_subject_ids?.length > 0) {
      const classIdRes = await query('SELECT class_id FROM class_subjects WHERE id = $1', [class_subject_ids[0]]);
      classId = classIdRes.rows[0]?.class_id;
    } else {
      const classIdRes = await query(
        `SELECT to_class_id AS class_id 
         FROM student_lifecycle_ledger 
         WHERE student_id = $1 AND to_academic_year_id = $2
         ORDER BY event_date DESC NULLS LAST, id DESC
         LIMIT 1`,
        [student_ids[0], academic_year_id]
      );
      classId = classIdRes.rows[0]?.class_id;
    }

    if (!classId) {
      return errorResponse(res, 400, 'Invalid class or student enrollment not found');
    }

    // Process each student
    for (const studentId of student_ids) {
      if (class_subject_ids?.length > 0) {
        // 1. Identify which elective groups these subjects belong to
        const groupsResult = await query(
          `SELECT DISTINCT elective_group_id FROM class_subjects WHERE id = ANY($1::int[])`,
          [class_subject_ids]
        );
        const groupIds = groupsResult.rows.map(r => r.elective_group_id).filter(id => id != null);

        // 2. Remove existing choices for this student in these groups (to allow re-assignment/replacement)
        if (groupIds.length > 0) {
          await query(
            `DELETE FROM student_subject_choices 
             WHERE student_id = $1 
               AND academic_year_id = $2
               AND class_subject_id IN (
                 SELECT id FROM class_subjects WHERE elective_group_id = ANY($3::int[])
               )`,
            [studentId, academic_year_id, groupIds]
          );
        } else {
          // Fallback for electives without groups? (Though they should have them)
          await query(
            `DELETE FROM student_subject_choices 
             WHERE student_id = $1 AND academic_year_id = $2 AND class_subject_id = ANY($3::int[])`,
            [studentId, academic_year_id, class_subject_ids]
          );
        }

        // 3. Insert new choices
        for (const subjectId of class_subject_ids) {
          await query(
            `INSERT INTO student_subject_choices (student_id, class_id, class_subject_id, academic_year_id, created_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (student_id, class_subject_id, academic_year_id) WHERE (deleted_at IS NULL) DO NOTHING`,
            [studentId, classId, subjectId, academic_year_id, userId]
          );
        }
      } else {
        // If class_subject_ids is empty, remove ALL elective choices for this student in this class and year
        await query(
          `DELETE FROM student_subject_choices 
           WHERE student_id = $1 
             AND academic_year_id = $2
             AND class_subject_id IN (
               SELECT id FROM class_subjects WHERE class_id = $3 AND is_elective = true
             )`,
          [studentId, academic_year_id, classId]
        );
      }
    }

    return success(res, 200, 'Electives assigned successfully');
  } catch (error) {
    console.error('assignElectives', error);
    return errorResponse(res, 500, 'Failed to assign electives', error.message);
  }
};

module.exports = {
  getElectiveSubjects,
  getCurriculumMap,
  assignElectives,
};
