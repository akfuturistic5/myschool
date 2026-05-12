const Joi = require('joi');
const { executeTransaction, query } = require('../config/database');
const { success, error } = require('../utils/responseHelper');
const { getAuthContext, isAdmin, parseId, isTeacherRole } = require('../utils/accessControl');
const { ROLES } = require('../config/roles');
const { getParentsForUser } = require('../utils/parentUserMatch');
const {
  DEFAULT_GRADE_SCALE,
  loadActiveGradeScale,
  resolveGradeScaleTable,
  getGradeFromScale,
  isMissingTableError,
} = require('../utils/gradeScaleService');
const { lateralCurrentEnrollment } = require('../utils/studentEnrollmentSql');

const createExamSchema = Joi.object({
  exam_name: Joi.string().trim().min(2).max(150).required(),
  exam_type: Joi.string().trim().valid(
    'unit_test',
    'monthly',
    'quarterly',
    'half_yearly',
    'annual',
    'preboard',
    'internal',
    'other'
  ).required(),
  class_ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  academic_year_id: Joi.number().integer().positive().allow(null),
  description: Joi.string().allow('', null),
});

const saveSubjectsSchema = Joi.object({
  exam_id: Joi.number().integer().positive().required(),
  class_id: Joi.number().integer().positive().required(),
  section_id: Joi.number().integer().positive().required(),
  subjects: Joi.array()
    .items(
      Joi.object({
        subject_id: Joi.number().integer().positive().required(),
        max_marks: Joi.number().positive().required(),
        passing_marks: Joi.number().min(0).required(),
        exam_date: Joi.date().iso().allow(null, ''),
        start_time: Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null, ''),
        end_time: Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null, ''),
      })
    )
    .min(1)
    .required(),
});

const saveSubjectSetupSchema = Joi.object({
  exam_id: Joi.number().integer().positive().required(),
  class_id: Joi.number().integer().positive().required(),
  section_id: Joi.number().integer().positive().required(),
  rows: Joi.array()
    .items(
      Joi.object({
        subject_id: Joi.number().integer().positive().required(),
        max_marks: Joi.number().positive().required(),
        passing_marks: Joi.number().min(0).required(),
        exam_date: Joi.date().iso().allow(null, ''),
        start_time: Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null, ''),
        end_time: Joi.string().pattern(/^\d{2}:\d{2}$/).allow(null, ''),
      })
    )
    .min(1)
    .required(),
});

const examMarksContextSchema = Joi.object({
  exam_id: Joi.number().integer().positive().required(),
  class_id: Joi.number().integer().positive().required(),
  section_id: Joi.number().integer().positive().required(),
});

const saveExamMarksSchema = Joi.object({
  exam_id: Joi.number().integer().positive().required(),
  class_id: Joi.number().integer().positive().required(),
  section_id: Joi.number().integer().positive().required(),
  rows: Joi.array()
    .items(
      Joi.object({
        student_id: Joi.number().integer().positive().required(),
        subject_id: Joi.number().integer().positive().required(),
        is_absent: Joi.boolean().required(),
        marks_obtained: Joi.number().min(0).allow(null),
      })
    )
    .min(1)
    .required(),
});

const getGradeScale = async (_req, res) => {
  try {
    const tableName = await resolveGradeScaleTable();
    if (!tableName) {
      const rows = DEFAULT_GRADE_SCALE.map((item) => ({
        id: item.id,
        grade: item.grade,
        min_percentage: Number(item.min_percentage),
        max_percentage: Number(item.max_percentage),
        percentage_label: `${Number(item.min_percentage)}% - ${Math.floor(Number(item.max_percentage))}%`,
        is_active: item.is_active !== false,
        status: item.is_active === false ? 'Inactive' : 'Active',
      }));
      return success(res, 200, 'Grade scale fetched', rows, { count: rows.length });
    }
    const sql = gradeScaleQueries(tableName);
    const gradeRes = await query(sql.listOrdered);
    const scaleRows = gradeRes.rows || [];
    const rows = scaleRows.map((item, idx) => ({
      id: item.id ?? idx + 1,
      grade: item.grade,
      min_percentage: Number(item.min_percentage),
      max_percentage: Number(item.max_percentage),
      percentage_label: `${Number(item.min_percentage)}% - ${Math.floor(Number(item.max_percentage))}%`,
      is_active: item.is_active !== false,
      status: item.is_active === false ? 'Inactive' : 'Active',
    }));
    return success(res, 200, 'Grade scale fetched', rows, { count: rows.length });
  } catch (e) {
    if (isMissingTableError(e)) {
      const rows = DEFAULT_GRADE_SCALE.map((item) => ({
        id: item.id,
        grade: item.grade,
        min_percentage: Number(item.min_percentage),
        max_percentage: Number(item.max_percentage),
        percentage_label: `${Number(item.min_percentage)}% - ${Math.floor(Number(item.max_percentage))}%`,
        is_active: item.is_active !== false,
        status: item.is_active === false ? 'Inactive' : 'Active',
      }));
      return success(res, 200, 'Grade scale fetched', rows, { count: rows.length });
    }
    console.error('getGradeScale', e);
    return error(res, 500, 'Failed to fetch grade scale');
  }
};

const upsertGradeScaleSchema = Joi.object({
  grade: Joi.string().trim().min(1).max(20).required(),
  min_percentage: Joi.number().min(0).max(100).required(),
  max_percentage: Joi.number().min(0).max(100).required(),
  is_active: Joi.boolean().default(true),
});

function gradeScaleQueries(tableName) {
  if (tableName === 'exam_grades') {
    return {
      listAll: `SELECT id, grade_name AS grade, min_percentage AS min_percentage, max_percentage AS max_percentage, is_active FROM exam_grades`,
      listOrdered: `SELECT id, grade_name AS grade, min_percentage AS min_percentage, max_percentage AS max_percentage, is_active FROM exam_grades ORDER BY min_percentage DESC, id ASC`,
      existsById: 'SELECT id FROM exam_grades WHERE id = $1 LIMIT 1',
      insert: `INSERT INTO exam_grades (grade_name, min_percentage, max_percentage, is_active)
               VALUES ($1, $2, $3, $4)
               RETURNING id, grade_name AS grade, min_percentage AS min_percentage, max_percentage AS max_percentage, is_active, created_at, updated_at`,
      update: `UPDATE exam_grades
               SET grade_name = $1,
                   min_percentage = $2,
                   max_percentage = $3,
                   is_active = $4,
                   updated_at = NOW()
               WHERE id = $5
               RETURNING id, grade_name AS grade, min_percentage AS min_percentage, max_percentage AS max_percentage, is_active, created_at, updated_at`,
      deleteById: 'DELETE FROM exam_grades WHERE id = $1 RETURNING id',
      countActive: 'SELECT COUNT(*)::int AS c FROM exam_grades WHERE is_active = true',
      restoreDefault: `INSERT INTO exam_grades (grade_name, min_percentage, max_percentage, is_active)
                       VALUES ($1, $2, $3, true)
                       ON CONFLICT DO NOTHING`,
    };
  }
  return {
    listAll: `SELECT id, grad AS grade, min_precentage AS min_percentage, max_precentage AS max_percentage, is_active FROM exam_grade`,
    listOrdered: `SELECT id, grad AS grade, min_precentage AS min_percentage, max_precentage AS max_percentage, is_active FROM exam_grade ORDER BY min_precentage DESC, id ASC`,
    existsById: 'SELECT id FROM exam_grade WHERE id = $1 LIMIT 1',
    insert: `INSERT INTO exam_grade (grad, min_precentage, max_precentage, is_active)
             VALUES ($1, $2, $3, $4)
             RETURNING id, grad AS grade, min_precentage AS min_percentage, max_precentage AS max_percentage, is_active, created_at, updated_at`,
    update: `UPDATE exam_grade
             SET grad = $1,
                 min_precentage = $2,
                 max_precentage = $3,
                 is_active = $4,
                 updated_at = NOW()
             WHERE id = $5
             RETURNING id, grad AS grade, min_precentage AS min_percentage, max_precentage AS max_percentage, is_active, created_at, updated_at`,
    deleteById: 'DELETE FROM exam_grade WHERE id = $1 RETURNING id',
    countActive: 'SELECT COUNT(*)::int AS c FROM exam_grade WHERE is_active = true',
    restoreDefault: `INSERT INTO exam_grade (grad, min_precentage, max_precentage, is_active)
                     VALUES ($1, $2, $3, true)
                     ON CONFLICT DO NOTHING`,
  };
}

function validateNoGradeOverlap(rows, currentId = null) {
  const candidateRows = (rows || []).filter((r) => Number(r.id) !== Number(currentId));
  for (let i = 0; i < candidateRows.length; i += 1) {
    const a = candidateRows[i];
    const aMin = Number(a.min_percentage);
    const aMax = Number(a.max_percentage);
    for (let j = i + 1; j < candidateRows.length; j += 1) {
      const b = candidateRows[j];
      const bMin = Number(b.min_percentage);
      const bMax = Number(b.max_percentage);
      if (aMin <= bMax && bMin <= aMax) {
        return `Grade range overlap: "${a.grade}" (${aMin}% - ${aMax}%) conflicts with "${b.grade}" (${bMin}% - ${bMax}%).`;
      }
    }
  }
  return null;
}

function validateDuplicateGradeName(rows, currentId = null) {
  const seen = new Map();
  for (const row of rows || []) {
    if (Number(row.id) === Number(currentId)) continue;
    const normalized = String(row.grade || '').trim().toLowerCase();
    if (!normalized) continue;
    if (seen.has(normalized)) {
      const first = seen.get(normalized);
      return `Grade name "${String(row.grade || '').trim()}" already exists (conflicts with "${String(first.grade || '').trim()}").`;
    }
    seen.set(normalized, row);
  }
  return null;
}

const createGradeScale = async (req, res) => {
  try {
    const { value, error: validationError } = upsertGradeScaleSchema.validate(req.body || {}, { abortEarly: true });
    if (validationError) return error(res, 400, validationError.message);
    if (Number(value.min_percentage) > Number(value.max_percentage)) {
      return error(res, 400, 'min_percentage cannot be greater than max_percentage');
    }
    const created = await executeTransaction(async (client) => {
      const tableName = await resolveGradeScaleTable();
      if (!tableName) {
        const missingErr = new Error('Grade table not found');
        missingErr.statusCode = 503;
        throw missingErr;
      }
      const sql = gradeScaleQueries(tableName);
      const allRowsRes = await client.query(sql.listAll);
      const allRows = allRowsRes.rows || [];
      const duplicateNameError = validateDuplicateGradeName(
        [...allRows, { ...value, id: -1 }],
        null
      );
      if (duplicateNameError) {
        const errObj = new Error(duplicateNameError);
        errObj.statusCode = 409;
        throw errObj;
      }
      const conflict = validateNoGradeOverlap(
        [...allRows, { ...value, id: -1 }],
        null
      );
      if (conflict) {
        const errObj = new Error(conflict);
        errObj.statusCode = 409;
        throw errObj;
      }
      const ins = await client.query(sql.insert, [
        value.grade,
        Number(value.min_percentage),
        Number(value.max_percentage),
        value.is_active !== false,
      ]);
      return ins.rows[0];
    });
    return success(res, 201, 'Grade scale created', created);
  } catch (e) {
    if (e?.statusCode) return error(res, e.statusCode, e.message || 'Failed to create grade scale');
    if (isMissingTableError(e)) {
      return error(res, 503, 'Grade table not found. Run migration 032_exam_grade_scale.sql');
    }
    console.error('createGradeScale', e);
    return error(res, 500, 'Failed to create grade scale');
  }
};

const updateGradeScale = async (req, res) => {
  try {
    const gradeId = parseId(req.params.id);
    if (!gradeId) return error(res, 400, 'Invalid grade id');
    const { value, error: validationError } = upsertGradeScaleSchema.validate(req.body || {}, { abortEarly: true });
    if (validationError) return error(res, 400, validationError.message);
    if (Number(value.min_percentage) > Number(value.max_percentage)) {
      return error(res, 400, 'min_percentage cannot be greater than max_percentage');
    }
    const updated = await executeTransaction(async (client) => {
      const tableName = await resolveGradeScaleTable();
      if (!tableName) {
        const missingErr = new Error('Grade table not found');
        missingErr.statusCode = 503;
        throw missingErr;
      }
      const sql = gradeScaleQueries(tableName);
      const exists = await client.query(sql.existsById, [gradeId]);
      if (!exists.rows.length) {
        const errObj = new Error('Grade scale not found');
        errObj.statusCode = 404;
        throw errObj;
      }
      const allRowsRes = await client.query(sql.listAll);
      const allRows = (allRowsRes.rows || []).map((r) =>
        Number(r.id) === Number(gradeId)
          ? {
              ...r,
              grade: value.grade,
              min_percentage: Number(value.min_percentage),
              max_percentage: Number(value.max_percentage),
              is_active: value.is_active !== false,
            }
          : r
      );
      const duplicateNameError = validateDuplicateGradeName(allRows, gradeId);
      if (duplicateNameError) {
        const errObj = new Error(duplicateNameError);
        errObj.statusCode = 409;
        throw errObj;
      }
      const conflict = validateNoGradeOverlap(allRows, gradeId);
      if (conflict) {
        const errObj = new Error(conflict);
        errObj.statusCode = 409;
        throw errObj;
      }
      const upd = await client.query(sql.update, [
        value.grade,
        Number(value.min_percentage),
        Number(value.max_percentage),
        value.is_active !== false,
        gradeId,
      ]);
      return upd.rows[0];
    });
    return success(res, 200, 'Grade scale updated', updated);
  } catch (e) {
    if (e?.statusCode) return error(res, e.statusCode, e.message || 'Failed to update grade scale');
    if (isMissingTableError(e)) {
      return error(res, 503, 'Grade table not found. Run migration 032_exam_grade_scale.sql');
    }
    console.error('updateGradeScale', e);
    return error(res, 500, 'Failed to update grade scale');
  }
};

const deleteGradeScale = async (req, res) => {
  try {
    const gradeId = parseId(req.params.id);
    if (!gradeId) return error(res, 400, 'Invalid grade id');
    const tableName = await resolveGradeScaleTable();
    if (!tableName) {
      return error(res, 503, 'Grade table not found. Run migration 032_exam_grade_scale.sql');
    }
    const sql = gradeScaleQueries(tableName);
    const del = await query(sql.deleteById, [gradeId]);
    if (!del.rows.length) return error(res, 404, 'Grade scale not found');
    const remaining = await query(sql.countActive);
    if (Number(remaining.rows?.[0]?.c || 0) === 0) {
      // Never allow all active rows to be deleted; restore defaults for safe grading.
      for (const item of DEFAULT_GRADE_SCALE) {
        await query(sql.restoreDefault, [item.grade, item.min_percentage, item.max_percentage]);
      }
    }
    return success(res, 200, 'Grade scale deleted', { id: gradeId });
  } catch (e) {
    if (isMissingTableError(e)) {
      return error(res, 503, 'Grade table not found. Run migration 032_exam_grade_scale.sql');
    }
    console.error('deleteGradeScale', e);
    return error(res, 500, 'Failed to delete grade scale');
  }
};

function validateNoExamSlotCollision(rows = []) {
  const toMinutes = (value) => {
    const str = String(value || '').slice(0, 5);
    const [h, m] = str.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };

  const scheduled = [];
  for (const row of rows) {
    const date = row?.exam_date ? String(row.exam_date).slice(0, 10) : '';
    const start = row?.start_time ? String(row.start_time).slice(0, 5) : '';
    const end = row?.end_time ? String(row.end_time).slice(0, 5) : '';

    if (!date && !start && !end) continue;
    if (!date || !start || !end) {
      return 'Date, start time and end time are required together for every scheduled subject';
    }
    const startMin = toMinutes(start);
    const endMin = toMinutes(end);
    if (startMin == null || endMin == null || startMin >= endMin) {
      return 'Start time must be earlier than end time for each subject';
    }
    for (const slot of scheduled) {
      if (slot.date !== date) continue;
      const overlaps = startMin < slot.endMin && slot.startMin < endMin;
      if (overlaps) {
        return 'Two subjects cannot share overlapping exam time on the same date in the same section';
      }
    }
    scheduled.push({ date, startMin, endMin });
  }
  return null;
}

async function getExamSchemaFlags() {
  const [
    tableCheck,
    colCheck,
    examResultsCols,
    examSubjectsTable,
    examSchedulesTable,
    teacherAccessRow,
  ] = await Promise.all([
    query(`SELECT to_regclass('public.exam_classes') AS exam_classes_table`),
    query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'exams'
         AND column_name IN ('is_active', 'class_id', 'created_by', 'is_finalized')`
    ),
    query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'exam_results'`
    ),
    query(`SELECT to_regclass('public.exam_subjects') AS exam_subjects_table`),
    query(`SELECT to_regclass('public.exam_schedules') AS exam_schedules_table`),
    query(
      `SELECT
         (to_regclass('public.class_schedules') IS NOT NULL) AS has_class_schedules_table,
         (to_regclass('public.class_teachers') IS NOT NULL) AS has_class_teachers_table,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'classes' AND c.column_name = 'class_teacher_id'
         ) AS classes_has_class_teacher_id,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'sections' AND c.column_name = 'class_id'
         ) AS sections_has_class_id,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'sections' AND c.column_name = 'section_teacher_id'
         ) AS sections_has_section_teacher_id,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'class_schedules' AND c.column_name = 'section_id'
         ) AS class_schedules_has_section_id,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'class_schedules' AND c.column_name = 'class_section_id'
         ) AS class_schedules_has_class_section_id,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'subjects' AND c.column_name = 'class_id'
         ) AS subjects_has_class_id,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'class_subjects' AND c.column_name = 'theory_hours'
         ) AS class_subjects_has_theory_hours,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'class_subjects' AND c.column_name = 'practical_hours'
         ) AS class_subjects_has_practical_hours,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'subjects' AND c.column_name = 'theory_hours'
         ) AS subjects_has_theory_hours,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'subjects' AND c.column_name = 'practical_hours'
         ) AS subjects_has_practical_hours,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'students' AND c.column_name = 'class_id'
         ) AS students_has_class_id,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'students' AND c.column_name = 'section_id'
         ) AS students_has_section_id,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'students' AND c.column_name = 'first_name'
         ) AS students_has_first_name,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'students' AND c.column_name = 'last_name'
         ) AS students_has_last_name,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'students' AND c.column_name = 'user_id'
         ) AS students_has_user_id,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'users' AND c.column_name = 'first_name'
         ) AS users_has_first_name,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'users' AND c.column_name = 'last_name'
         ) AS users_has_last_name,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'students' AND c.column_name = 'photo_url'
         ) AS students_has_photo_url,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'users' AND c.column_name = 'avatar'
         ) AS users_has_avatar,
         EXISTS (
           SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.table_name = 'guardians' AND c.column_name = 'student_id'
         ) AS guardians_has_student_id,
         (to_regclass('public.student_lifecycle_ledger') IS NOT NULL) AS has_student_lifecycle_ledger,
         (to_regclass('public.parents') IS NOT NULL) AS has_parents_table,
         (to_regclass('public.student_guardian_links') IS NOT NULL) AS has_student_guardian_links_table,
         (to_regclass('public.attendance') IS NOT NULL) AS has_legacy_attendance_table,
         (to_regclass('public.student_attendance') IS NOT NULL) AS has_student_attendance_table,
         (to_regclass('public.student_promotions') IS NOT NULL) AS has_student_promotions_table`
    ),
  ]);

  const cols = new Set((colCheck.rows || []).map((r) => String(r.column_name)));
  const erCols = new Set((examResultsCols.rows || []).map((r) => String(r.column_name)));
  const ta = teacherAccessRow.rows?.[0] || {};
  const sectionsHasClassId = !!ta.sections_has_class_id;
  const sectionsHasSectionTeacherId = !!ta.sections_has_section_teacher_id;
  return {
    hasExamClassesTable: !!tableCheck.rows?.[0]?.exam_classes_table,
    hasIsActiveColumn: cols.has('is_active'),
    hasClassIdColumn: cols.has('class_id'),
    hasCreatedByColumn: cols.has('created_by'),
    hasIsFinalizedColumn: cols.has('is_finalized'),
    examResultsHasExamIdColumn: erCols.has('exam_id'),
    examResultsHasExamScheduleIdColumn: erCols.has('exam_schedule_id'),
    examResultsHasSubjectIdColumn: erCols.has('subject_id'),
    hasExamSubjectsTable: !!examSubjectsTable.rows?.[0]?.exam_subjects_table,
    hasExamSchedulesTable: !!examSchedulesTable.rows?.[0]?.exam_schedules_table,
    hasClassSchedulesTable: !!ta.has_class_schedules_table,
    hasClassTeachersTable: !!ta.has_class_teachers_table,
    classesHasClassTeacherIdColumn: !!ta.classes_has_class_teacher_id,
    sectionsHasClassIdColumn: sectionsHasClassId,
    sectionsHasLegacyClassTeacherColumns: sectionsHasClassId && sectionsHasSectionTeacherId,
    classSchedulesHasSectionIdColumn: !!ta.class_schedules_has_section_id,
    classSchedulesHasClassSectionIdColumn: !!ta.class_schedules_has_class_section_id,
    subjectsHasClassIdColumn: !!ta.subjects_has_class_id,
    classSubjectsHasTheoryHoursColumn: !!ta.class_subjects_has_theory_hours,
    classSubjectsHasPracticalHoursColumn: !!ta.class_subjects_has_practical_hours,
    subjectsHasTheoryHoursColumn: !!ta.subjects_has_theory_hours,
    subjectsHasPracticalHoursColumn: !!ta.subjects_has_practical_hours,
    /** Legacy students table stores class_id + section_id; canonical tenant uses student_lifecycle_ledger via lateral join */
    studentsHasLegacyClassColumns: !!(ta.students_has_class_id && ta.students_has_section_id),
    studentsHasFirstNameColumn: !!ta.students_has_first_name,
    studentsHasLastNameColumn: !!ta.students_has_last_name,
    studentsHasUserIdColumn: !!ta.students_has_user_id,
    guardiansHasStudentIdColumn: !!ta.guardians_has_student_id,
    usersHasFirstNameColumn: !!ta.users_has_first_name,
    usersHasLastNameColumn: !!ta.users_has_last_name,
    studentsHasPhotoUrlColumn: !!ta.students_has_photo_url,
    usersHasAvatarColumn: !!ta.users_has_avatar,
    hasStudentLifecycleLedger: !!ta.has_student_lifecycle_ledger,
    hasParentsTable: !!ta.has_parents_table,
    hasStudentGuardianLinksTable: !!ta.has_student_guardian_links_table,
    hasLegacyAttendanceTable: !!ta.has_legacy_attendance_table,
    hasStudentAttendanceTable: !!ta.has_student_attendance_table,
    hasStudentPromotionsTable: !!ta.has_student_promotions_table,
  };
}

/**
 * OR-clauses: teacher may see exam work for a class via timetable, class_teachers (staff_id),
 * or legacy classes/sections columns. classSchedules.teacher_id may store staff.id or legacy teachers.id.
 * academicYearExpr: SQL expression for class_teachers.academic_year_id match (e.g. e.academic_year_id).
 */
function buildTeacherClassAccessOrSql(schema, classFieldSql, teacherIdsIdx, staffIdsIdx, academicYearExpr) {
  const parts = [];
  const yearExpr = academicYearExpr || 'e.academic_year_id';
  if (schema.hasClassSchedulesTable) {
    parts.push(`EXISTS (
      SELECT 1
      FROM class_schedules cs
      WHERE cs.class_id = ${classFieldSql}
        AND (cs.teacher_id = ANY($${staffIdsIdx}::int[]) OR cs.teacher_id = ANY($${teacherIdsIdx}::int[]))
    )`);
  }
  if (schema.hasClassTeachersTable) {
    parts.push(`EXISTS (
      SELECT 1
      FROM class_teachers ct
      WHERE ct.class_id = ${classFieldSql}
        AND ct.deleted_at IS NULL
        AND ct.staff_id = ANY($${staffIdsIdx}::int[])
        AND ct.academic_year_id = ${yearExpr}
    )`);
  }
  if (schema.classesHasClassTeacherIdColumn) {
    parts.push(`EXISTS (
      SELECT 1
      FROM classes c_map
      WHERE c_map.id = ${classFieldSql}
        AND (c_map.class_teacher_id = ANY($${teacherIdsIdx}::int[]) OR c_map.class_teacher_id = ANY($${staffIdsIdx}::int[]))
    )`);
  }
  if (schema.sectionsHasLegacyClassTeacherColumns) {
    parts.push(`EXISTS (
      SELECT 1
      FROM sections s_map
      WHERE s_map.class_id = ${classFieldSql}
        AND s_map.section_teacher_id = ANY($${staffIdsIdx}::int[])
    )`);
  }
  return parts.length ? parts.join('\n                OR ') : 'FALSE';
}

async function assertExamNotFinalized(examId) {
  const schema = await getExamSchemaFlags();
  if (!schema.hasIsFinalizedColumn) return;
  const chk = await query(
    `SELECT is_finalized
     FROM exams
     WHERE id = $1
     LIMIT 1`,
    [examId]
  );
  if (!chk.rows.length) {
    const err = new Error('Exam not found');
    err.statusCode = 404;
    throw err;
  }
  if (chk.rows[0].is_finalized === true) {
    const err = new Error('This exam is finalized. Timetable and marks cannot be modified.');
    err.statusCode = 409;
    throw err;
  }
}

async function assertExamClassLinked(examId, classId) {
  const schema = await getExamSchemaFlags();
  if (!schema.hasExamClassesTable) return;
  const linked = await query(
    `SELECT 1
     FROM exam_classes
     WHERE exam_id = $1
       AND class_id = $2
     LIMIT 1`,
    [examId, classId]
  );
  if (!linked.rows.length) {
    const err = new Error('Selected class is not linked to this exam');
    err.statusCode = 400;
    throw err;
  }
}

async function getExamSubjectsSchemaFlags() {
  const c = await query(
    `SELECT conname
     FROM pg_constraint
     WHERE conname IN ('exam_subjects_exam_subject_component_key', 'exam_subjects_exam_class_section_subject_key')`
  );
  const set = new Set((c.rows || []).map((r) => String(r.conname)));
  return {
    hasLegacyComponentUnique: set.has('exam_subjects_exam_subject_component_key'),
    hasClassSectionUnique: set.has('exam_subjects_exam_class_section_subject_key'),
  };
}

async function getExamResultsSchemaFlags() {
  const [colCheck, uniqueCheck] = await Promise.all([
    query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'exam_results'
         AND column_name IN ('created_by', 'updated_at', 'exam_component')`
    ),
    query(
      `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       INNER JOIN pg_class t ON t.oid = c.conrelid
       INNER JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE c.contype = 'u'
         AND n.nspname = 'public'
         AND t.relname = 'exam_results'`
    ),
  ]);
  const cols = new Set((colCheck.rows || []).map((r) => String(r.column_name)));
  const uniqueDefs = (uniqueCheck.rows || [])
    .map((r) => String(r.def || '').replace(/\s+/g, ' ').toLowerCase());
  const hasUniqueExamStudentSubject = uniqueDefs.some(
    (def) => def.includes('(exam_id, student_id, subject_id)')
  );
  const hasUniqueExamStudentSubjectComponent = uniqueDefs.some(
    (def) => def.includes('(exam_id, student_id, subject_id, exam_component)')
  );
  const hasUniqueStudentExamSchedule = uniqueDefs.some((def) => {
    const d = String(def || '').replace(/\s+/g, ' ').toLowerCase();
    return d.includes('(student_id, exam_schedule_id)') || d.includes('(exam_schedule_id, student_id)');
  });
  return {
    hasCreatedByColumn: cols.has('created_by'),
    hasModifiedAtColumn: cols.has('updated_at'),
    hasExamComponentColumn: cols.has('exam_component'),
    hasUniqueExamStudentSubject,
    hasUniqueExamStudentSubjectComponent,
    hasUniqueStudentExamSchedule,
  };
}

async function listExams(req, res) {
  try {
    const ctx = getAuthContext(req);
    const academicYearId = req.query.academic_year_id ? parseId(req.query.academic_year_id) : null;
    const schema = await getExamSchemaFlags();

    const params = [];
    const whereParts = [];
    if (schema.hasIsActiveColumn) whereParts.push('e.is_active = true');
    if (academicYearId) {
      params.push(academicYearId);
      whereParts.push(`e.academic_year_id = $${params.length}`);
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const baseSelect = schema.hasExamClassesTable
      ? `SELECT
           e.id,
           e.exam_name,
           e.exam_type,
           e.academic_year_id,
           e.description,
           e.created_at,
           ARRAY_AGG(DISTINCT c.class_name ORDER BY c.class_name) AS class_names
         FROM exams e
         INNER JOIN exam_classes ec ON ec.exam_id = e.id
         INNER JOIN classes c ON c.id = ec.class_id`
      : schema.hasClassIdColumn
      ? `SELECT
           e.id,
           e.exam_name,
           e.exam_type,
           e.academic_year_id,
           e.description,
           e.created_at,
           ARRAY_AGG(DISTINCT c.class_name ORDER BY c.class_name) AS class_names
         FROM exams e
         LEFT JOIN classes c ON c.id = e.class_id`
      : `SELECT
           e.id,
           e.exam_name,
           e.exam_type,
           e.academic_year_id,
           e.description,
           e.created_at,
           ARRAY['Unassigned']::text[] AS class_names
         FROM exams e`;

    if (isAdmin(ctx)) {
      const r = await query(
        `${baseSelect}
         ${where}
         GROUP BY e.id
         ORDER BY e.created_at DESC`,
        params
      );
      return success(res, 200, 'Exams loaded', r.rows);
    }

    if (isTeacherRole(ctx)) {
      const teacherMap = await query(
        `SELECT t.id AS teacher_id, t.staff_id
         FROM teachers t
         INNER JOIN staff st ON st.id = t.staff_id
         WHERE st.user_id = $1 AND st.status = 'Active'`,
        [ctx.userId]
      );
      if (!teacherMap.rows.length) return success(res, 200, 'Exams loaded', []);

      const teacherIds = teacherMap.rows.map((x) => parseId(x.teacher_id)).filter(Boolean);
      const staffIds = teacherMap.rows.map((x) => parseId(x.staff_id)).filter(Boolean);

      params.push(teacherIds, staffIds);
      const teacherIdsIdx = params.length - 1;
      const staffIdsIdx = params.length;
      if (!teacherIds.length && !staffIds.length) return success(res, 200, 'Exams loaded', []);

      if (!schema.hasExamClassesTable && !schema.hasClassIdColumn) {
        return success(res, 200, 'Exams loaded', []);
      }

      const classField = schema.hasExamClassesTable ? 'ec2.class_id' : 'e.class_id';
      const accessOr = buildTeacherClassAccessOrSql(
        schema,
        classField,
        teacherIdsIdx,
        staffIdsIdx,
        'e.academic_year_id'
      );
      const teacherWhere = schema.hasExamClassesTable
        ? `
          EXISTS (
            SELECT 1
            FROM exam_classes ec2
            WHERE ec2.exam_id = e.id
              AND (${accessOr})
          )
        `
        : `(${accessOr})`;
      const teacherWhereClause = where ? `${where} AND ${teacherWhere}` : `WHERE ${teacherWhere}`;

      const r = await query(
        `${baseSelect}
         ${teacherWhereClause}
         GROUP BY e.id
         ORDER BY e.created_at DESC`,
        params
      );
      return success(res, 200, 'Exams loaded', r.rows);
    }

    return success(res, 200, 'Exams loaded', []);
  } catch (e) {
    console.error('listExams', e);
    return error(res, 500, e.message || 'Failed to load exams');
  }
}

async function getTeacherMaps(userId) {
  const teacherMap = await query(
    `SELECT t.id AS teacher_id, t.staff_id
     FROM teachers t
     INNER JOIN staff st ON st.id = t.staff_id
     WHERE st.user_id = $1 AND st.status = 'Active'`,
    [userId]
  );
  return {
    teacherIds: teacherMap.rows.map((x) => parseId(x.teacher_id)).filter(Boolean),
    staffIds: teacherMap.rows.map((x) => parseId(x.staff_id)).filter(Boolean),
  };
}

async function teacherCanAccessClassSection(userId, classId, sectionId) {
  const { teacherIds, staffIds } = await getTeacherMaps(userId);
  if (!teacherIds.length && !staffIds.length) return false;
  const cid = parseId(classId);
  const sid = parseId(sectionId);
  if (!cid || !sid) return false;

  const schema = await getExamSchemaFlags();
  const parts = [];

  if (schema.sectionsHasLegacyClassTeacherColumns) {
    parts.push(`EXISTS (
      SELECT 1 FROM sections s
      WHERE s.id = $2 AND s.class_id = $1
        AND s.section_teacher_id = ANY($4::int[])
    )`);
  }

  if (schema.hasClassSchedulesTable) {
    let sectionPred;
    if (schema.classSchedulesHasSectionIdColumn) {
      sectionPred = `(cs.section_id = $2 OR cs.section_id IS NULL)`;
    } else if (schema.classSchedulesHasClassSectionIdColumn) {
      sectionPred = `cs.class_section_id IN (
        SELECT csec.id FROM class_sections csec
        WHERE csec.class_id = $1 AND csec.section_id = $2 AND csec.deleted_at IS NULL
      )`;
    } else {
      sectionPred = 'TRUE';
    }
    parts.push(`EXISTS (
      SELECT 1 FROM class_schedules cs
      WHERE cs.class_id = $1
        AND ${sectionPred}
        AND (cs.teacher_id = ANY($3::int[]) OR cs.teacher_id = ANY($4::int[]))
    )`);
  }

  if (schema.hasClassTeachersTable) {
    parts.push(`EXISTS (
      SELECT 1 FROM class_teachers ct
      INNER JOIN class_sections csec ON csec.id = ct.class_section_id
        AND csec.class_id = ct.class_id
        AND csec.academic_year_id = ct.academic_year_id
      WHERE csec.class_id = $1 AND csec.section_id = $2 AND csec.deleted_at IS NULL
        AND ct.staff_id = ANY($4::int[])
        AND ct.deleted_at IS NULL
    )`);
    parts.push(`EXISTS (
      SELECT 1 FROM class_teachers ct
      WHERE ct.class_id = $1 AND ct.class_section_id IS NULL
        AND ct.staff_id = ANY($4::int[])
        AND ct.deleted_at IS NULL
    )`);
  }

  if (schema.classesHasClassTeacherIdColumn) {
    parts.push(`EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = $1
        AND (c.class_teacher_id = ANY($3::int[]) OR c.class_teacher_id = ANY($4::int[]))
    )`);
  }

  if (!parts.length) return false;

  const check = await query(`SELECT 1 WHERE ${parts.join(' OR ')}`, [cid, sid, teacherIds, staffIds]);
  return check.rows.length > 0;
}

/** Legacy sections have class_id; tenant uses class_sections anchored by academic year when examId is set. */
async function validateSectionBelongsToClass(schema, sectionId, classId, examId) {
  const sid = parseId(sectionId);
  const cid = parseId(classId);
  if (!sid || !cid) return false;

  if (schema.sectionsHasClassIdColumn) {
    const r = await query(
      `SELECT id FROM sections WHERE id = $1 AND class_id = $2 LIMIT 1`,
      [sid, cid]
    );
    return (r.rows || []).length > 0;
  }

  const eid = parseId(examId);
  if (eid) {
    const r = await query(
      `SELECT 1
       FROM class_sections csec
       INNER JOIN exams ex ON ex.id = $3 AND csec.academic_year_id = ex.academic_year_id
       WHERE csec.section_id = $1
         AND csec.class_id = $2
         AND csec.deleted_at IS NULL
       LIMIT 1`,
      [sid, cid, eid]
    );
    return (r.rows || []).length > 0;
  }

  const r = await query(
    `SELECT 1
     FROM class_sections csec
     WHERE csec.section_id = $1
       AND csec.class_id = $2
       AND csec.deleted_at IS NULL
     LIMIT 1`,
    [sid, cid]
  );
  return (r.rows || []).length > 0;
}

async function getClassSubjects(classId, examId, preloadedSchema) {
  const schema = preloadedSchema || (await getExamSchemaFlags());
  const cid = parseId(classId);
  const eid = parseId(examId);
  if (!cid) return [];

  if (schema.subjectsHasClassIdColumn) {
    const thCol = schema.subjectsHasTheoryHoursColumn ? 'COALESCE(theory_hours, 0)' : '0::numeric';
    const phCol = schema.subjectsHasPracticalHoursColumn ? 'COALESCE(practical_hours, 0)' : '0::numeric';
    const r = await query(
      `SELECT id, subject_name, subject_code, ${thCol} AS theory_hours, ${phCol} AS practical_hours
       FROM subjects
       WHERE class_id = $1
         AND COALESCE(is_active, true) = true
       ORDER BY subject_name ASC`,
      [cid]
    );
    return r.rows || [];
  }

  const thCsub = schema.classSubjectsHasTheoryHoursColumn ? 'csub.theory_hours' : null;
  const phCsub = schema.classSubjectsHasPracticalHoursColumn ? 'csub.practical_hours' : null;
  const thSub = schema.subjectsHasTheoryHoursColumn ? 's.theory_hours' : null;
  const phSub = schema.subjectsHasPracticalHoursColumn ? 's.practical_hours' : null;

  const theoryFromScheduleSql =
    schema.hasExamSchedulesTable && eid
      ? `(
        SELECT MAX(EXTRACT(EPOCH FROM (es.end_time - es.start_time)) / 3600.0)::numeric(10,2)
        FROM exam_schedules es
        WHERE es.exam_id = $3
          AND es.class_id = csub.class_id
          AND es.class_subject_id = csub.id
          AND es.start_time IS NOT NULL
          AND es.end_time IS NOT NULL
          AND es.end_time > es.start_time
      )`
      : null;

  const curriculumTheoryParts = [thCsub, thSub, '0'].filter(Boolean);
  const curriculumTheoryExpr =
    curriculumTheoryParts.length > 1
      ? `COALESCE(${curriculumTheoryParts.join(', ')})`
      : '0::numeric';

  const curriculumPracticalParts = [phCsub, phSub, '0'].filter(Boolean);
  const curriculumPracticalExpr =
    curriculumPracticalParts.length > 1
      ? `COALESCE(${curriculumPracticalParts.join(', ')})`
      : '0::numeric';

  if (!eid) {
    const r = await query(
      `SELECT DISTINCT ON (s.id) s.id, s.subject_name, s.subject_code,
          ${curriculumTheoryExpr} AS theory_hours,
          ${curriculumPracticalExpr} AS practical_hours
       FROM class_subjects csub
       INNER JOIN subjects s ON s.id = csub.subject_id
       WHERE csub.class_id = $1
         AND csub.deleted_at IS NULL
         AND COALESCE(s.is_active, true) = true
       ORDER BY s.id, s.subject_name ASC`,
      [cid]
    );
    return r.rows || [];
  }

  const ey = await query(`SELECT academic_year_id FROM exams WHERE id = $1`, [eid]);
  const ay = parseId(ey.rows?.[0]?.academic_year_id);
  if (!ay) return [];

  // Display theory duration from saved exam slots only (no DB theory_hours column required).
  const theoryExprWithExam =
    theoryFromScheduleSql != null
      ? `COALESCE(${theoryFromScheduleSql}, 0::numeric)`
      : curriculumTheoryExpr;

  const r = await query(
    `SELECT s.id, s.subject_name, s.subject_code,
        ${theoryExprWithExam} AS theory_hours,
        ${curriculumPracticalExpr} AS practical_hours
     FROM class_subjects csub
     INNER JOIN subjects s ON s.id = csub.subject_id
     WHERE csub.class_id = $1
       AND csub.academic_year_id = $2
       AND csub.deleted_at IS NULL
       AND COALESCE(s.is_active, true) = true
     ORDER BY s.subject_name ASC`,
    theoryFromScheduleSql != null ? [cid, ay, eid] : [cid, ay]
  );
  return r.rows || [];
}

async function getManageContext(req, res) {
  try {
    const examId = parseId(req.params.id);
    if (!examId) return error(res, 400, 'Invalid exam id');

    const ctx = getAuthContext(req);
    const schema = await getExamSchemaFlags();

    if (!schema.hasExamClassesTable && !schema.hasClassIdColumn) {
      return success(res, 200, 'Context loaded', { classes: [] });
    }

    const classRows = await query(
      schema.hasExamClassesTable
        ? `SELECT c.id AS class_id, c.class_name, c.class_code
           FROM exam_classes ec
           INNER JOIN classes c ON c.id = ec.class_id
           WHERE ec.exam_id = $1
           ORDER BY c.class_name`
        : `SELECT c.id AS class_id, c.class_name, c.class_code
           FROM exams e
           INNER JOIN classes c ON c.id = e.class_id
           WHERE e.id = $1`,
      [examId]
    );

    let classMap = classRows.rows.map((r) => ({
      class_id: parseId(r.class_id),
      class_name: r.class_name,
      class_code: r.class_code || null,
      sections: [],
    }));

    if (isTeacherRole(ctx)) {
      const { teacherIds, staffIds } = await getTeacherMaps(ctx.userId);
      if (!teacherIds.length && !staffIds.length) return success(res, 200, 'Context loaded', { classes: [] });
      const classIds = classMap.map((x) => x.class_id).filter(Boolean);
      let sectionRows;
      if (schema.sectionsHasLegacyClassTeacherColumns) {
        sectionRows = await query(
          `SELECT s.id AS section_id, s.section_name, s.class_id
           FROM sections s
           WHERE s.class_id = ANY($1::int[])
             AND (
               s.section_teacher_id = ANY($2::int[])
               OR EXISTS (
                 SELECT 1 FROM class_schedules cs
                 WHERE cs.class_id = s.class_id
                   AND (cs.section_id = s.id OR cs.section_id IS NULL)
                   AND (cs.teacher_id = ANY($2::int[]) OR cs.teacher_id = ANY($3::int[]))
               )
               OR EXISTS (
                 SELECT 1 FROM classes c
                 WHERE c.id = s.class_id
                   AND (c.class_teacher_id = ANY($3::int[]) OR c.class_teacher_id = ANY($2::int[]))
               )
             )
           ORDER BY s.section_name`,
          [classIds, staffIds, teacherIds]
        );
      } else {
        const accessParts = [];
        if (schema.hasClassTeachersTable) {
          accessParts.push(`EXISTS (
            SELECT 1 FROM class_teachers ct
            WHERE ct.class_id = csec.class_id
              AND ct.deleted_at IS NULL
              AND ct.staff_id = ANY($2::int[])
              AND (
                ct.class_section_id IS NULL
                OR (
                  ct.class_section_id = csec.id
                  AND ct.class_id = csec.class_id
                  AND ct.academic_year_id = csec.academic_year_id
                )
              )
          )`);
        }
        if (schema.hasClassSchedulesTable) {
          if (schema.classSchedulesHasClassSectionIdColumn) {
            accessParts.push(`EXISTS (
              SELECT 1 FROM class_schedules cs
              WHERE cs.class_section_id = csec.id
                AND (cs.teacher_id = ANY($2::int[]) OR cs.teacher_id = ANY($3::int[]))
            )`);
          } else if (schema.classSchedulesHasSectionIdColumn) {
            accessParts.push(`EXISTS (
              SELECT 1 FROM class_schedules cs
              WHERE cs.class_id = csec.class_id
                AND (cs.section_id = csec.section_id OR cs.section_id IS NULL)
                AND (cs.teacher_id = ANY($2::int[]) OR cs.teacher_id = ANY($3::int[]))
            )`);
          }
        }
        if (schema.classesHasClassTeacherIdColumn) {
          accessParts.push(`EXISTS (
            SELECT 1 FROM classes c
            WHERE c.id = csec.class_id
              AND (c.class_teacher_id = ANY($3::int[]) OR c.class_teacher_id = ANY($2::int[]))
          )`);
        }
        const accessSql = accessParts.length ? accessParts.join(' OR ') : 'FALSE';
        sectionRows = await query(
          `SELECT DISTINCT csec.section_id AS section_id, sec.section_name, csec.class_id
           FROM class_sections csec
           INNER JOIN sections sec ON sec.id = csec.section_id
           WHERE csec.class_id = ANY($1::int[])
             AND csec.deleted_at IS NULL
             AND (${accessSql})
           ORDER BY sec.section_name`,
          [classIds, staffIds, teacherIds]
        );
      }
      const byClass = new Map();
      sectionRows.rows.forEach((s) => {
        const k = parseId(s.class_id);
        if (!byClass.has(k)) byClass.set(k, []);
        byClass.get(k).push({ section_id: parseId(s.section_id), section_name: s.section_name });
      });
      classMap = classMap
        .map((c) => ({ ...c, sections: byClass.get(c.class_id) || [] }))
        .filter((c) => c.sections.length > 0);
    } else {
      const classIds = classMap.map((x) => x.class_id).filter(Boolean);
      const sec = schema.sectionsHasLegacyClassTeacherColumns
        ? await query(
            `SELECT id AS section_id, section_name, class_id
             FROM sections
             WHERE class_id = ANY($1::int[])
             ORDER BY section_name`,
            [classIds]
          )
        : await query(
            `SELECT DISTINCT csec.section_id AS section_id, sec.section_name, csec.class_id
             FROM class_sections csec
             INNER JOIN sections sec ON sec.id = csec.section_id
             WHERE csec.class_id = ANY($1::int[])
               AND csec.deleted_at IS NULL
             ORDER BY sec.section_name`,
            [classIds]
          );
      const byClass = new Map();
      sec.rows.forEach((s) => {
        const k = parseId(s.class_id);
        if (!byClass.has(k)) byClass.set(k, []);
        byClass.get(k).push({ section_id: parseId(s.section_id), section_name: s.section_name });
      });
      classMap = classMap.map((c) => ({ ...c, sections: byClass.get(c.class_id) || [] }));
    }

    return success(res, 200, 'Context loaded', { classes: classMap });
  } catch (e) {
    console.error('getManageContext', e);
    return error(res, 500, 'Failed to load manage context');
  }
}

async function listExamSubjects(req, res) {
  try {
    const examId = parseId(req.query.exam_id);
    const classId = parseId(req.query.class_id);
    const sectionId = parseId(req.query.section_id);
    if (!examId || !classId || !sectionId) return error(res, 400, 'exam_id, class_id and section_id are required');

    const ctx = getAuthContext(req);
    if (isTeacherRole(ctx)) {
      const ok = await teacherCanAccessClassSection(ctx.userId, classId, sectionId);
      if (!ok) return error(res, 403, 'You are not allowed to view this class section timetable');
    }

    const schemaList = await getExamSchemaFlags();
    let r;
    if (schemaList.hasExamSubjectsTable) {
      r = await query(
        `SELECT es.id, es.subject_id, s.subject_name, es.max_marks, es.passing_marks, es.exam_date, es.start_time, es.end_time
         FROM exam_subjects es
         INNER JOIN subjects s ON s.id = es.subject_id
         WHERE es.exam_id = $1 AND es.class_id = $2 AND es.section_id = $3
         ORDER BY s.subject_name`,
        [examId, classId, sectionId]
      );
    } else if (schemaList.hasExamSchedulesTable) {
      r = await query(
        `SELECT es.id, csub.subject_id, s.subject_name, es.max_marks, es.passing_marks, es.exam_date, es.start_time, es.end_time
         FROM exam_schedules es
         INNER JOIN class_subjects csub
           ON csub.id = es.class_subject_id
          AND csub.class_id = es.class_id
          AND csub.academic_year_id = es.academic_year_id
         INNER JOIN subjects s ON s.id = csub.subject_id
         INNER JOIN class_sections csec
           ON csec.id = es.class_section_id
          AND csec.class_id = es.class_id
          AND csec.academic_year_id = es.academic_year_id
         WHERE es.exam_id = $1
           AND es.class_id = $2
           AND csec.section_id = $3
           AND es.class_section_id IS NOT NULL
         ORDER BY s.subject_name`,
        [examId, classId, sectionId]
      );
    } else {
      return error(res, 503, 'Timetable storage is not available for this database.');
    }

    return success(res, 200, 'Timetable loaded', r.rows);
  } catch (e) {
    console.error('listExamSubjects', e);
    return error(res, 500, 'Failed to load timetable');
  }
}

async function listExamSubjectOptions(req, res) {
  try {
    const examId = parseId(req.query.exam_id);
    const classId = parseId(req.query.class_id);
    const sectionId = parseId(req.query.section_id);
    if (!examId || !classId || !sectionId) return error(res, 400, 'exam_id, class_id and section_id are required');

    const ctx = getAuthContext(req);
    if (isTeacherRole(ctx)) {
      const ok = await teacherCanAccessClassSection(ctx.userId, classId, sectionId);
      if (!ok) return error(res, 403, 'You are not allowed to view this class section subjects');
    }

    const schema = await getExamSchemaFlags();
    const rows = await getClassSubjects(classId, examId, schema);
    return success(
      res,
      200,
      'Subjects loaded',
      rows.map((r) => ({ id: r.id, subject_name: r.subject_name }))
    );
  } catch (e) {
    console.error('listExamSubjectOptions', e);
    return error(res, 500, 'Failed to load subjects');
  }
}

async function getExamSubjectsContext(req, res) {
  try {
    const examId = parseId(req.query.exam_id);
    const classId = parseId(req.query.class_id);
    const sectionId = parseId(req.query.section_id);
    if (!examId || !classId || !sectionId) {
      return error(res, 400, 'exam_id, class_id and section_id are required');
    }

    const schema = await getExamSchemaFlags();

    const sectionOk = await validateSectionBelongsToClass(schema, sectionId, classId, examId);
    if (!sectionOk) return error(res, 400, 'Invalid class and section combination');

    const ctx = getAuthContext(req);
    if (isTeacherRole(ctx)) {
      const ok = await teacherCanAccessClassSection(ctx.userId, classId, sectionId);
      if (!ok) return error(res, 403, 'You are not allowed to access this class section');
    }

    const classSubjects = await getClassSubjects(classId, examId, schema);
    if (!classSubjects.length) {
      return success(res, 200, 'No subjects found for selected class', {
        subjects: [],
        timetable_rows: [],
      });
    }

    let existingRows = [];
    if (schema.hasExamSubjectsTable) {
      const existing = await query(
        `SELECT subject_id, max_marks, passing_marks, exam_date, start_time, end_time
         FROM exam_subjects
         WHERE exam_id = $1 AND class_id = $2 AND section_id = $3`,
        [examId, classId, sectionId]
      );
      existingRows = existing.rows || [];
    } else if (schema.hasExamSchedulesTable) {
      const csecRes = await query(
        `SELECT id FROM class_sections
         WHERE class_id = $1 AND section_id = $2
           AND academic_year_id = (SELECT academic_year_id FROM exams WHERE id = $3)
           AND deleted_at IS NULL
         LIMIT 1`,
        [classId, sectionId, examId]
      );
      const classSectionAnchorId = parseId(csecRes.rows?.[0]?.id);
      if (classSectionAnchorId) {
        const ex = await query(
          `SELECT csub.subject_id, es.max_marks, es.passing_marks, es.exam_date, es.start_time, es.end_time
           FROM exam_schedules es
           INNER JOIN class_subjects csub ON csub.id = es.class_subject_id
           WHERE es.exam_id = $1 AND es.class_id = $2 AND es.class_section_id = $3`,
          [examId, classId, classSectionAnchorId]
        );
        existingRows = ex.rows || [];
      }
    }
    const bySubject = new Map(existingRows.map((r) => [parseId(r.subject_id), r]));

    const byName = new Map();
    classSubjects.forEach((s) => {
      const key = String(s.subject_name || '').trim().toLowerCase();
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(s);
    });

    const rows = classSubjects.map((s) => {
      const ex = bySubject.get(parseId(s.id));
      const theoryHours = Number(s.theory_hours || 0);
      const practicalHours = Number(s.practical_hours || 0);
      const code = String(s.subject_code || '').toLowerCase();
      const name = String(s.subject_name || '').toLowerCase();
      const siblings = byName.get(String(s.subject_name || '').trim().toLowerCase()) || [];
      let subjectMode = 'Theory';

      if (practicalHours > 0) subjectMode = 'Practical';
      else if (/(practical|lab|prac)\b/.test(name) || /(practical|lab|prac|_p|\/p|\-p)\b/.test(code)) {
        subjectMode = 'Practical';
      } else if (/(theory|th)\b/.test(name) || /(theory|th|_t|\/t|\-t)\b/.test(code)) {
        subjectMode = 'Theory';
      } else if (siblings.length > 1) {
        const sorted = [...siblings].sort((a, b) => parseId(a.id) - parseId(b.id));
        const pos = sorted.findIndex((x) => parseId(x.id) === parseId(s.id));
        subjectMode = pos <= 0 ? 'Theory' : 'Practical';
      }

      return {
        subject_id: parseId(s.id),
        subject_name: s.subject_name,
        subject_code: s.subject_code || null,
        subject_mode: subjectMode,
        max_marks: ex ? Number(ex.max_marks) : 100,
        passing_marks: ex ? Number(ex.passing_marks) : 35,
        exam_date: ex?.exam_date || null,
        start_time: ex?.start_time ? String(ex.start_time).slice(0, 5) : null,
        end_time: ex?.end_time ? String(ex.end_time).slice(0, 5) : null,
      };
    });

    return success(res, 200, 'Context loaded', {
      subjects: classSubjects,
      timetable_rows: rows,
    });
  } catch (e) {
    console.error('getExamSubjectsContext', e);
    return error(res, 500, 'Failed to load exam-subject context');
  }
}

/** Matches typical tenant values (Active/active/blank/NULL); excludes inactive/withdrawn when stored plainly. */
function examStudentStatusSql(qualifiedStudentAlias = 's') {
  const a = String(qualifiedStudentAlias).trim();
  return `(${a}.status IS NULL OR TRIM(COALESCE(${a}.status::text, '')) = '' OR LOWER(TRIM(COALESCE(${a}.status::text, ''))) = 'active')`;
}

/**
 * Class/section/year from enrollment only (ledger or legacy students columns).
 * Used for learner exam timetable discovery so it stays aligned with getStudentExamResults,
 * which joins exam_schedules via lateralCurrentEnrollment — not via attendance overrides.
 */
async function fetchEnrollmentOnlyScopeByStudentId(scopeSchema, studentId) {
  const sid = parseId(studentId);
  if (!sid) return null;
  if (scopeSchema.studentsHasLegacyClassColumns) {
    const r = await query(
      `SELECT s.id AS student_id, s.class_id, s.section_id, NULL::int AS academic_year_id
       FROM students s
       WHERE s.id = $1
       LIMIT 1`,
      [sid]
    );
    return r.rows?.[0] || null;
  }
  if (scopeSchema.hasStudentLifecycleLedger) {
    const r = await query(
      `SELECT s.id AS student_id, enr.class_id, enr.section_id, enr.academic_year_id
       FROM students s
       ${lateralCurrentEnrollment('s.id')}
       WHERE s.id = $1
       LIMIT 1`,
      [sid]
    );
    return r.rows?.[0] || null;
  }
  return null;
}

function isExamStudentPortalAuth(ctx) {
  if (!ctx) return false;
  if (ctx.roleId === ROLES.STUDENT) return true;
  const n = String(ctx.roleName || '').trim().toLowerCase();
  return n === 'student' || n === 'students';
}

async function resolveStudentScopeByUser(ctx) {
  const scopeSchema = await getExamSchemaFlags();

  async function queryStudentScopeViaGuardianLinks(userId) {
    const stOk = examStudentStatusSql('s');
    const guardianActiveSql = `(g.is_active IS NULL OR g.is_active = true)`;
    if (scopeSchema.studentsHasLegacyClassColumns) {
      return query(
        `SELECT s.id AS student_id, s.class_id, s.section_id
         FROM guardians g
         INNER JOIN student_guardian_links sgl ON sgl.guardian_id = g.id
         INNER JOIN students s ON s.id = sgl.student_id
         WHERE g.user_id = $1 AND ${guardianActiveSql} AND ${stOk}
         ORDER BY s.id DESC
         LIMIT 1`,
        [userId]
      );
    }
    if (scopeSchema.hasStudentLifecycleLedger) {
      return query(
        `SELECT s.id AS student_id, enr.class_id, enr.section_id
         FROM guardians g
         INNER JOIN student_guardian_links sgl ON sgl.guardian_id = g.id
         INNER JOIN students s ON s.id = sgl.student_id
         ${lateralCurrentEnrollment('s.id')}
         WHERE g.user_id = $1 AND ${guardianActiveSql} AND ${stOk}
         ORDER BY s.id DESC
         LIMIT 1`,
        [userId]
      );
    }
    return query(
      `SELECT s.id AS student_id
       FROM guardians g
       INNER JOIN student_guardian_links sgl ON sgl.guardian_id = g.id
       INNER JOIN students s ON s.id = sgl.student_id
       WHERE g.user_id = $1 AND ${guardianActiveSql} AND ${stOk}
       ORDER BY s.id DESC
       LIMIT 1`,
      [userId]
    );
  }

  const resolveLatestLinkedStudentId = async (studentId) => {
    const sid = parseId(studentId);
    if (!sid) return null;
    const latest = await query(
      `WITH base AS (
         SELECT id, user_id, admission_number, roll_number
         FROM students
         WHERE id = $1
         LIMIT 1
       )
       SELECT s2.id AS student_id
       FROM base b
       INNER JOIN students s2
         ON ${examStudentStatusSql('s2')}
        AND (
          (b.user_id IS NOT NULL AND s2.user_id = b.user_id)
          OR (COALESCE(NULLIF(TRIM(b.admission_number), ''), '') <> '' AND s2.admission_number = b.admission_number)
          OR (COALESCE(NULLIF(TRIM(b.roll_number), ''), '') <> '' AND s2.roll_number = b.roll_number)
        )
       ORDER BY s2.id DESC
       LIMIT 1`,
      [sid]
    );
    return parseId(latest.rows?.[0]?.student_id) || sid;
  };

  async function normalizeToLatestStudentRecord(row) {
    const studentId = parseId(row?.student_id);
    if (!studentId) return row || null;
    const resolvedId = await resolveLatestLinkedStudentId(studentId);

    let latest;
    if (scopeSchema.studentsHasLegacyClassColumns) {
      latest = await query(
        `SELECT s2.id AS student_id, s2.class_id, s2.section_id
         FROM students s2
         WHERE s2.id = $1
         LIMIT 1`,
        [resolvedId]
      );
    } else if (scopeSchema.hasStudentLifecycleLedger) {
      latest = await query(
        `SELECT s2.id AS student_id, enr.class_id, enr.section_id, enr.academic_year_id
         FROM students s2
         ${lateralCurrentEnrollment('s2.id')}
         WHERE s2.id = $1
         LIMIT 1`,
        [resolvedId]
      );
    } else {
      latest = await query(
        `SELECT s2.id AS student_id
         FROM students s2
         WHERE s2.id = $1
         LIMIT 1`,
        [resolvedId]
      );
    }
    return latest.rows?.[0] || row;
  }

  async function enrichScopeFromAttendance(row) {
    const normalizedRow = await normalizeToLatestStudentRecord(row);
    if (!normalizedRow?.student_id) return normalizedRow || null;
    const baseClassId = parseId(normalizedRow.class_id);
    const baseSectionId = parseId(normalizedRow.section_id);

    // Prefer current enrollment (ledger/students) when class+section are known. Promotions are a
    // fallback when scope is incomplete — otherwise a stale promotion row can override the real class.
    if (
      scopeSchema.hasStudentPromotionsTable &&
      (!baseClassId || !baseSectionId)
    ) {
      const promotion = await query(
        `SELECT to_class_id AS class_id, to_section_id AS section_id
         FROM student_promotions
         WHERE student_id = $1
           AND to_class_id IS NOT NULL
           AND to_section_id IS NOT NULL
         ORDER BY id DESC
         LIMIT 1`,
        [normalizedRow.student_id]
      ).catch(() => ({ rows: [] }));
      if (promotion.rows?.length) {
        return {
          ...normalizedRow,
          class_id: promotion.rows[0].class_id,
          section_id: promotion.rows[0].section_id,
        };
      }
    }

    let fallback = { rows: [] };
    if (scopeSchema.hasLegacyAttendanceTable) {
      fallback = await query(
        `SELECT class_id, section_id
         FROM attendance
         WHERE student_id = $1
           AND class_id IS NOT NULL
           AND section_id IS NOT NULL
         ORDER BY attendance_date DESC NULLS LAST, id DESC
         LIMIT 1`,
        [normalizedRow.student_id]
      ).catch(() => ({ rows: [] }));
    } else if (scopeSchema.hasStudentAttendanceTable) {
      fallback = await query(
        `SELECT sa.class_id, csec.section_id
         FROM student_attendance sa
         INNER JOIN class_sections csec
           ON csec.id = sa.class_section_id
          AND csec.class_id = sa.class_id
          AND csec.academic_year_id = sa.academic_year_id
         WHERE sa.student_id = $1
         ORDER BY sa.attendance_date DESC NULLS LAST, sa.id DESC
         LIMIT 1`,
        [normalizedRow.student_id]
      ).catch(() => ({ rows: [] }));
    }
    if (!fallback.rows.length) return normalizedRow;

    const fbClassId = parseId(fallback.rows[0].class_id);
    const fbSectionId = parseId(fallback.rows[0].section_id);
    if (!fbClassId || !fbSectionId) return normalizedRow;

    // Attendance is operationally freshest for student scope. Prefer it when base scope is missing
    // or stale/mismatched; this keeps student timetable/results aligned with assigned class-section.
    if (!baseClassId || !baseSectionId || fbClassId !== baseClassId || fbSectionId !== baseSectionId) {
      return {
        ...normalizedRow,
        class_id: fbClassId,
        section_id: fbSectionId,
      };
    }

    return normalizedRow;
  }

  /** Same user_id can have multiple legacy student PKs — pick enrollment that resolves to full class + section first. */
  async function scopeFromPortalStudentCandidates(userSqlRows) {
    const list = userSqlRows || [];
    if (!list.length) return null;
    for (const row of list) {
      const enriched = await enrichScopeFromAttendance(row);
      const cid = parseId(enriched?.class_id);
      const sid = parseId(enriched?.section_id);
      if (cid && sid) return enriched;
    }
    return enrichScopeFromAttendance(list[0]);
  }

  async function loadStudentExamPortalScopesForUser(uid) {
    let res;
    if (scopeSchema.studentsHasLegacyClassColumns) {
      res = await query(
        `SELECT s.id AS student_id, s.class_id, s.section_id
         FROM students s
         WHERE s.user_id = $1
         ORDER BY s.id DESC`,
        [uid]
      );
    } else if (scopeSchema.hasStudentLifecycleLedger) {
      res = await query(
        `SELECT s.id AS student_id, enr.class_id, enr.section_id, enr.academic_year_id
         FROM students s
         ${lateralCurrentEnrollment('s.id')}
         WHERE s.user_id = $1
         ORDER BY s.id DESC`,
        [uid]
      );
    } else {
      res = await query(
        `SELECT s.id AS student_id
         FROM students s
         WHERE s.user_id = $1
         ORDER BY s.id DESC`,
        [uid]
      );
    }
    return scopeFromPortalStudentCandidates(res.rows || []);
  }

  async function fetchStudentRecordByStudentId(studentId) {
    const stOk = examStudentStatusSql('s');
    if (scopeSchema.studentsHasLegacyClassColumns) {
      const r = await query(
        `SELECT s.id AS student_id, s.class_id, s.section_id
         FROM students s
         WHERE s.id = $1 AND ${stOk}
         LIMIT 1`,
        [studentId]
      );
      return r.rows?.[0] || null;
    }
    if (scopeSchema.hasStudentLifecycleLedger) {
      const r = await query(
        `SELECT s.id AS student_id, enr.class_id, enr.section_id
         FROM students s
         ${lateralCurrentEnrollment('s.id')}
         WHERE s.id = $1 AND ${stOk}
         LIMIT 1`,
        [studentId]
      );
      return r.rows?.[0] || null;
    }
    const r = await query(
      `SELECT s.id AS student_id FROM students s WHERE s.id = $1 AND ${stOk} LIMIT 1`,
      [studentId]
    );
    return r.rows?.[0] || null;
  }

  if (!ctx?.userId) return null;

  if (isExamStudentPortalAuth(ctx)) {
    const directScope = await loadStudentExamPortalScopesForUser(ctx.userId);
    if (directScope && parseId(directScope.class_id)) return directScope;

    // Some tenants do not backfill students.user_id for old student users.
    // In those cases auth user id can still match students.id.
    const byStudentPrimaryKey = await fetchStudentRecordByStudentId(ctx.userId);
    const normalizedByPk = await enrichScopeFromAttendance(byStudentPrimaryKey);
    if (normalizedByPk && parseId(normalizedByPk.class_id)) return normalizedByPk;

    return directScope;
  }

  if (ctx.roleId === ROLES.PARENT || ctx.roleName === 'parent') {
    const stOk = examStudentStatusSql('s');
    let q = { rows: [] };

    if (scopeSchema.hasParentsTable) {
      if (scopeSchema.studentsHasLegacyClassColumns) {
        q = await query(
          `SELECT s.id AS student_id, s.class_id, s.section_id
           FROM parents p
           INNER JOIN students s ON s.id = p.student_id
           WHERE p.user_id = $1 AND ${stOk}
           ORDER BY s.id DESC
           LIMIT 1`,
          [ctx.userId]
        );
      } else if (scopeSchema.hasStudentLifecycleLedger) {
        q = await query(
          `SELECT s.id AS student_id, enr.class_id, enr.section_id
           FROM parents p
           INNER JOIN students s ON s.id = p.student_id
           ${lateralCurrentEnrollment('s.id')}
           WHERE p.user_id = $1 AND ${stOk}
           ORDER BY s.id DESC
           LIMIT 1`,
          [ctx.userId]
        );
      } else {
        q = await query(
          `SELECT s.id AS student_id
           FROM parents p
           INNER JOIN students s ON s.id = p.student_id
           WHERE p.user_id = $1 AND ${stOk}
           ORDER BY s.id DESC
           LIMIT 1`,
          [ctx.userId]
        );
      }
    }

    if (!q.rows.length && scopeSchema.hasStudentGuardianLinksTable) {
      q = await queryStudentScopeViaGuardianLinks(ctx.userId);
    }
    if (!q.rows.length) {
      const linked = await getParentsForUser(ctx.userId).catch(() => ({ studentIds: [] }));
      const sid = await resolveLatestLinkedStudentId(linked.studentIds?.[0]);
      if (sid) {
        const inner = await fetchStudentRecordByStudentId(sid);
        return enrichScopeFromAttendance(inner);
      }
    }
    return enrichScopeFromAttendance(q.rows[0] || null);
  }

  if (ctx.roleId === ROLES.GUARDIAN || ctx.roleName === 'guardian') {
    const stOk = examStudentStatusSql('s');
    let q = { rows: [] };

    if (scopeSchema.guardiansHasStudentIdColumn) {
      if (scopeSchema.studentsHasLegacyClassColumns) {
        q = await query(
          `SELECT s.id AS student_id, s.class_id, s.section_id
           FROM guardians g
           INNER JOIN students s ON s.id = g.student_id
           WHERE g.user_id = $1 AND ${stOk}
           ORDER BY s.id DESC
           LIMIT 1`,
          [ctx.userId]
        );
      } else if (scopeSchema.hasStudentLifecycleLedger) {
        q = await query(
          `SELECT s.id AS student_id, enr.class_id, enr.section_id
           FROM guardians g
           INNER JOIN students s ON s.id = g.student_id
           ${lateralCurrentEnrollment('s.id')}
           WHERE g.user_id = $1 AND ${stOk}
           ORDER BY s.id DESC
           LIMIT 1`,
          [ctx.userId]
        );
      } else {
        q = await query(
          `SELECT s.id AS student_id
           FROM guardians g
           INNER JOIN students s ON s.id = g.student_id
           WHERE g.user_id = $1 AND ${stOk}
           ORDER BY s.id DESC
           LIMIT 1`,
          [ctx.userId]
        );
      }
    }

    if (!q.rows.length && scopeSchema.hasStudentGuardianLinksTable) {
      q = await queryStudentScopeViaGuardianLinks(ctx.userId);
    }
    if (!q.rows.length) {
      const linked = await getParentsForUser(ctx.userId).catch(() => ({ studentIds: [] }));
      const sid = await resolveLatestLinkedStudentId(linked.studentIds?.[0]);
      if (sid) {
        const inner = await fetchStudentRecordByStudentId(sid);
        return enrichScopeFromAttendance(inner);
      }
    }
    return enrichScopeFromAttendance(q.rows[0] || null);
  }

  if (
    ctx.userId &&
    !isAdmin(ctx) &&
    !isTeacherRole(ctx) &&
    ctx.roleId !== ROLES.PARENT &&
    ctx.roleId !== ROLES.GUARDIAN
  ) {
    const inferred = await loadStudentExamPortalScopesForUser(ctx.userId);
    if (inferred && parseId(inferred.class_id)) return inferred;
  }

  // Last-resort fallback for student-like auth rows whose role_name/role_id mapping is non-standard.
  // This keeps exam timetable available for the logged-in learner even if role labeling is inconsistent.
  if (ctx.userId) {
    const inferred = await loadStudentExamPortalScopesForUser(ctx.userId);
    if (inferred && parseId(inferred.class_id)) return inferred;
  }

  return null;
}

async function viewExamSchedule(req, res) {
  try {
    const ctx = getAuthContext(req);
    let examId = parseId(req.query.exam_id);
    let classId = parseId(req.query.class_id);
    let sectionId = parseId(req.query.section_id);

    const schema = await getExamSchemaFlags();
    const selfStudent = await resolveStudentScopeByUser(ctx);
    if (selfStudent) {
      const enrOnly = await fetchEnrollmentOnlyScopeByStudentId(schema, selfStudent.student_id);
      const ec = parseId(enrOnly?.class_id);
      const es = parseId(enrOnly?.section_id);
      classId = ec || parseId(selfStudent.class_id);
      sectionId = es || parseId(selfStudent.section_id);
    }

    if (!classId || !sectionId) {
      return error(res, 400, 'class_id and section_id are required');
    }
    const sectionOk = await validateSectionBelongsToClass(schema, sectionId, classId, examId);
    if (!sectionOk) return error(res, 400, 'Invalid class and section combination');

    if (isTeacherRole(ctx)) {
      const ok = await teacherCanAccessClassSection(ctx.userId, classId, sectionId);
      if (!ok) return error(res, 403, 'You are not allowed to view this class section timetable');
    }

    if (!schema.hasExamSubjectsTable && !schema.hasExamSchedulesTable) {
      return error(res, 503, 'Exam schedule storage is not available for this database.');
    }

    const params = [classId, sectionId];
    let examFilterSubjects = '';
    let examFilterSched = '';
    if (examId) {
      params.push(examId);
      examFilterSubjects = ` AND es.exam_id = $${params.length}`;
      examFilterSched = ` AND es.exam_id = $${params.length}`;
    }

    let r = { rows: [] };
    if (schema.hasExamSubjectsTable) {
      r = await query(
        `SELECT
           es.exam_id,
           e.exam_name,
           e.exam_type,
           es.class_id,
           c.class_name,
           es.section_id,
           sec.section_name,
           es.subject_id,
           s.subject_name,
           s.subject_code,
           es.exam_date,
           es.start_time,
           es.end_time,
           es.max_marks,
           es.passing_marks
         FROM exam_subjects es
         INNER JOIN exams e ON e.id = es.exam_id
         INNER JOIN subjects s ON s.id = es.subject_id
         LEFT JOIN classes c ON c.id = es.class_id
         LEFT JOIN sections sec ON sec.id = es.section_id
         WHERE es.class_id = $1
           AND es.section_id = $2
           ${examFilterSubjects}
         ORDER BY e.created_at DESC, es.exam_date ASC NULLS LAST, es.start_time ASC NULLS LAST, s.subject_name ASC`,
        params
      );
    }
    if ((!r.rows || r.rows.length === 0) && schema.hasExamSchedulesTable) {
      r = await query(
        `SELECT
           es.exam_id,
           e.exam_name,
           e.exam_type,
           es.class_id,
           c.class_name,
           csec.section_id,
           sec.section_name,
           csub.subject_id,
           s.subject_name,
           s.subject_code,
           es.exam_date,
           es.start_time,
           es.end_time,
           es.max_marks,
           es.passing_marks
         FROM exam_schedules es
         INNER JOIN exams e ON e.id = es.exam_id
         INNER JOIN class_subjects csub
           ON csub.id = es.class_subject_id
          AND csub.class_id = es.class_id
          AND csub.academic_year_id = es.academic_year_id
         INNER JOIN subjects s ON s.id = csub.subject_id
         INNER JOIN classes c ON c.id = es.class_id
         INNER JOIN class_sections csec
           ON csec.id = es.class_section_id
          AND csec.class_id = es.class_id
          AND csec.academic_year_id = es.academic_year_id
         LEFT JOIN sections sec ON sec.id = csec.section_id
         WHERE es.class_id = $1
           AND csec.section_id = $2
           AND es.class_section_id IS NOT NULL
           ${examFilterSched}
         ORDER BY e.created_at DESC, es.exam_date ASC NULLS LAST, es.start_time ASC NULLS LAST, s.subject_name ASC`,
        params
      );
    }

    if (
      (!r.rows || r.rows.length === 0) &&
      selfStudent &&
      parseId(selfStudent.student_id) &&
      examId
    ) {
      const stId = parseId(selfStudent.student_id);
      if (schema.hasExamSchedulesTable && schema.examResultsHasExamScheduleIdColumn) {
        r = await query(
          `SELECT
             es.exam_id,
             e.exam_name,
             e.exam_type,
             es.class_id,
             c.class_name,
             csec.section_id,
             sec.section_name,
             csub.subject_id,
             s.subject_name,
             s.subject_code,
             es.exam_date,
             es.start_time,
             es.end_time,
             es.max_marks,
             es.passing_marks
           FROM exam_schedules es
           INNER JOIN exams e ON e.id = es.exam_id
           INNER JOIN class_subjects csub
             ON csub.id = es.class_subject_id
            AND csub.class_id = es.class_id
            AND csub.academic_year_id = es.academic_year_id
           INNER JOIN subjects s ON s.id = csub.subject_id
           INNER JOIN classes c ON c.id = es.class_id
           INNER JOIN class_sections csec
             ON csec.id = es.class_section_id
            AND csec.class_id = es.class_id
            AND csec.academic_year_id = es.academic_year_id
           LEFT JOIN sections sec ON sec.id = csec.section_id
           INNER JOIN exam_results er
             ON er.exam_schedule_id = es.id
            AND er.student_id = $2
           WHERE es.exam_id = $1
             AND es.class_section_id IS NOT NULL
           ORDER BY e.created_at DESC, es.exam_date ASC NULLS LAST, es.start_time ASC NULLS LAST, s.subject_name ASC`,
          [examId, stId]
        );
      } else if (
        schema.hasExamSubjectsTable &&
        schema.examResultsHasExamIdColumn &&
        schema.examResultsHasSubjectIdColumn
      ) {
        r = await query(
          `SELECT
             es.exam_id,
             e.exam_name,
             e.exam_type,
             es.class_id,
             c.class_name,
             es.section_id,
             sec.section_name,
             es.subject_id,
             s.subject_name,
             s.subject_code,
             es.exam_date,
             es.start_time,
             es.end_time,
             es.max_marks,
             es.passing_marks
           FROM exam_subjects es
           INNER JOIN exams e ON e.id = es.exam_id
           INNER JOIN subjects s ON s.id = es.subject_id
           LEFT JOIN classes c ON c.id = es.class_id
           LEFT JOIN sections sec ON sec.id = es.section_id
           INNER JOIN exam_results er
             ON er.exam_id = es.exam_id
            AND er.student_id = $4
            AND er.subject_id = es.subject_id
           WHERE es.exam_id = $1
             AND es.class_id = $2
             AND es.section_id = $3
           ORDER BY e.created_at DESC, es.exam_date ASC NULLS LAST, es.start_time ASC NULLS LAST, s.subject_name ASC`,
          [examId, classId, sectionId, stId]
        );
      }
    }

    return success(res, 200, 'Exam schedule loaded', r.rows);
  } catch (e) {
    console.error('viewExamSchedule', e);
    return error(res, 500, 'Failed to load exam schedule');
  }
}

async function viewExamResults(req, res) {
  try {
    const ctx = getAuthContext(req);
    const examId = parseId(req.query.exam_id);
    let classId = parseId(req.query.class_id);
    let sectionId = parseId(req.query.section_id);

    if (!examId) return error(res, 400, 'exam_id is required');

    const schema = await getExamSchemaFlags();
    const scheduleBackedExamResults =
      schema.examResultsHasExamScheduleIdColumn &&
      !schema.examResultsHasSubjectIdColumn &&
      schema.hasExamSchedulesTable;

    const canReadStudentNames =
      schema.studentsHasFirstNameColumn && schema.studentsHasLastNameColumn;
    const canReadUserNames =
      schema.studentsHasUserIdColumn &&
      schema.usersHasFirstNameColumn &&
      schema.usersHasLastNameColumn;
    const studentNameSql = canReadStudentNames
      ? `TRIM(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, '')))`
      : canReadUserNames
        ? `TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))`
        : `COALESCE(NULLIF(TRIM(st.roll_number), ''), CONCAT('Student #', st.id::text))`;
    const userJoinSql = canReadUserNames ? 'LEFT JOIN users u ON u.id = st.user_id' : '';

    const selfStudent = await resolveStudentScopeByUser(ctx);
    if (selfStudent) {
      const studentId = parseId(selfStudent.student_id);
      if (!studentId) return success(res, 200, 'Result loaded', []);

      const classIdSelf = parseId(selfStudent.class_id);
      const sectionIdSelf = parseId(selfStudent.section_id);

      if (scheduleBackedExamResults && schema.hasExamSchedulesTable) {
        let selfRows = { rows: [] };
        if (classIdSelf && sectionIdSelf) {
          selfRows = await query(
            `SELECT
               st.id AS student_id,
               (${studentNameSql}) AS student_name,
               csub.subject_id,
               sb.subject_name,
               sb.subject_code,
               er.marks_obtained,
               COALESCE(er.is_absent, false) AS is_absent,
               esch.max_marks,
               esch.passing_marks
             FROM students st
             ${userJoinSql}
             INNER JOIN exam_schedules esch
               ON esch.exam_id = $1 AND esch.class_id = $3
             INNER JOIN class_sections csec
               ON csec.id = esch.class_section_id
              AND csec.class_id = esch.class_id
              AND csec.academic_year_id = esch.academic_year_id
             INNER JOIN class_subjects csub
               ON csub.id = esch.class_subject_id
              AND csub.class_id = esch.class_id
              AND csub.academic_year_id = esch.academic_year_id
             INNER JOIN subjects sb ON sb.id = csub.subject_id
             LEFT JOIN exam_results er
               ON er.exam_schedule_id = esch.id AND er.student_id = st.id
             WHERE st.id = $2
               AND csec.section_id = $4
             ORDER BY sb.subject_name ASC`,
            [examId, studentId, classIdSelf, sectionIdSelf]
          );
        }
        if (!selfRows.rows?.length) {
          selfRows = await query(
            `SELECT
               st.id AS student_id,
               (${studentNameSql}) AS student_name,
               csub.subject_id,
               sb.subject_name,
               sb.subject_code,
               er.marks_obtained,
               COALESCE(er.is_absent, false) AS is_absent,
               esch.max_marks,
               esch.passing_marks
             FROM students st
             ${userJoinSql}
             INNER JOIN exam_results er
               ON er.student_id = st.id
              AND er.exam_schedule_id IS NOT NULL
             INNER JOIN exam_schedules esch
               ON esch.id = er.exam_schedule_id
              AND esch.exam_id = $1
             INNER JOIN class_subjects csub
               ON csub.id = esch.class_subject_id
              AND csub.class_id = esch.class_id
              AND csub.academic_year_id = esch.academic_year_id
             INNER JOIN subjects sb ON sb.id = csub.subject_id
             WHERE st.id = $2
             ORDER BY sb.subject_name ASC`,
            [examId, studentId]
          );
        }
        return success(res, 200, 'Result loaded', selfRows.rows || []);
      }

      if (schema.hasExamSubjectsTable && schema.studentsHasLegacyClassColumns) {
        const rows = await query(
          `SELECT
             st.id AS student_id,
             (${studentNameSql}) AS student_name,
             es.subject_id,
             sb.subject_name,
             sb.subject_code,
             er.marks_obtained,
             COALESCE(er.is_absent, false) AS is_absent,
             es.max_marks,
             es.passing_marks
           FROM students st
           ${userJoinSql}
           INNER JOIN exam_subjects es
             ON es.class_id = st.class_id
            AND es.section_id = st.section_id
            AND es.exam_id = $1
           INNER JOIN subjects sb ON sb.id = es.subject_id
           LEFT JOIN exam_results er
             ON er.exam_id = es.exam_id
            AND er.student_id = st.id
            AND er.subject_id = es.subject_id
           WHERE st.id = $2
           ORDER BY sb.subject_name ASC`,
          [examId, studentId]
        );
        return success(res, 200, 'Result loaded', rows.rows);
      }

      return success(res, 200, 'Result loaded', []);
    }

    if (!classId || !sectionId) {
      return error(res, 400, 'class_id and section_id are required');
    }

    if (isTeacherRole(ctx)) {
      const ok = await teacherCanAccessClassSection(ctx.userId, classId, sectionId);
      if (!ok) return error(res, 403, 'You are not allowed to view this class section result');
    }

    let rows;

    if (scheduleBackedExamResults && schema.hasExamSchedulesTable) {
      const examAyRes = await query(
        `SELECT academic_year_id FROM exams WHERE id = $1 LIMIT 1`,
        [examId]
      );
      const examAy = parseId(examAyRes.rows?.[0]?.academic_year_id);
      const lateralSql =
        schema.hasStudentLifecycleLedger
          ? lateralCurrentEnrollment('st.id', examAy ? { academicYearIdParam: '$4' } : {})
          : '';

      const rosterFilters = schema.hasStudentLifecycleLedger
        ? `WHERE COALESCE(st.is_active, true) = true
             AND enr.class_id = $2
             AND enr.section_id = $3`
        : schema.studentsHasLegacyClassColumns
          ? `WHERE COALESCE(st.is_active, true) = true
               AND st.class_id = $2
               AND st.section_id = $3`
          : `WHERE FALSE`;

      rows = await query(
        `WITH subject_plan AS (
           SELECT DISTINCT
             esch.id AS exam_schedule_id,
             csub.subject_id,
             esch.max_marks,
             esch.passing_marks
           FROM exam_schedules esch
           INNER JOIN class_sections csec
             ON csec.id = esch.class_section_id
            AND csec.class_id = esch.class_id
            AND csec.academic_year_id = esch.academic_year_id
           INNER JOIN class_subjects csub
             ON csub.id = esch.class_subject_id
            AND csub.class_id = esch.class_id
            AND csub.academic_year_id = esch.academic_year_id
           WHERE esch.exam_id = $1
             AND esch.class_id = $2
             AND csec.section_id = $3
         ),
         roster AS (
           SELECT DISTINCT
             st.id AS student_id,
             (${studentNameSql}) AS student_name
           FROM students st
           ${userJoinSql}
           ${lateralSql}
           ${rosterFilters}
         )
         SELECT
           r.student_id,
           r.student_name,
           COUNT(sp.exam_schedule_id) AS planned_subject_count,
           COUNT(er.student_id) AS entered_subject_count,
           CASE
             WHEN COUNT(er.student_id) = 0 THEN NULL
             ELSE COALESCE(SUM(er.marks_obtained), 0)
           END AS total_obtained,
           COALESCE(SUM(sp.max_marks), 0) AS total_max,
           CASE
             WHEN COUNT(er.student_id) = 0 THEN NULL
             WHEN COALESCE(SUM(sp.max_marks), 0) = 0 THEN 0
             ELSE ROUND(
               (COALESCE(SUM(er.marks_obtained), 0) * 100.0) / NULLIF(SUM(sp.max_marks), 0),
               2
             )
           END AS percentage,
           CASE
             WHEN COUNT(er.student_id) = 0 THEN 'PENDING'
             WHEN COUNT(er.student_id) < COUNT(sp.exam_schedule_id) THEN 'PENDING'
             WHEN BOOL_OR(er.student_id IS NULL) THEN 'FAIL'
             WHEN BOOL_OR(COALESCE(er.is_absent, false) = true)
               OR BOOL_OR(COALESCE(er.marks_obtained, 0) < COALESCE(sp.passing_marks, 0))
             THEN 'FAIL'
             ELSE 'PASS'
           END AS result_status
         FROM roster r
         LEFT JOIN subject_plan sp ON TRUE
         LEFT JOIN exam_results er
           ON er.exam_schedule_id = sp.exam_schedule_id
          AND er.student_id = r.student_id
         GROUP BY r.student_id, r.student_name
         ORDER BY r.student_name ASC`,
        examAy ? [examId, classId, sectionId, examAy] : [examId, classId, sectionId]
      );
    } else if (schema.hasExamSubjectsTable && schema.studentsHasLegacyClassColumns) {
      rows = await query(
        `WITH subject_plan AS (
           SELECT subject_id, max_marks, passing_marks
           FROM exam_subjects
           WHERE exam_id = $1 AND class_id = $2 AND section_id = $3
         )
         SELECT
           st.id AS student_id,
           MAX((${studentNameSql})) AS student_name,
           COUNT(sp.subject_id) AS planned_subject_count,
           COUNT(er.student_id) AS entered_subject_count,
           CASE
             WHEN COUNT(er.student_id) = 0 THEN NULL
             ELSE COALESCE(SUM(er.marks_obtained), 0)
           END AS total_obtained,
           COALESCE(SUM(sp.max_marks), 0) AS total_max,
           CASE
             WHEN COUNT(er.student_id) = 0 THEN NULL
             WHEN COALESCE(SUM(sp.max_marks), 0) = 0 THEN 0
             ELSE ROUND((COALESCE(SUM(er.marks_obtained), 0) * 100.0) / NULLIF(SUM(sp.max_marks), 0), 2)
           END AS percentage,
           CASE
             WHEN COUNT(er.student_id) = 0 THEN 'PENDING'
             WHEN COUNT(er.student_id) < COUNT(sp.subject_id) THEN 'PENDING'
             WHEN BOOL_OR(er.student_id IS NULL) THEN 'FAIL'
             WHEN BOOL_OR(COALESCE(er.is_absent, false) = true)
               OR BOOL_OR(COALESCE(er.marks_obtained, 0) < COALESCE(sp.passing_marks, 0))
             THEN 'FAIL'
             ELSE 'PASS'
           END AS result_status
         FROM students st
         ${userJoinSql}
         LEFT JOIN subject_plan sp ON TRUE
         LEFT JOIN exam_results er
           ON er.exam_id = $1
          AND er.student_id = st.id
          AND er.subject_id = sp.subject_id
         WHERE st.class_id = $2 AND st.section_id = $3
         GROUP BY st.id
         ORDER BY MAX((${studentNameSql})) ASC`,
        [examId, classId, sectionId]
      );
    } else {
      rows = { rows: [] };
    }

    const gradeScale = await loadActiveGradeScale();
    const withGrade = (rows.rows || []).map((r) => ({
      ...r,
      grade: r.percentage == null ? null : getGradeFromScale(r.percentage, gradeScale),
    }));
    return success(res, 200, 'Result loaded', withGrade);
  } catch (e) {
    console.error('viewExamResults', e);
    return error(res, 500, 'Failed to load exam result');
  }
}

async function viewExamTopPerformers(req, res) {
  try {
    const ctx = getAuthContext(req);
    const examId = parseId(req.query.exam_id);
    const classId = parseId(req.query.class_id);
    const sectionId = parseId(req.query.section_id);
    const topParam = String(req.query.top || '').trim().toLowerCase();
    const allowedTopValues = new Set(['3', '5', '10', '15', '20', 'all']);
    const safeTop = allowedTopValues.has(topParam) ? topParam : 'all';
    const topLimit = safeTop === 'all' ? null : Number.parseInt(safeTop, 10);

    if (!examId) return error(res, 400, 'exam_id is required');

    const examRes = await query(
      `SELECT id, exam_name, exam_type
       FROM exams
       WHERE id = $1
       LIMIT 1`,
      [examId]
    );
    if (!examRes.rows.length) return error(res, 404, 'Exam not found');

    const schema = await getExamSchemaFlags();
    const scheduleBackedTop =
      schema.examResultsHasExamScheduleIdColumn &&
      !schema.examResultsHasSubjectIdColumn &&
      schema.hasExamSchedulesTable;

    const canReadStudentNamesTp =
      schema.studentsHasFirstNameColumn && schema.studentsHasLastNameColumn;
    const canReadUserNamesTp =
      schema.studentsHasUserIdColumn &&
      schema.usersHasFirstNameColumn &&
      schema.usersHasLastNameColumn;
    const studNameExprTp = canReadStudentNamesTp
      ? `TRIM(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, '')))`
      : canReadUserNamesTp
        ? `TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))`
        : `COALESCE(NULLIF(TRIM(st.roll_number), ''), CONCAT('Student #', st.id::text))`;
    const studPhotoExprTp =
      schema.studentsHasPhotoUrlColumn &&
      schema.usersHasAvatarColumn &&
      schema.studentsHasUserIdColumn
        ? `COALESCE(st.photo_url, u.avatar)`
        : schema.studentsHasPhotoUrlColumn
          ? `st.photo_url`
          : schema.usersHasAvatarColumn && schema.studentsHasUserIdColumn
            ? `u.avatar`
            : `NULL::text`;
    const studUserJoinTp =
      schema.studentsHasUserIdColumn && (canReadUserNamesTp || schema.usersHasAvatarColumn)
        ? 'LEFT JOIN users u ON u.id = st.user_id'
        : '';

    let allowedScopes = [];
    if (isAdmin(ctx)) {
      let scopeRes;
      if (schema.hasExamSubjectsTable) {
        scopeRes = await query(
          `SELECT DISTINCT class_id, section_id
           FROM exam_subjects
           WHERE exam_id = $1
             AND class_id IS NOT NULL
             AND section_id IS NOT NULL`,
          [examId]
        );
      } else if (scheduleBackedTop) {
        scopeRes = await query(
          `SELECT DISTINCT esch.class_id, csec.section_id
           FROM exam_schedules esch
           INNER JOIN class_sections csec
             ON csec.id = esch.class_section_id
            AND csec.class_id = esch.class_id
            AND csec.academic_year_id = esch.academic_year_id
           WHERE esch.exam_id = $1
             AND esch.class_section_id IS NOT NULL`,
          [examId]
        );
      } else {
        scopeRes = { rows: [] };
      }
      allowedScopes = (scopeRes.rows || []).map((r) => ({
        class_id: parseId(r.class_id),
        section_id: parseId(r.section_id),
      })).filter((r) => r.class_id && r.section_id);
    } else if (isTeacherRole(ctx)) {
      const { teacherIds, staffIds } = await getTeacherMaps(ctx.userId);
      if (!teacherIds.length && !staffIds.length) {
        return success(res, 200, 'Top performers loaded', {
          exam: examRes.rows[0],
          rows: [],
          scope: { class_id: classId || null, section_id: sectionId || null },
        });
      }
      let scopeRes;
      if (schema.hasExamSubjectsTable) {
        const accessOr = buildTeacherClassAccessOrSql(
          schema,
          'es.class_id',
          2,
          3,
          '(SELECT ex.academic_year_id FROM exams ex WHERE ex.id = es.exam_id)'
        );
        scopeRes = await query(
          `SELECT DISTINCT es.class_id, es.section_id
           FROM exam_subjects es
           WHERE es.exam_id = $1
             AND es.class_id IS NOT NULL
             AND es.section_id IS NOT NULL
             AND (${accessOr})`,
          [examId, staffIds, teacherIds]
        );
      } else if (scheduleBackedTop) {
        const accessOr = buildTeacherClassAccessOrSql(
          schema,
          'esch.class_id',
          2,
          3,
          '(SELECT ex.academic_year_id FROM exams ex WHERE ex.id = esch.exam_id)'
        );
        scopeRes = await query(
          `SELECT DISTINCT esch.class_id, csec.section_id
           FROM exam_schedules esch
           INNER JOIN class_sections csec
             ON csec.id = esch.class_section_id
            AND csec.class_id = esch.class_id
            AND csec.academic_year_id = esch.academic_year_id
           WHERE esch.exam_id = $1
             AND esch.class_section_id IS NOT NULL
             AND (${accessOr})`,
          [examId, staffIds, teacherIds]
        );
      } else {
        scopeRes = { rows: [] };
      }
      allowedScopes = (scopeRes.rows || []).map((r) => ({
        class_id: parseId(r.class_id),
        section_id: parseId(r.section_id),
      })).filter((r) => r.class_id && r.section_id);
    } else {
      const selfStudent = await resolveStudentScopeByUser(ctx);
      if (!selfStudent?.class_id || !selfStudent?.section_id) {
        return success(res, 200, 'Top performers loaded', {
          exam: examRes.rows[0],
          rows: [],
          scope: { class_id: classId || null, section_id: sectionId || null },
        });
      }
      allowedScopes = [{
        class_id: parseId(selfStudent.class_id),
        section_id: parseId(selfStudent.section_id),
      }].filter((r) => r.class_id && r.section_id);
    }

    if (classId) {
      allowedScopes = allowedScopes.filter((s) => s.class_id === classId);
    }
    if (sectionId) {
      allowedScopes = allowedScopes.filter((s) => s.section_id === sectionId);
    }
    if (!allowedScopes.length) {
      return success(res, 200, 'Top performers loaded', {
        exam: examRes.rows[0],
        rows: [],
        scope: { class_id: classId || null, section_id: sectionId || null },
      });
    }

    const scopeValuesSql = [];
    const scopeParams = [];
    allowedScopes.forEach((scope, idx) => {
      scopeParams.push(scope.class_id, scope.section_id);
      // Explicit integer columns: untyped VALUES + params can infer as text and break joins (text = int).
      scopeValuesSql.push(`($${idx * 2 + 1}::integer, $${idx * 2 + 2}::integer)`);
    });
    const examParamIdx = scopeParams.length + 1;

    const canRosterTop =
      scheduleBackedTop &&
      (schema.hasStudentLifecycleLedger || schema.studentsHasLegacyClassColumns);

    let rowsRes;
    if (canRosterTop) {
      const rosterSpJoin = schema.hasStudentLifecycleLedger
        ? `${lateralCurrentEnrollment('st.id')}
         INNER JOIN allowed_scopes a
           ON a.class_id::integer = enr.class_id::integer
          AND a.section_id::integer = enr.section_id::integer
         INNER JOIN subject_plan sp
           ON sp.class_id::integer = enr.class_id::integer
          AND sp.section_id::integer = enr.section_id::integer`
        : `INNER JOIN allowed_scopes a
           ON a.class_id::integer = st.class_id::integer
          AND a.section_id::integer = st.section_id::integer
         INNER JOIN subject_plan sp
           ON sp.class_id::integer = st.class_id::integer
          AND sp.section_id::integer = st.section_id::integer`;
      const classCol = schema.hasStudentLifecycleLedger ? 'enr.class_id' : 'st.class_id';
      const sectionCol = schema.hasStudentLifecycleLedger ? 'enr.section_id' : 'st.section_id';

      rowsRes = await query(
        `WITH allowed_scopes(class_id, section_id) AS (
           VALUES ${scopeValuesSql.join(', ')}
         ),
         subject_plan AS (
           SELECT esch.class_id,
                  csec.section_id,
                  csub.subject_id,
                  esch.id AS exam_schedule_id,
                  COALESCE(esch.max_marks, 100) AS max_marks,
                  COALESCE(esch.passing_marks, 35) AS passing_marks
           FROM exam_schedules esch
           INNER JOIN class_sections csec
             ON csec.id = esch.class_section_id
            AND csec.class_id = esch.class_id
            AND csec.academic_year_id = esch.academic_year_id
           INNER JOIN class_subjects csub
             ON csub.id = esch.class_subject_id
            AND csub.class_id = esch.class_id
            AND csub.academic_year_id = esch.academic_year_id
           INNER JOIN allowed_scopes a
             ON a.class_id::integer = esch.class_id::integer
            AND a.section_id::integer = csec.section_id::integer
           WHERE esch.exam_id = $${examParamIdx}
         ),
         scored AS (
           SELECT
             st.id AS student_id,
             MAX(${studNameExprTp}) AS student_name,
             MAX(${studPhotoExprTp}) AS photo_url,
             MAX(${classCol})::int AS class_id,
             MAX(${sectionCol})::int AS section_id,
             COUNT(sp.exam_schedule_id)::int AS planned_subject_count,
             COUNT(er.student_id)::int AS entered_subject_count,
             COALESCE(SUM(CASE WHEN COALESCE(er.is_absent, false) THEN 0 ELSE COALESCE(er.marks_obtained, 0) END), 0)::numeric AS total_obtained,
             COALESCE(SUM(sp.max_marks), 0)::numeric AS total_max,
             BOOL_OR(COALESCE(er.is_absent, false) = true) AS has_absent,
             BOOL_OR(
               er.student_id IS NOT NULL
               AND COALESCE(er.is_absent, false) = false
               AND COALESCE(er.marks_obtained, 0) < COALESCE(sp.passing_marks, 0)
             ) AS has_fail_subject
           FROM students st
           ${studUserJoinTp}
           ${rosterSpJoin}
           LEFT JOIN exam_results er
             ON er.exam_schedule_id = sp.exam_schedule_id
            AND er.student_id = st.id
           WHERE COALESCE(st.is_active, true) = true
           GROUP BY st.id
         )
         SELECT
           s.student_id,
           s.student_name,
           s.photo_url,
           s.class_id,
           c.class_name,
           s.section_id,
           sec.section_name,
           s.total_obtained,
           s.total_max,
           CASE
             WHEN s.entered_subject_count = 0 THEN NULL
             WHEN s.total_max = 0 THEN 0
             ELSE ROUND((s.total_obtained * 100.0) / NULLIF(s.total_max, 0), 2)
           END AS percentage,
           CASE
             WHEN s.entered_subject_count = 0 THEN 'PENDING'
             WHEN s.entered_subject_count < s.planned_subject_count THEN 'PENDING'
             WHEN s.has_absent OR s.has_fail_subject THEN 'FAIL'
             ELSE 'PASS'
           END AS result_status
         FROM scored s
         LEFT JOIN classes c ON c.id = s.class_id
         LEFT JOIN sections sec ON sec.id = s.section_id
         ORDER BY percentage DESC NULLS LAST, total_obtained DESC, student_name ASC
         ${topLimit ? `LIMIT ${topLimit}` : ''}`,
        [...scopeParams, examId]
      );
    } else if (schema.hasExamSubjectsTable && schema.studentsHasLegacyClassColumns) {
      rowsRes = await query(
        `WITH allowed_scopes(class_id, section_id) AS (
           VALUES ${scopeValuesSql.join(', ')}
         ),
         subject_plan AS (
           SELECT es.class_id, es.section_id, es.subject_id,
                  COALESCE(es.max_marks, 100) AS max_marks,
                  COALESCE(es.passing_marks, 35) AS passing_marks
           FROM exam_subjects es
           INNER JOIN allowed_scopes a
             ON a.class_id::text = es.class_id::text
            AND a.section_id::text = es.section_id::text
           WHERE es.exam_id = $${examParamIdx}
         ),
         scored AS (
           SELECT
             st.id AS student_id,
             st.first_name,
             st.last_name,
             MAX(${studPhotoExprTp}) AS photo_url,
             st.class_id,
             st.section_id,
             COUNT(sp.subject_id)::int AS planned_subject_count,
             COUNT(er.student_id)::int AS entered_subject_count,
             COALESCE(SUM(CASE WHEN COALESCE(er.is_absent, false) THEN 0 ELSE COALESCE(er.marks_obtained, 0) END), 0)::numeric AS total_obtained,
             COALESCE(SUM(sp.max_marks), 0)::numeric AS total_max,
             BOOL_OR(COALESCE(er.is_absent, false) = true) AS has_absent,
             BOOL_OR(
               er.student_id IS NOT NULL
               AND COALESCE(er.is_absent, false) = false
               AND COALESCE(er.marks_obtained, 0) < COALESCE(sp.passing_marks, 0)
             ) AS has_fail_subject
           FROM students st
           ${studUserJoinTp}
           INNER JOIN allowed_scopes a
             ON a.class_id::text = st.class_id::text
            AND a.section_id::text = st.section_id::text
           INNER JOIN subject_plan sp
             ON sp.class_id::text = st.class_id::text
            AND sp.section_id::text = st.section_id::text
           LEFT JOIN exam_results er
             ON er.exam_id = $${examParamIdx}
            AND er.student_id = st.id
            AND er.subject_id = sp.subject_id
           WHERE st.status = 'Active'
           GROUP BY st.id, st.first_name, st.last_name, st.class_id, st.section_id
         )
         SELECT
           s.student_id,
           CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, '')) AS student_name,
           s.photo_url,
           s.class_id,
           c.class_name,
           s.section_id,
           sec.section_name,
           s.total_obtained,
           s.total_max,
           CASE
             WHEN s.entered_subject_count = 0 THEN NULL
             WHEN s.total_max = 0 THEN 0
             ELSE ROUND((s.total_obtained * 100.0) / NULLIF(s.total_max, 0), 2)
           END AS percentage,
           CASE
             WHEN s.entered_subject_count = 0 THEN 'PENDING'
             WHEN s.entered_subject_count < s.planned_subject_count THEN 'PENDING'
             WHEN s.has_absent OR s.has_fail_subject THEN 'FAIL'
             ELSE 'PASS'
           END AS result_status
         FROM scored s
         LEFT JOIN classes c ON c.id = s.class_id
         LEFT JOIN sections sec ON sec.id = s.section_id
         ORDER BY percentage DESC NULLS LAST, total_obtained DESC, student_name ASC
         ${topLimit ? `LIMIT ${topLimit}` : ''}`,
        [...scopeParams, examId]
      );
    } else {
      rowsRes = { rows: [] };
    }

    const gradeScale = await loadActiveGradeScale();
    const withRank = (rowsRes.rows || []).map((r, idx) => ({
      rank: idx + 1,
      student_id: parseId(r.student_id),
      student_name: String(r.student_name || '').trim() || 'N/A',
      photo_url: r.photo_url || null,
      class_id: parseId(r.class_id),
      class_name: r.class_name || null,
      section_id: parseId(r.section_id),
      section_name: r.section_name || null,
      total_obtained: r.total_obtained != null ? Number(r.total_obtained) : 0,
      total_max: r.total_max != null ? Number(r.total_max) : 0,
      percentage: r.percentage != null ? Number(r.percentage) : null,
      grade: r.percentage == null ? null : getGradeFromScale(r.percentage, gradeScale),
      result_status: r.result_status || 'PENDING',
    }));

    return success(res, 200, 'Top performers loaded', {
      exam: examRes.rows[0],
      rows: withRank,
      scope: { class_id: classId || null, section_id: sectionId || null },
      top: safeTop,
    });
  } catch (e) {
    console.error('viewExamTopPerformers', e);
    return error(res, 500, 'Failed to load top performers');
  }
}

async function distinctExamsForClassSection(schemaSnap, classId, sectionId, academicYearId) {
  const cid = parseId(classId);
  if (!cid) return [];
  const sid = parseId(sectionId);
  const ay = parseId(academicYearId);

  const distinctFromExamSubjects = async () => {
    if (!schemaSnap.hasExamSubjectsTable) return [];
    const run = async (withYear) => {
      const params = [cid];
      let w = 'WHERE es.class_id = $1';
      if (sid) {
        params.push(sid);
        w += ` AND es.section_id = $${params.length}`;
      }
      if (withYear && ay) {
        params.push(ay);
        w += ` AND e.academic_year_id = $${params.length}`;
      }
      const r = await query(
        `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
         FROM exam_subjects es
         INNER JOIN exams e ON e.id = es.exam_id
         ${w}
         ORDER BY e.id DESC`,
        params
      );
      return r.rows || [];
    };
    let rows = await run(true);
    if (rows.length || !ay) return rows;
    return run(false);
  };

  const distinctFromExamSchedules = async () => {
    if (!schemaSnap.hasExamSchedulesTable) return [];
    const run = async (withYear) => {
      const params = [cid];
      let fromClause = `
        FROM exam_schedules esch
        INNER JOIN exams e ON e.id = esch.exam_id`;
      let w =
        `WHERE esch.class_id = $1
           AND esch.class_section_id IS NOT NULL`;
      if (sid) {
        params.push(sid);
        fromClause += `
        INNER JOIN class_sections csec
          ON csec.id = esch.class_section_id
         AND csec.class_id = esch.class_id
         AND csec.academic_year_id = esch.academic_year_id`;
        w += ` AND csec.section_id = $${params.length}`;
      }
      if (withYear && ay) {
        params.push(ay);
        w += ` AND e.academic_year_id = $${params.length}`;
      }
      const r = await query(
        `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
         ${fromClause}
         ${w}
         ORDER BY e.id DESC`,
        params
      );
      return r.rows || [];
    };
    let rows = await run(true);
    if (rows.length || !ay) return rows;
    return run(false);
  };

  // Some tenants have BOTH tables but only store timetable rows in exam_schedules (exam_subjects empty).
  const fromSubjects = await distinctFromExamSubjects();
  if (fromSubjects.length) return fromSubjects;

  return distinctFromExamSchedules();
}

/** Union exam rows by id (keeps first occurrence order: timetable list, then marks-only). */
function mergeSelfExamOptionRows(a, b) {
  const out = [];
  const seen = new Set();
  for (const row of [...(a || []), ...(b || [])]) {
    const id = parseId(row?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

/**
 * Last-resort discovery: same join shape as getStudentExamResults schedule fallback.
 * Runs even when schema flags are wrong/missing so self-exams stays aligned with student exam-results.
 */
async function probeDistinctExamsViaResultScheduleJoin(studentId, academicYearId) {
  const sid = parseId(studentId);
  if (!sid) return [];
  const ay = parseId(academicYearId);
  const run = async (withYear) => {
    const params = [sid];
    let yw = '';
    if (withYear && ay) {
      params.push(ay);
      yw = ` AND e.academic_year_id = $2`;
    }
    const r = await query(
      `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
       FROM exam_results er
       INNER JOIN exam_schedules es ON es.id = er.exam_schedule_id
       INNER JOIN exams e ON e.id = es.exam_id
       WHERE er.student_id = $1${yw}
       ORDER BY e.id DESC`,
      params
    );
    return r.rows || [];
  };
  try {
    let rows = await run(true);
    if (!rows.length && ay) rows = await run(false);
    return rows;
  } catch {
    return [];
  }
}

async function probeDistinctExamsViaResultExamIdJoin(studentId, academicYearId) {
  const sid = parseId(studentId);
  if (!sid) return [];
  const ay = parseId(academicYearId);
  const run = async (withYear) => {
    const params = [sid];
    let yw = '';
    if (withYear && ay) {
      params.push(ay);
      yw = ` AND e.academic_year_id = $2`;
    }
    const r = await query(
      `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
       FROM exam_results er
       INNER JOIN exams e ON e.id = er.exam_id
       WHERE er.student_id = $1 AND er.exam_id IS NOT NULL${yw}
       ORDER BY e.id DESC`,
      params
    );
    return r.rows || [];
  };
  try {
    let rows = await run(true);
    if (!rows.length && ay) rows = await run(false);
    return rows;
  } catch {
    return [];
  }
}

async function loadSelfExamsFromExamResults(schemaSnap, studentId, academicYearId) {
  const sid = parseId(studentId);
  if (!sid) return [];
  const ay = parseId(academicYearId);

  const runFromErExamId = async (withYear) => {
    if (!schemaSnap.examResultsHasExamIdColumn) return [];
    const params = [sid];
    let w = 'WHERE er.student_id = $1 AND er.exam_id IS NOT NULL';
    if (withYear && ay) {
      params.push(ay);
      w += ` AND e.academic_year_id = $2`;
    }
    const r = await query(
      `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
       FROM exam_results er
       INNER JOIN exams e ON e.id = er.exam_id
       ${w}
       ORDER BY e.id DESC`,
      params
    ).catch(() => ({ rows: [] }));
    return r.rows || [];
  };

  /** Matches getStudentExamResults fallback: marks keyed by exam_schedule_id may have no er.exam_id. */
  const runFromErSchedule = async (withYear) => {
    if (!schemaSnap.examResultsHasExamScheduleIdColumn || !schemaSnap.hasExamSchedulesTable) return [];
    const params = [sid];
    let w = 'WHERE er.student_id = $1 AND er.exam_schedule_id IS NOT NULL';
    if (withYear && ay) {
      params.push(ay);
      w += ` AND e.academic_year_id = $2`;
    }
    const r = await query(
      `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
       FROM exam_results er
       INNER JOIN exam_schedules es ON es.id = er.exam_schedule_id
       INNER JOIN exams e ON e.id = es.exam_id
       ${w}
       ORDER BY e.id DESC`,
      params
    ).catch(() => ({ rows: [] }));
    return r.rows || [];
  };

  let rows = await runFromErExamId(true);
  if (!rows.length && ay) rows = await runFromErExamId(false);
  if (rows.length) return rows;

  rows = await runFromErSchedule(true);
  if (!rows.length && ay) rows = await runFromErSchedule(false);
  if (rows.length) return rows;

  const probeSched = await probeDistinctExamsViaResultScheduleJoin(sid, academicYearId);
  if (probeSched.length) return probeSched;
  return probeDistinctExamsViaResultExamIdJoin(sid, academicYearId);
}

async function listSelfExamOptions(req, res) {
  try {
    const ctx = getAuthContext(req);
    const selfStudent = await resolveStudentScopeByUser(ctx);
    if (!selfStudent) return success(res, 200, 'Self exams loaded', []);

    const schemaList = await getExamSchemaFlags();
    const enrOnly = await fetchEnrollmentOnlyScopeByStudentId(schemaList, selfStudent.student_id);
    const classId = parseId(enrOnly?.class_id) || parseId(selfStudent.class_id);
    const sectionId = parseId(enrOnly?.section_id) || parseId(selfStudent.section_id);
    if (!classId) {
      let academicYearIdNoClass = req.query.academic_year_id ? parseId(req.query.academic_year_id) : null;
      if (academicYearIdNoClass == null) {
        academicYearIdNoClass =
          parseId(enrOnly?.academic_year_id) ?? parseId(selfStudent.academic_year_id);
      }
      const fromMarksOnly = await loadSelfExamsFromExamResults(
        schemaList,
        selfStudent.student_id,
        academicYearIdNoClass
      );
      return success(res, 200, 'Self exams loaded', fromMarksOnly);
    }

    let academicYearId = req.query.academic_year_id ? parseId(req.query.academic_year_id) : null;
    if (academicYearId == null) {
      academicYearId = parseId(enrOnly?.academic_year_id) ?? parseId(selfStudent.academic_year_id);
    }

    const fromMarks = await loadSelfExamsFromExamResults(
      schemaList,
      selfStudent.student_id,
      academicYearId
    );

    const primary = await distinctExamsForClassSection(schemaList, classId, sectionId, academicYearId);
    const mergedPrimary = mergeSelfExamOptionRows(primary, fromMarks);
    if (mergedPrimary.length > 0) {
      return success(res, 200, 'Self exams loaded', mergedPrimary);
    }

    if (parseId(selfStudent.student_id) && schemaList.hasStudentPromotionsTable) {
      const promotedScope = await query(
        `SELECT to_class_id AS class_id, to_section_id AS section_id
         FROM student_promotions
         WHERE student_id = $1
           AND to_class_id IS NOT NULL
           AND to_section_id IS NOT NULL
         ORDER BY id DESC
         LIMIT 1`,
        [selfStudent.student_id]
      ).catch(() => ({ rows: [] }));
      const promotedClassId = parseId(promotedScope.rows?.[0]?.class_id);
      const promotedSectionId = parseId(promotedScope.rows?.[0]?.section_id);
      if (
        promotedClassId &&
        promotedSectionId &&
        (promotedClassId !== classId || promotedSectionId !== sectionId)
      ) {
        const promotedRows = await distinctExamsForClassSection(
          schemaList,
          promotedClassId,
          promotedSectionId,
          academicYearId
        );
        if (promotedRows.length > 0) {
          return success(
            res,
            200,
            'Self exams loaded',
            mergeSelfExamOptionRows(promotedRows, fromMarks)
          );
        }
      }
    }

    const params = [classId];
    let yearWhere = '';
    if (academicYearId) {
      params.push(academicYearId);
      yearWhere = ` AND e.academic_year_id = $${params.length}`;
    }

    const runWithOptionalYear = async (sqlFactory) => {
      const withYearRows = await query(sqlFactory(yearWhere), params);
      if ((withYearRows.rows || []).length > 0 || !academicYearId) return withYearRows.rows || [];
      const paramsNoYear = [classId];
      const noYearRows = await query(sqlFactory(''), paramsNoYear);
      return noYearRows.rows || [];
    };

    if (schemaList.hasExamClassesTable) {
      const fromExamClasses = await runWithOptionalYear(
        (yw) => `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
         FROM exams e
         INNER JOIN exam_classes ec ON ec.exam_id = e.id
         WHERE ec.class_id = $1${yw}
         ORDER BY e.id DESC`
      );
      if (fromExamClasses.length > 0) {
        return success(
          res,
          200,
          'Self exams loaded',
          mergeSelfExamOptionRows(fromExamClasses, fromMarks)
        );
      }
    }
    if (schemaList.hasExamSchedulesTable) {
      const fromSchedules = await runWithOptionalYear(
        (yw) => `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
         FROM exams e
         INNER JOIN exam_schedules esch ON esch.exam_id = e.id
         WHERE esch.class_id = $1${yw}
         ORDER BY e.id DESC`
      );
      if (fromSchedules.length > 0) {
        return success(
          res,
          200,
          'Self exams loaded',
          mergeSelfExamOptionRows(fromSchedules, fromMarks)
        );
      }
    }
    if (schemaList.hasClassIdColumn) {
      const fromExamClassColumn = await runWithOptionalYear(
        (yw) => `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
         FROM exams e
         WHERE e.class_id = $1${yw}
         ORDER BY e.id DESC`
      );
      const mergedClassCol = mergeSelfExamOptionRows(fromExamClassColumn, fromMarks);
      if (mergedClassCol.length > 0) {
        return success(res, 200, 'Self exams loaded', mergedClassCol);
      }
    }

    return success(res, 200, 'Self exams loaded', fromMarks);
  } catch (e) {
    console.error('listSelfExamOptions', e);
    return error(res, 500, 'Failed to load self exams');
  }
}

/**
 * Persist exam timetable rows. Legacy DBs use exam_subjects (subject_id); tenant schema uses exam_schedules
 * keyed by class_subjects.id and class_sections.id for the exam academic year.
 */
async function persistExamTimetable(client, {
  schema,
  examSubjectsSchema,
  req,
  examId,
  classId,
  sectionId,
  rows,
}) {
  const eid = parseId(examId);
  const cid = parseId(classId);
  const sid = parseId(sectionId);
  const uid = parseId(req.user?.id);

  if (schema.hasExamSubjectsTable) {
    await client.query(
      `DELETE FROM exam_subjects WHERE exam_id = $1 AND class_id = $2 AND section_id = $3`,
      [eid, cid, sid]
    );
    for (const row of rows) {
      if (examSubjectsSchema.hasLegacyComponentUnique) {
        await client.query(
          `INSERT INTO exam_subjects
           (exam_id, class_id, section_id, subject_id, exam_component, max_marks, passing_marks, exam_date, start_time, end_time, created_by)
           VALUES ($1,$2,$3,$4,'theory',$5,$6,$7,$8,$9,$10)
           ON CONFLICT (exam_id, subject_id, exam_component)
           DO UPDATE SET
             class_id = EXCLUDED.class_id,
             section_id = EXCLUDED.section_id,
             max_marks = EXCLUDED.max_marks,
             passing_marks = EXCLUDED.passing_marks,
             exam_date = EXCLUDED.exam_date,
             start_time = EXCLUDED.start_time,
             end_time = EXCLUDED.end_time,
             updated_at = NOW()`,
          [
            eid,
            cid,
            sid,
            row.subject_id,
            row.max_marks,
            row.passing_marks,
            row.exam_date || null,
            row.start_time || null,
            row.end_time || null,
            uid ?? null,
          ]
        );
      } else {
        await client.query(
          `INSERT INTO exam_subjects
           (exam_id, class_id, section_id, subject_id, max_marks, passing_marks, exam_date, start_time, end_time, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (exam_id, class_id, section_id, subject_id)
           DO UPDATE SET
             max_marks = EXCLUDED.max_marks,
             passing_marks = EXCLUDED.passing_marks,
             exam_date = EXCLUDED.exam_date,
             start_time = EXCLUDED.start_time,
             end_time = EXCLUDED.end_time,
             updated_at = NOW()`,
          [
            eid,
            cid,
            sid,
            row.subject_id,
            row.max_marks,
            row.passing_marks,
            row.exam_date || null,
            row.start_time || null,
            row.end_time || null,
            uid ?? null,
          ]
        );
      }
    }
    return;
  }

  if (!schema.hasExamSchedulesTable) {
    const err = new Error('Exam timetable tables are not available for this tenant.');
    err.statusCode = 503;
    throw err;
  }

  const examRes = await client.query(
    `SELECT academic_year_id FROM exams WHERE id = $1 LIMIT 1`,
    [eid]
  );
  const academicYearId = parseId(examRes.rows?.[0]?.academic_year_id);
  if (!academicYearId) {
    const err = new Error('Exam is missing academic year.');
    err.statusCode = 400;
    throw err;
  }

  const csecRes = await client.query(
    `SELECT id FROM class_sections
     WHERE class_id = $1 AND section_id = $2 AND academic_year_id = $3 AND deleted_at IS NULL
     LIMIT 1`,
    [cid, sid, academicYearId]
  );
  const classSectionAnchorId = parseId(csecRes.rows?.[0]?.id);
  if (!classSectionAnchorId) {
    const err = new Error('Class-section is not set up for this academic year.');
    err.statusCode = 400;
    throw err;
  }

  const mapRes = await client.query(
    `SELECT id AS class_subject_id, subject_id
     FROM class_subjects
     WHERE class_id = $1 AND academic_year_id = $2 AND deleted_at IS NULL`,
    [cid, academicYearId]
  );
  const subjectToClassSubjectId = new Map(
    (mapRes.rows || []).map((r) => [parseId(r.subject_id), parseId(r.class_subject_id)])
  );

  for (const row of rows) {
    const subId = parseId(row.subject_id);
    const csId = subjectToClassSubjectId.get(subId);
    if (!subId || !csId) {
      const err = new Error('Subject is not linked to this class for the exam academic year.');
      err.statusCode = 400;
      throw err;
    }
  }

  await client.query(
    `DELETE FROM exam_schedules WHERE exam_id = $1 AND class_id = $2 AND class_section_id = $3`,
    [eid, cid, classSectionAnchorId]
  );

  for (const row of rows) {
    const csId = subjectToClassSubjectId.get(parseId(row.subject_id));
    await client.query(
      `INSERT INTO exam_schedules
       (exam_id, academic_year_id, class_id, class_section_id, class_subject_id, exam_date, start_time, end_time, max_marks, passing_marks, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        eid,
        academicYearId,
        cid,
        classSectionAnchorId,
        csId,
        row.exam_date || null,
        row.start_time || null,
        row.end_time || null,
        row.max_marks,
        row.passing_marks,
        uid ?? null,
        uid ?? null,
      ]
    );
  }
}

async function saveExamSubjectSetup(req, res) {
  try {
    const { error: vErr, value } = saveSubjectSetupSchema.validate(req.body, { stripUnknown: true });
    if (vErr) return error(res, 400, vErr.details[0].message);

    const ctx = getAuthContext(req);
    if (isTeacherRole(ctx)) {
      const ok = await teacherCanAccessClassSection(ctx.userId, value.class_id, value.section_id);
      if (!ok) return error(res, 403, 'You are not allowed to edit this class section');
    }

    const schemaForSetup = await getExamSchemaFlags();
    const secOk = await validateSectionBelongsToClass(
      schemaForSetup,
      value.section_id,
      value.class_id,
      value.exam_id
    );
    if (!secOk) return error(res, 400, 'Invalid class and section combination');
    await assertExamClassLinked(value.exam_id, value.class_id);
    await assertExamNotFinalized(value.exam_id);

    const classSubjects = await getClassSubjects(value.class_id, value.exam_id, schemaForSetup);
    if (!classSubjects.length) return error(res, 400, 'No active subjects found for selected class');
    const expectedSet = new Set(classSubjects.map((s) => parseId(s.id)));
    const incomingSet = new Set(value.rows.map((r) => parseId(r.subject_id)));

    if (incomingSet.size !== expectedSet.size) {
      return error(res, 400, 'All class subjects must be present exactly once');
    }
    for (const sid of expectedSet) {
      if (!incomingSet.has(sid)) return error(res, 400, 'Missing subject rows in timetable payload');
    }
    for (const sid of incomingSet) {
      if (!expectedSet.has(sid)) return error(res, 400, 'Payload contains subject not assigned to this class');
    }

    for (const row of value.rows) {
      if (Number(row.passing_marks) > Number(row.max_marks)) {
        return error(res, 400, 'Passing marks cannot exceed max marks');
      }
    }
    const slotErr = validateNoExamSlotCollision(value.rows);
    if (slotErr) return error(res, 400, slotErr);
    const examSubjectsSchema = await getExamSubjectsSchemaFlags();

    await executeTransaction(async (client) => {
      await persistExamTimetable(client, {
        schema: schemaForSetup,
        examSubjectsSchema,
        req,
        examId: value.exam_id,
        classId: value.class_id,
        sectionId: value.section_id,
        rows: value.rows,
      });
    });

    return success(res, 200, 'Timetable saved');
  } catch (e) {
    console.error('saveExamSubjectSetup', e);
    if (e?.statusCode) return error(res, e.statusCode, e.message);
    if (e?.code === '23505') {
      return error(
        res,
        409,
        'Timetable conflict detected. Please ensure database migration is updated and no duplicate subject slot exists for this exam.'
      );
    }
    return error(res, 500, 'Failed to save timetable');
  }
}

async function saveExamSubjects(req, res) {
  try {
    const { error: vErr, value } = saveSubjectsSchema.validate(req.body, { stripUnknown: true });
    if (vErr) return error(res, 400, vErr.details[0].message);

    const ctx = getAuthContext(req);
    const ok = await teacherCanAccessClassSection(ctx.userId, value.class_id, value.section_id);
    if (!ok) return error(res, 403, 'You are not allowed to edit this class section timetable');

    const dedup = new Set();
    for (const row of value.subjects) {
      const k = `${row.subject_id}`;
      if (dedup.has(k)) return error(res, 400, 'Duplicate subject in timetable payload');
      dedup.add(k);
      if (Number(row.passing_marks) > Number(row.max_marks)) return error(res, 400, 'Passing marks cannot exceed max marks');
    }
    const slotErr = validateNoExamSlotCollision(value.subjects);
    if (slotErr) return error(res, 400, slotErr);
    await assertExamClassLinked(value.exam_id, value.class_id);
    await assertExamNotFinalized(value.exam_id);
    const schemaSave = await getExamSchemaFlags();
    const examSubjectsSchema = await getExamSubjectsSchemaFlags();

    await executeTransaction(async (client) => {
      await persistExamTimetable(client, {
        schema: schemaSave,
        examSubjectsSchema,
        req,
        examId: value.exam_id,
        classId: value.class_id,
        sectionId: value.section_id,
        rows: value.subjects,
      });
    });

    return success(res, 200, 'Timetable saved');
  } catch (e) {
    console.error('saveExamSubjects', e);
    if (e?.statusCode) return error(res, e.statusCode, e.message);
    if (e?.code === '23505') {
      return error(
        res,
        409,
        'Timetable conflict detected. Please ensure database migration is updated and no duplicate subject slot exists for this exam.'
      );
    }
    return error(res, 500, 'Failed to save timetable');
  }
}

/**
 * Students in the selected class-section for exam marks.
 * Canonical tenants use student_lifecycle_ledger (via lateralCurrentEnrollment);
 * legacy DBs filter on students.class_id + students.section_id.
 */
async function fetchStudentsForExamMarksRoster(schema, opts) {
  const { examId, classId, sectionId, studentNameSql, studentNameOrderSql, userJoinSql, idsOnly } = opts;
  const cid = parseId(classId);
  const sid = parseId(sectionId);
  const eid = parseId(examId);

  const joinUsers = userJoinSql || '';
  const selectList = idsOnly
    ? 'st.id AS student_id'
    : `st.id AS student_id,
       ${studentNameSql} AS student_name,
       st.roll_number`;
  const orderBy = idsOnly ? 'st.id' : studentNameOrderSql;

  if (schema.hasStudentLifecycleLedger) {
    const examRes = await query(
      `SELECT academic_year_id FROM exams WHERE id = $1 LIMIT 1`,
      [eid]
    );
    const ay = parseId(examRes.rows?.[0]?.academic_year_id);
    const lateralSql = lateralCurrentEnrollment('st.id', ay ? { academicYearIdParam: '$3' } : {});
    const params = ay ? [cid, sid, ay] : [cid, sid];
    return query(
      `SELECT ${selectList}
       FROM students st
       ${joinUsers}
       ${lateralSql}
       WHERE COALESCE(st.is_active, true) = true
         AND enr.class_id = $1
         AND enr.section_id = $2
       ORDER BY ${orderBy}`,
      params
    );
  }

  if (schema.studentsHasLegacyClassColumns) {
    return query(
      `SELECT ${selectList}
       FROM students st
       ${joinUsers}
       WHERE st.class_id = $1
         AND st.section_id = $2
         AND COALESCE(st.is_active, true) = true
       ORDER BY ${orderBy}`,
      [cid, sid]
    );
  }

  return { rows: [] };
}

async function getExamMarksContext(req, res) {
  try {
    const { error: vErr, value } = examMarksContextSchema.validate(req.query, { stripUnknown: true });
    if (vErr) return error(res, 400, vErr.details[0].message);

    const ctx = getAuthContext(req);
    const ok = await teacherCanAccessClassSection(ctx.userId, value.class_id, value.section_id);
    if (!ok) return error(res, 403, 'You are not allowed to manage marks for this class section');
    await assertExamClassLinked(value.exam_id, value.class_id);
    await assertExamNotFinalized(value.exam_id);

    const schema = await getExamSchemaFlags();
    let subjects = { rows: [] };
    if (schema.hasExamSubjectsTable) {
      subjects = await query(
        `SELECT es.subject_id, sb.subject_name, sb.subject_code, es.max_marks, es.passing_marks
         FROM exam_subjects es
         INNER JOIN subjects sb ON sb.id = es.subject_id
         WHERE es.exam_id = $1
           AND es.class_id = $2
           AND es.section_id = $3
         ORDER BY sb.subject_name ASC`,
        [value.exam_id, value.class_id, value.section_id]
      );
    }
    if ((!subjects.rows || subjects.rows.length === 0) && schema.hasExamSchedulesTable) {
      subjects = await query(
        `SELECT DISTINCT csub.subject_id,
                sb.subject_name,
                sb.subject_code,
                es.max_marks,
                es.passing_marks,
                es.id AS exam_schedule_id
         FROM exam_schedules es
         INNER JOIN class_sections csec
           ON csec.id = es.class_section_id
          AND csec.class_id = es.class_id
          AND csec.academic_year_id = es.academic_year_id
         INNER JOIN class_subjects csub
           ON csub.id = es.class_subject_id
          AND csub.class_id = es.class_id
          AND csub.academic_year_id = es.academic_year_id
         INNER JOIN subjects sb ON sb.id = csub.subject_id
         WHERE es.exam_id = $1
           AND es.class_id = $2
           AND csec.section_id = $3
         ORDER BY sb.subject_name ASC`,
        [value.exam_id, value.class_id, value.section_id]
      );
    }
    if (!subjects.rows.length) {
      return error(res, 400, 'Timetable not found for selected exam/class/section');
    }

    const canReadStudentNames =
      schema.studentsHasFirstNameColumn && schema.studentsHasLastNameColumn;
    const canReadUserNames =
      schema.studentsHasUserIdColumn &&
      schema.usersHasFirstNameColumn &&
      schema.usersHasLastNameColumn;
    const studentNameSql = canReadStudentNames
      ? `TRIM(CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, '')))`
      : canReadUserNames
        ? `TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')))`
        : `COALESCE(NULLIF(TRIM(st.roll_number), ''), CONCAT('Student #', st.id::text))`;
    const studentNameOrderSql = canReadStudentNames
      ? `COALESCE(st.first_name, ''), COALESCE(st.last_name, ''), st.id`
      : canReadUserNames
        ? `COALESCE(u.first_name, ''), COALESCE(u.last_name, ''), st.id`
        : `st.id`;

    const userJoinSql = canReadUserNames ? 'LEFT JOIN users u ON u.id = st.user_id' : '';

    const students = await fetchStudentsForExamMarksRoster(schema, {
      examId: value.exam_id,
      classId: value.class_id,
      sectionId: value.section_id,
      studentNameSql,
      studentNameOrderSql,
      userJoinSql,
      idsOnly: false,
    });

    const studentIds = students.rows.map((s) => parseId(s.student_id)).filter(Boolean);
    const subjectIds = subjects.rows.map((s) => parseId(s.subject_id)).filter(Boolean);
    const scheduleBackedExamResults =
      schema.examResultsHasExamScheduleIdColumn &&
      !schema.examResultsHasSubjectIdColumn &&
      schema.hasExamSchedulesTable;
    const legacyBackedExamResults =
      schema.examResultsHasExamIdColumn && schema.examResultsHasSubjectIdColumn;

    let marks = { rows: [] };
    if (studentIds.length && subjectIds.length && scheduleBackedExamResults) {
      marks = await query(
        `SELECT er.student_id,
                csub.subject_id,
                er.marks_obtained,
                er.is_absent
         FROM exam_results er
         INNER JOIN exam_schedules es ON es.id = er.exam_schedule_id
         INNER JOIN class_subjects csub
           ON csub.id = es.class_subject_id
          AND csub.class_id = es.class_id
          AND csub.academic_year_id = es.academic_year_id
         INNER JOIN class_sections csec
           ON csec.id = es.class_section_id
          AND csec.class_id = es.class_id
          AND csec.academic_year_id = es.academic_year_id
         WHERE es.exam_id = $1
           AND es.class_id = $2
           AND csec.section_id = $3
           AND er.student_id = ANY($4::int[])
           AND csub.subject_id = ANY($5::int[])`,
        [value.exam_id, value.class_id, value.section_id, studentIds, subjectIds]
      );
    } else if (studentIds.length && subjectIds.length && legacyBackedExamResults) {
      marks = await query(
        `SELECT student_id, subject_id, marks_obtained, is_absent
         FROM exam_results
         WHERE exam_id = $1
           AND student_id = ANY($2::int[])
           AND subject_id = ANY($3::int[])`,
        [value.exam_id, studentIds, subjectIds]
      );
    }

    const byKey = new Map();
    for (const row of marks.rows) {
      byKey.set(`${row.student_id}:${row.subject_id}`, row);
    }

    const matrix = students.rows.map((student) => {
      const cells = subjects.rows.map((subject) => {
        const row = byKey.get(`${student.student_id}:${subject.subject_id}`);
        return {
          subject_id: parseId(subject.subject_id),
          is_absent: !!row?.is_absent,
          marks_obtained: row?.is_absent ? null : (row?.marks_obtained ?? null),
          max_marks: Number(subject.max_marks),
          passing_marks: Number(subject.passing_marks),
        };
      });
      const rawName = student.student_name != null ? String(student.student_name).trim() : '';
      const displayName = rawName || `Student #${parseId(student.student_id) || ''}`;
      return {
        student_id: parseId(student.student_id),
        student_name: displayName,
        roll_number: student.roll_number || null,
        cells,
      };
    });

    return success(res, 200, 'Marks context loaded', {
      subjects: subjects.rows,
      students: matrix,
    });
  } catch (e) {
    console.error('getExamMarksContext', e);
    return error(res, 500, 'Failed to load marks context');
  }
}

async function saveExamMarks(req, res) {
  try {
    const { error: vErr, value } = saveExamMarksSchema.validate(req.body, { stripUnknown: true });
    if (vErr) return error(res, 400, vErr.details[0].message);

    const ctx = getAuthContext(req);
    const ok = await teacherCanAccessClassSection(ctx.userId, value.class_id, value.section_id);
    if (!ok) return error(res, 403, 'You are not allowed to manage marks for this class section');
    await assertExamClassLinked(value.exam_id, value.class_id);
    await assertExamNotFinalized(value.exam_id);

    const schema = await getExamSchemaFlags();
    let subjects = { rows: [] };
    if (schema.hasExamSubjectsTable) {
      subjects = await query(
        `SELECT subject_id, max_marks, passing_marks
         FROM exam_subjects
         WHERE exam_id = $1
           AND class_id = $2
           AND section_id = $3`,
        [value.exam_id, value.class_id, value.section_id]
      );
    }
    if ((!subjects.rows || subjects.rows.length === 0) && schema.hasExamSchedulesTable) {
      subjects = await query(
        `SELECT DISTINCT csub.subject_id, es.max_marks, es.passing_marks, es.id AS exam_schedule_id
         FROM exam_schedules es
         INNER JOIN class_sections csec
           ON csec.id = es.class_section_id
          AND csec.class_id = es.class_id
          AND csec.academic_year_id = es.academic_year_id
         INNER JOIN class_subjects csub
           ON csub.id = es.class_subject_id
          AND csub.class_id = es.class_id
          AND csub.academic_year_id = es.academic_year_id
         WHERE es.exam_id = $1
           AND es.class_id = $2
           AND csec.section_id = $3`,
        [value.exam_id, value.class_id, value.section_id]
      );
    }
    const scheduleBackedExamResults =
      schema.examResultsHasExamScheduleIdColumn &&
      !schema.examResultsHasSubjectIdColumn &&
      schema.hasExamSchedulesTable;
    if (
      scheduleBackedExamResults &&
      schema.hasExamSchedulesTable &&
      (!subjects.rows?.length ||
        (subjects.rows || []).some((r) => !parseId(r.exam_schedule_id)))
    ) {
      subjects = await query(
        `SELECT DISTINCT csub.subject_id, es.max_marks, es.passing_marks, es.id AS exam_schedule_id
         FROM exam_schedules es
         INNER JOIN class_sections csec
           ON csec.id = es.class_section_id
          AND csec.class_id = es.class_id
          AND csec.academic_year_id = es.academic_year_id
         INNER JOIN class_subjects csub
           ON csub.id = es.class_subject_id
          AND csub.class_id = es.class_id
          AND csub.academic_year_id = es.academic_year_id
         WHERE es.exam_id = $1
           AND es.class_id = $2
           AND csec.section_id = $3`,
        [value.exam_id, value.class_id, value.section_id]
      );
    }
    if (!subjects.rows.length) return error(res, 400, 'Timetable not found for selected exam/class/section');
    const subjectMap = new Map(subjects.rows.map((s) => [parseId(s.subject_id), s]));

    const students = await fetchStudentsForExamMarksRoster(schema, {
      examId: value.exam_id,
      classId: value.class_id,
      sectionId: value.section_id,
      studentNameSql: '',
      studentNameOrderSql: '',
      userJoinSql: '',
      idsOnly: true,
    });
    const allowedStudentIds = new Set(students.rows.map((s) => parseId(s.student_id)));
    const examResultsSchema = await getExamResultsSchemaFlags();

    let conflictTarget;
    if (scheduleBackedExamResults) {
      conflictTarget = examResultsSchema.hasUniqueStudentExamSchedule
        ? '(student_id, exam_schedule_id)'
        : null;
    } else {
      conflictTarget =
        examResultsSchema.hasExamComponentColumn && examResultsSchema.hasUniqueExamStudentSubjectComponent
          ? '(exam_id, student_id, subject_id, exam_component)'
          : examResultsSchema.hasUniqueExamStudentSubject
            ? '(exam_id, student_id, subject_id)'
            : null;
    }
    if (!conflictTarget) {
      return error(
        res,
        500,
        scheduleBackedExamResults
          ? 'exam_results UNIQUE (student_id, exam_schedule_id) is missing. Apply exam module migrations before saving marks.'
          : 'exam_results unique key for marks upsert is missing. Apply exam module migrations before saving marks.'
      );
    }

    for (const row of value.rows) {
      const subject = subjectMap.get(parseId(row.subject_id));
      if (!subject) return error(res, 400, 'Payload contains subject outside timetable');
      if (scheduleBackedExamResults && !parseId(subject.exam_schedule_id)) {
        return error(res, 400, 'Timetable row is missing exam_schedule_id; cannot save marks for this schema');
      }
      if (!allowedStudentIds.has(parseId(row.student_id))) {
        return error(res, 400, 'Payload contains student outside selected class section');
      }
      if (row.is_absent) continue;
      if (row.marks_obtained == null) {
        return error(res, 400, 'Marks are required for non-absent entries');
      }
      if (Number(row.marks_obtained) > Number(subject.max_marks)) {
        return error(res, 400, 'Marks obtained cannot exceed max marks');
      }
    }

    await executeTransaction(async (client) => {
      for (const row of value.rows) {
        const subject = subjectMap.get(parseId(row.subject_id));
        const marksValue = row.is_absent ? null : Number(row.marks_obtained);
        let insertColumns;
        let insertValues;
        if (scheduleBackedExamResults) {
          insertColumns = ['exam_schedule_id', 'student_id', 'marks_obtained', 'is_absent'];
          insertValues = [
            parseId(subject.exam_schedule_id),
            row.student_id,
            marksValue,
            !!row.is_absent,
          ];
        } else {
          insertColumns = ['exam_id', 'student_id', 'subject_id', 'marks_obtained', 'is_absent'];
          insertValues = [
            value.exam_id,
            row.student_id,
            row.subject_id,
            marksValue,
            !!row.is_absent,
          ];
        }
        if (!scheduleBackedExamResults && examResultsSchema.hasExamComponentColumn) {
          insertColumns.push('exam_component');
          insertValues.push('theory');
        }
        if (examResultsSchema.hasCreatedByColumn) {
          insertColumns.push('created_by');
          insertValues.push(parseId(req.user?.id) || null);
        }
        const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(',');
        const updateSet = [
          'marks_obtained = EXCLUDED.marks_obtained',
          'is_absent = EXCLUDED.is_absent',
        ];
        if (examResultsSchema.hasModifiedAtColumn) {
          updateSet.push('updated_at = NOW()');
        }
        await client.query(
          `INSERT INTO exam_results
           (${insertColumns.join(', ')})
           VALUES (${placeholders})
           ON CONFLICT ${conflictTarget}
           DO UPDATE SET
             ${updateSet.join(', ')}`,
          insertValues
        );
      }
    });

    return success(res, 200, 'Marks saved successfully');
  } catch (e) {
    console.error('saveExamMarks', e);
    if (e?.statusCode) return error(res, e.statusCode, e.message);
    return error(res, 500, 'Failed to save marks');
  }
}

async function createExam(req, res) {
  try {
    const { error: vErr, value } = createExamSchema.validate(req.body, { stripUnknown: true });
    if (vErr) return error(res, 400, vErr.details[0].message);

    const classIds = [...new Set((value.class_ids || []).map((v) => parseId(v)).filter(Boolean))];
    if (!classIds.length) return error(res, 400, 'Select at least one class');

    const schema = await getExamSchemaFlags();
    const data = await executeTransaction(async (client) => {
      const insertCols = ['exam_name', 'exam_type', 'academic_year_id', 'description'];
      const insertVals = [value.exam_name, value.exam_type, value.academic_year_id || null, value.description || null];
      if (schema.hasCreatedByColumn) {
        insertCols.push('created_by');
        insertVals.push(parseId(req.user?.id));
      }
      if (!schema.hasExamClassesTable && schema.hasClassIdColumn) {
        insertCols.push('class_id');
        insertVals.push(classIds[0]);
      }
      const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(', ');
      const examIns = await client.query(
        `INSERT INTO exams (${insertCols.join(', ')})
         VALUES (${placeholders})
         RETURNING id, exam_name, exam_type, academic_year_id, description, created_at`,
        insertVals
      );
      const exam = examIns.rows[0];
      if (schema.hasExamClassesTable) {
        for (const classId of classIds) {
          await client.query(
            `INSERT INTO exam_classes (exam_id, class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [exam.id, classId]
          );
        }
      }
      return exam;
    });

    return success(res, 201, 'Exam created', { ...data, class_ids: classIds });
  } catch (e) {
    console.error('createExam', e);
    return error(res, 500, 'Failed to create exam');
  }
}

async function deleteExam(req, res) {
  try {
    const examId = parseId(req.params.id);
    if (!examId) return error(res, 400, 'Invalid exam id');

    const ctx = getAuthContext(req);
    if (!isAdmin(ctx)) return error(res, 403, 'Only admin can delete exams');

    const schema = await getExamSchemaFlags();
    await executeTransaction(async (client) => {
      const exists = await client.query(
        `SELECT id FROM exams WHERE id = $1 LIMIT 1`,
        [examId]
      );
      if (!exists.rows.length) {
        const errObj = new Error('Exam not found');
        errObj.statusCode = 404;
        throw errObj;
      }

      // Defensive explicit deletes: tenant/lean schema uses exam_results.exam_schedule_id
      // (CASCADE from exam_schedules), not exam_id; legacy installs use exam_id on exam_results.
      if (schema.examResultsHasExamIdColumn) {
        await client.query(`DELETE FROM exam_results WHERE exam_id = $1`, [examId]);
      }
      if (schema.hasExamSchedulesTable) {
        await client.query(`DELETE FROM exam_schedules WHERE exam_id = $1`, [examId]);
      }
      if (schema.hasExamSubjectsTable) {
        await client.query(`DELETE FROM exam_subjects WHERE exam_id = $1`, [examId]);
      }
      if (schema.hasExamClassesTable) {
        await client.query(`DELETE FROM exam_classes WHERE exam_id = $1`, [examId]);
      }
      await client.query(`DELETE FROM exams WHERE id = $1`, [examId]);
    });

    return success(res, 200, 'Exam deleted successfully');
  } catch (e) {
    if (e?.statusCode) return error(res, e.statusCode, e.message || 'Failed to delete exam');
    console.error('deleteExam', e);
    return error(res, 500, 'Failed to delete exam');
  }
}

module.exports = {
  getExamSchemaFlags,
  listExams,
  createExam,
  deleteExam,
  getGradeScale,
  createGradeScale,
  updateGradeScale,
  deleteGradeScale,
  getManageContext,
  listExamSubjects,
  listExamSubjectOptions,
  saveExamSubjects,
  getExamSubjectsContext,
  saveExamSubjectSetup,
  getExamMarksContext,
  saveExamMarks,
  viewExamSchedule,
  viewExamResults,
  viewExamTopPerformers,
  listSelfExamOptions,
};

