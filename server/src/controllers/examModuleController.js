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

const saveSubjectsSchema = Joi.object({
  exam_id: Joi.number().integer().positive().required(),
  class_id: Joi.number().integer().positive().required(),
  section_id: Joi.number().integer().positive().optional().allow(null, ''),
  subjects: Joi.array()
    .items(
      Joi.object({
        subject_id: Joi.number().integer().positive().required(),
        max_marks: Joi.number().positive().required(),
        passing_marks: Joi.number().min(0).required(),
        exam_date: Joi.date().iso().required(),
        start_time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
        end_time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
      })
    )
    .min(1)
    .required(),
});

const saveSubjectSetupSchema = Joi.object({
  exam_id: Joi.number().integer().positive().required(),
  class_id: Joi.number().integer().positive().required(),
  section_id: Joi.number().integer().positive().optional().allow(null, ''),
  rows: Joi.array()
    .items(
      Joi.object({
        subject_id: Joi.number().integer().positive().required(),
        max_marks: Joi.number().positive().required(),
        passing_marks: Joi.number().min(0).required(),
        exam_date: Joi.date().iso().required(),
        start_time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
        end_time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
        room_id: Joi.number().integer().positive().optional().allow(null, ''),
      })
    )
    .min(1)
    .required(),
});

const createExamSchema = Joi.object({
  exam_name: Joi.string().trim().min(2).max(100).required(),
  exam_type: Joi.string()
    .valid('unit_test', 'monthly', 'quarterly', 'half_yearly', 'annual', 'preboard', 'internal', 'other')
    .required(),
  academic_year_id: Joi.number().integer().positive().required(),
  description: Joi.string().trim().max(500).optional().allow(null, ''),
  class_ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  is_published: Joi.boolean().default(false).optional(),
});

const updateExamSchema = Joi.object({
  exam_name: Joi.string().trim().min(2).max(100).optional(),
  exam_type: Joi.string()
    .valid('unit_test', 'monthly', 'quarterly', 'half_yearly', 'annual', 'preboard', 'internal', 'other')
    .optional(),
  description: Joi.string().trim().max(500).optional().allow(null, ''),
  is_published: Joi.boolean().optional(),
});

const examMarksContextSchema = Joi.object({
  exam_id: Joi.number().integer().positive().required(),
  class_id: Joi.number().integer().positive().required(),
  section_id: Joi.number().integer().positive().optional().allow(null, ''),
});

const saveExamMarksSchema = Joi.object({
  exam_id: Joi.number().integer().positive().required(),
  class_id: Joi.number().integer().positive().required(),
  section_id: Joi.number().integer().positive().optional().allow(null, ''),
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
        // Only allow overlap if BOTH are electives in the same group
        if (row.is_elective && slot.is_elective && row.elective_group_id && row.elective_group_id === slot.elective_group_id) {
          continue;
        }
        return 'Two subjects cannot share overlapping exam time on the same date in the same section';
      }
    }
    scheduled.push({ date, startMin, endMin, is_elective: row.is_elective, elective_group_id: row.elective_group_id });
  }
  return null;
}

async function getExamSchemaFlags() {
  const [tableCheck, colCheck, studentColCheck, promoCheck] = await Promise.all([
    query(
      `SELECT to_regclass('public.exam_classes') AS exam_classes_table`
    ),
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
         AND table_name = 'students'
         AND column_name IN ('class_id', 'section_id')`
    ),
    query(
      `SELECT to_regclass('public.student_promotions') AS promo_table`
    ),
  ]);

  const cols = new Set((colCheck.rows || []).map((r) => String(r.column_name)));
  const sCols = new Set((studentColCheck.rows || []).map((r) => String(r.column_name)));
  return {
    hasExamClassesTable: !!tableCheck.rows?.[0]?.exam_classes_table,
    hasIsActiveColumn: cols.has('is_active'),
    hasClassIdColumn: cols.has('class_id'),
    hasCreatedByColumn: cols.has('created_by'),
    hasIsFinalizedColumn: cols.has('is_finalized'),
    studentHasClassId: sCols.has('class_id'),
    studentHasSectionId: sCols.has('section_id'),
    hasStudentPromotionsTable: !!promoCheck.rows?.[0]?.promo_table,
  };
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
  return {
    hasCreatedByColumn: cols.has('created_by'),
    hasModifiedAtColumn: cols.has('updated_at'),
    hasExamComponentColumn: cols.has('exam_component'),
    hasUniqueExamStudentSubject,
    hasUniqueExamStudentSubjectComponent,
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

    const marksCompletionSubquery = `
      (
        SELECT 
          JSON_BUILD_OBJECT(
            'total_expected', COUNT(st_all.id),
            'total_entered', COUNT(er_all.id),
            'is_complete', (COUNT(st_all.id) > 0 AND COUNT(st_all.id) = COUNT(er_all.id))
          )
        FROM exam_schedules es_all
        INNER JOIN class_subjects cs_all ON cs_all.id = es_all.class_subject_id
        CROSS JOIN LATERAL (
          SELECT st_inner.id
          FROM students st_inner
          INNER JOIN student_lifecycle_ledger l_inner ON l_inner.student_id = st_inner.id
          WHERE l_inner.to_class_id = es_all.class_id
            AND (es_all.class_section_id IS NULL OR EXISTS (
              SELECT 1 FROM class_sections cs_m 
              WHERE cs_m.id = es_all.class_section_id AND cs_m.section_id = l_inner.to_section_id
            ))
            AND l_inner.to_academic_year_id = es_all.academic_year_id
            AND st_inner.status = 'Active'
            AND (
              cs_all.is_elective = false 
              OR EXISTS (
                SELECT 1 FROM student_subject_choices ssc_inner
                WHERE ssc_inner.student_id = st_inner.id AND ssc_inner.class_subject_id = cs_all.id AND ssc_inner.deleted_at IS NULL
              )
            )
        ) st_all
        LEFT JOIN exam_results er_all ON er_all.exam_schedule_id = es_all.id AND er_all.student_id = st_all.id
        WHERE es_all.exam_id = e.id
      ) AS marks_completion
    `;

    const baseSelect = schema.hasExamClassesTable
      ? `SELECT
           e.id,
           e.exam_name,
           e.exam_type,
           e.academic_year_id,
           e.description,
           e.is_published,
           e.created_at,
           ${marksCompletionSubquery},
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
           e.is_published,
           e.created_at,
           ${marksCompletionSubquery},
           ARRAY_AGG(DISTINCT c.class_name ORDER BY c.class_name) AS class_names
         FROM exams e
         LEFT JOIN classes c ON c.id = e.class_id`
      : `SELECT
           e.id,
           e.exam_name,
           e.exam_type,
           e.academic_year_id,
           e.description,
           e.is_published,
           e.created_at,
           ${marksCompletionSubquery},
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
        `SELECT st.id AS staff_id
         FROM staff st
         WHERE st.user_id = $1 AND st.status = 'Active'`,
        [ctx.userId]
      );
      if (!teacherMap.rows.length) return success(res, 200, 'Exams loaded', []);

      const staffIds = teacherMap.rows.map((x) => parseId(x.staff_id)).filter(Boolean);
      // In this schema, staff.id is used as the teacher reference
      const teacherIds = staffIds;

      params.push(teacherIds, staffIds);
      const teacherIdsIdx = params.length - 1;
      const staffIdsIdx = params.length;
      if (!teacherIds.length && !staffIds.length) return success(res, 200, 'Exams loaded', []);

      if (!schema.hasExamClassesTable && !schema.hasClassIdColumn) {
        return success(res, 200, 'Exams loaded', []);
      }

      const teacherWhere = schema.hasExamClassesTable
        ? `
          EXISTS (
            SELECT 1
            FROM exam_classes ec2
            WHERE ec2.exam_id = e.id
              AND (
                EXISTS (
                  SELECT 1
                  FROM class_schedules cs
                  WHERE cs.class_id = ec2.class_id
                    AND cs.teacher_id = ANY($${teacherIdsIdx}::int[])
                    AND cs.academic_year_id = e.academic_year_id
                )
                OR EXISTS (
                  SELECT 1
                  FROM class_teachers ct
                  WHERE ct.class_id = ec2.class_id
                    AND ct.staff_id = ANY($${staffIdsIdx}::int[])
                    AND ct.deleted_at IS NULL
                )
                OR EXISTS (
                  SELECT 1
                  FROM class_sections cs_rel
                  WHERE cs_rel.class_id = ec2.class_id
                    AND cs_rel.academic_year_id = e.academic_year_id
                    AND cs_rel.deleted_at IS NULL
                    AND (
                      EXISTS (
                        SELECT 1 FROM class_teachers ct 
                        WHERE ct.class_section_id = cs_rel.id 
                          AND ct.staff_id = ANY($${staffIdsIdx}::int[])
                          AND ct.deleted_at IS NULL
                      )
                    )
                )
              )
          )
        `
        : `
          (
            EXISTS (
              SELECT 1
              FROM class_schedules cs
              WHERE cs.class_id = e.class_id
                AND cs.teacher_id = ANY($${teacherIdsIdx}::int[])
                AND cs.academic_year_id = e.academic_year_id
            )
            OR EXISTS (
              SELECT 1
              FROM class_teachers ct
              WHERE ct.class_id = e.class_id
                AND ct.staff_id = ANY($${staffIdsIdx}::int[])
                AND ct.deleted_at IS NULL
            )
            OR EXISTS (
              SELECT 1
              FROM class_sections cs_rel
              WHERE cs_rel.class_id = e.class_id
                AND cs_rel.academic_year_id = e.academic_year_id
                AND cs_rel.deleted_at IS NULL
                AND (
                  EXISTS (
                    SELECT 1 FROM class_teachers ct 
                    WHERE ct.class_section_id = cs_rel.id 
                      AND ct.staff_id = ANY($${staffIdsIdx}::int[])
                      AND ct.deleted_at IS NULL
                  )
                )
            )
          )
        `;
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
    `SELECT st.id AS staff_id
     FROM staff st
     WHERE st.user_id = $1 AND st.status = 'Active'`,
    [userId]
  );
  const ids = teacherMap.rows.map((x) => parseId(x.staff_id)).filter(Boolean);
  return {
    teacherIds: ids,
    staffIds: ids,
  };
}

async function teacherCanAccessClassSection(userId, classId, sectionId, academicYearId = null) {
  const { teacherIds, staffIds } = await getTeacherMaps(userId);
  if (!teacherIds.length && !staffIds.length) return false;

  const p = [classId, sectionId, staffIds, academicYearId];
  const check = await query(
    `SELECT 1
     WHERE
      -- 1. Active Class Teacher Assignment for this specific Section
      EXISTS (
        SELECT 1 FROM class_sections cs_rel
        WHERE cs_rel.class_id = $1 
          AND (cs_rel.section_id = $2 OR (cs_rel.section_id IS NULL AND $2 IS NULL))
          AND ($4::int IS NULL OR cs_rel.academic_year_id = $4)
          AND cs_rel.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM class_teachers ct
            WHERE ct.class_section_id = cs_rel.id
              AND ct.staff_id = ANY($3::int[])
              AND ct.deleted_at IS NULL
              AND ($4::int IS NULL OR ct.academic_year_id = $4)
          )
      )
      -- 2. Active Subject Teacher Assignment for this Class/Section
      OR EXISTS (
        SELECT 1 FROM subject_teacher_assignments sta
        WHERE sta.class_id = $1
          AND ($4::int IS NULL OR sta.academic_year_id = $4)
          AND sta.staff_id = ANY($3::int[])
          AND sta.deleted_at IS NULL
          AND (
            sta.class_section_id IS NULL -- Whole class assignment
            OR EXISTS (
              SELECT 1 FROM class_sections csec
              WHERE csec.id = sta.class_section_id 
                AND csec.section_id = $2 
                AND csec.class_id = $1
                AND ($4::int IS NULL OR csec.academic_year_id = $4)
            )
          )
      )
      -- 3. Active Class Teacher Assignment for the whole Class
      OR EXISTS (
        SELECT 1 FROM class_teachers ct
        WHERE ct.class_id = $1
          AND ct.staff_id = ANY($3::int[])
          AND ct.deleted_at IS NULL
          AND ct.class_section_id IS NULL
          AND ($4::int IS NULL OR ct.academic_year_id = $4)
      )`,
    p
  );
  return check.rows.length > 0;
}

async function getClassSubjects(classId, academicYearId = null) {
  const params = [classId];
  let ayCond = '';
  if (academicYearId) {
    params.push(academicYearId);
    ayCond = `AND cs.academic_year_id = $2`;
  }
  const r = await query(
    `SELECT cs.id, s.subject_name, s.subject_code, 
            cs.is_elective, cs.elective_group_id,
            0 AS theory_hours, 0 AS practical_hours,
            s.subject_type as subject_mode
     FROM class_subjects cs
     JOIN subjects s ON s.id = cs.subject_id
     WHERE cs.class_id = $1
       AND cs.deleted_at IS NULL
       ${ayCond}
     ORDER BY s.subject_name ASC`,
    params
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

    const examInfo = await query('SELECT academic_year_id FROM exams WHERE id = $1', [examId]);
    const academicYearId = examInfo.rows[0]?.academic_year_id;

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
      const sectionRows = await query(
        `SELECT s.id AS section_id, s.section_name, cs_rel.class_id
         FROM class_sections cs_rel
         INNER JOIN sections s ON s.id = cs_rel.section_id
         WHERE cs_rel.class_id = ANY($1::int[])
           AND cs_rel.deleted_at IS NULL
           ${academicYearId ? 'AND cs_rel.academic_year_id = $4' : ''}
           AND (
             EXISTS (
               SELECT 1 FROM class_teachers ct
               WHERE ct.class_section_id = cs_rel.id
                 AND ct.staff_id = ANY($2::int[])
                 AND ct.deleted_at IS NULL
             )
             OR EXISTS (
               SELECT 1 FROM class_schedules cs
               WHERE cs.class_id = cs_rel.class_id
                 AND (cs.class_section_id = cs_rel.id OR cs.class_section_id IS NULL)
                 AND cs.teacher_id = ANY($3::int[])
                 ${academicYearId ? 'AND cs.academic_year_id = $4' : ''}
             )
             OR EXISTS (
               SELECT 1 FROM class_teachers ct
               WHERE (ct.class_id = cs_rel.class_id OR ct.class_section_id = cs_rel.id)
                 AND ct.staff_id = ANY($2::int[])
                 AND ct.deleted_at IS NULL
             )
           )
         ORDER BY s.section_name`,
        academicYearId 
          ? [classMap.map((x) => x.class_id).filter(Boolean), staffIds, teacherIds, academicYearId]
          : [classMap.map((x) => x.class_id).filter(Boolean), staffIds, teacherIds]
      );
      const byClass = new Map();
      sectionRows.rows.forEach((s) => {
        const k = parseId(s.class_id);
        if (!byClass.has(k)) byClass.set(k, []);
        byClass.get(k).push({ section_id: parseId(s.section_id), section_name: s.section_name });
      });
      classMap = classMap
        .map((c) => ({ ...c, sections: byClass.get(c.class_id) || [] }));
    } else {
      const sec = await query(
        `SELECT s.id AS section_id, s.section_name, cs_rel.class_id
         FROM class_sections cs_rel
         INNER JOIN sections s ON s.id = cs_rel.section_id
         WHERE cs_rel.class_id = ANY($1::int[])
           AND cs_rel.deleted_at IS NULL
           ${academicYearId ? 'AND cs_rel.academic_year_id = $2' : ''}
         ORDER BY s.section_name`,
        academicYearId 
          ? [classMap.map((x) => x.class_id).filter(Boolean), academicYearId]
          : [classMap.map((x) => x.class_id).filter(Boolean)]
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
    console.error('getManageContext Error:', e);
    return error(res, 500, 'Failed to load manage context: ' + e.message);
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

    let classSectionId = null;
    if (sectionId) {
      const sec = await query(
        `SELECT id FROM class_sections WHERE section_id = $1 AND class_id = $2 AND deleted_at IS NULL LIMIT 1`,
        [sectionId, classId]
      );
      if (sec.rows.length) {
        classSectionId = sec.rows[0].id;
      }
    }

    const r = await query(
      `SELECT es.id, es.class_subject_id AS subject_id, s.subject_name, es.max_marks, es.passing_marks, es.exam_date, es.start_time, es.end_time
       FROM exam_schedules es
       INNER JOIN class_subjects cs ON cs.id = es.class_subject_id
       INNER JOIN subjects s ON s.id = cs.subject_id
       WHERE es.exam_id = $1 AND es.class_id = $2 AND ${classSectionId ? 'es.class_section_id = $3' : 'es.class_section_id IS NULL'}
       ORDER BY s.subject_name`,
      classSectionId ? [examId, classId, classSectionId] : [examId, classId]
    );
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

    const examInfo = await query('SELECT academic_year_id FROM exams WHERE id = $1', [examId]);
    const academicYearId = examInfo.rows[0]?.academic_year_id;

    const r = await query(
      `SELECT s.id, s.subject_name
       FROM class_subjects cs
       JOIN subjects s ON s.id = cs.subject_id
       WHERE cs.class_id = $1 
         AND cs.deleted_at IS NULL
         ${academicYearId ? 'AND cs.academic_year_id = $2' : ''}
       ORDER BY s.subject_name ASC`,
      academicYearId ? [classId, academicYearId] : [classId]
    );
    return success(res, 200, 'Subjects loaded', r.rows);
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
    if (!examId || !classId) {
      return error(res, 400, 'exam_id and class_id are required');
    }

    // Section must belong to class (prevents cross-class leakage)
    let classSectionId = null;
    if (sectionId) {
      const sec = await query(
        'SELECT id FROM class_sections WHERE section_id = $1 AND class_id = $2 AND deleted_at IS NULL LIMIT 1',
        [sectionId, classId]
      );
      if (sec.rows.length) {
        classSectionId = sec.rows[0].id;
      }
    }

    const ctx = getAuthContext(req);
    if (!isAdmin(ctx) && isTeacherRole(ctx)) {
      if (sectionId) {
        const ok = await teacherCanAccessClassSection(ctx.userId, classId, sectionId);
        if (!ok) return error(res, 403, 'You are not allowed to access this class section');
      }
    }

    const examInfo = await query('SELECT academic_year_id FROM exams WHERE id = $1', [examId]);
    const academicYearId = examInfo.rows[0]?.academic_year_id;

    const classSubjects = await getClassSubjects(classId, academicYearId);
    if (!classSubjects.length) {
      return success(res, 200, 'No subjects found for selected class', {
        subjects: [],
        timetable_rows: [],
      });
    }

    const existing = await query(
      `SELECT class_subject_id AS subject_id, max_marks, passing_marks, exam_date::TEXT, start_time, end_time, class_room_id
       FROM exam_schedules
       WHERE exam_id = $1 AND class_id = $2 AND ${classSectionId ? 'class_section_id = $3' : 'class_section_id IS NULL'}`,
      classSectionId ? [examId, classId, classSectionId] : [examId, classId]
    );
    const bySubject = new Map((existing.rows || []).map((r) => [parseId(r.subject_id), r]));

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
        class_room_id: ex?.class_room_id || null,
        is_elective: !!s.is_elective,
        elective_group_id: s.elective_group_id || null,
      };
    });

    return success(res, 200, 'Context loaded', {
      subjects: classSubjects,
      timetable_rows: rows,
    });
  } catch (e) {
    console.error('getExamSubjectsContext', e);
    return error(res, 500, 'Failed to load exam-subject context', e.message);
  }
}

async function resolveStudentScopeByUser(ctx, targetStudentId = null) {
  const schema = await getExamSchemaFlags();

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
         ON s2.status = 'Active'
        AND (
          (b.user_id IS NOT NULL AND s2.user_id = b.user_id)
          OR (COALESCE(NULLIF(TRIM(b.admission_number), ''), '') <> '' AND s2.admission_number = b.admission_number)
        )
       ORDER BY s2.id DESC
       LIMIT 1`,
      [sid]
    );
    return parseId(latest.rows?.[0]?.student_id) || sid;
  };

  const normalizeToLatestStudentRecord = async (row) => {
    const studentId = parseId(row?.student_id);
    if (!studentId) return row || null;
    const resolvedId = await resolveLatestLinkedStudentId(studentId);

    const cols = ['s2.id AS student_id'];
    if (schema.studentHasClassId) cols.push('s2.class_id');
    if (schema.studentHasSectionId) cols.push('s2.section_id');

    const latest = await query(
      `SELECT ${baseCols.join(', ')}
       ${baseFrom}
       WHERE s.id = $1
       LIMIT 1`,
      [resolvedId]
    );
    return latest.rows?.[0] || row;
  };

  const enrichScopeFromAttendance = async (row) => {
    const normalizedRow = await normalizeToLatestStudentRecord(row);
    if (!normalizedRow?.student_id) return normalizedRow || null;

    // Use student_lifecycle_ledger as the canonical source for latest class/section
    const ledger = await query(
      `SELECT to_class_id AS class_id, to_section_id AS section_id
       FROM student_lifecycle_ledger
       WHERE student_id = $1
       ORDER BY event_date DESC, id DESC
       LIMIT 1`,
      [normalizedRow.student_id]
    );

    if (ledger.rows.length) {
      return {
        ...normalizedRow,
        class_id: ledger.rows[0].class_id || normalizedRow.class_id,
        section_id: ledger.rows[0].section_id || normalizedRow.section_id,
      };
    }

    return normalizedRow;
  };

  const baseCols = [
    's.id AS student_id',
    's.admission_number',
    "CONCAT(u.first_name, ' ', u.last_name) AS student_name"
  ];
  
  let enrollmentJoin = '';
  if (schema.studentHasClassId) {
    baseCols.push('s.class_id', 'c.class_name');
    enrollmentJoin += ' LEFT JOIN classes c ON c.id = s.class_id';
  } else {
    baseCols.push('enr.to_class_id AS class_id', 'c.class_name');
    enrollmentJoin += `
      LEFT JOIN LATERAL (
        SELECT l.to_class_id, l.to_section_id FROM student_lifecycle_ledger l 
        WHERE l.student_id = s.id ORDER BY l.event_date DESC NULLS LAST, l.id DESC LIMIT 1
      ) enr ON true
      LEFT JOIN classes c ON c.id = enr.to_class_id
    `;
  }

  if (schema.studentHasSectionId) {
    baseCols.push('s.section_id', 'sec.section_name');
    enrollmentJoin += ' LEFT JOIN sections sec ON sec.id = s.section_id';
  } else if (!schema.studentHasClassId) {
    // If we used the ledger for class, we use it for section too
    baseCols.push('enr.to_section_id AS section_id', 'sec.section_name');
    enrollmentJoin += ' LEFT JOIN sections sec ON sec.id = enr.to_section_id';
  }
  
  const baseFrom = `
    FROM students s
    INNER JOIN users u ON u.id = s.user_id
    ${enrollmentJoin}
  `;

  if (!ctx?.userId) return null;
  if (ctx.roleId === ROLES.STUDENT || ctx.roleName === 'student') {
    let s = await query(
      `SELECT ${baseCols.join(', ')}
       ${baseFrom}
       WHERE s.user_id = $1 AND s.status = 'Active'
       ORDER BY s.id DESC
       LIMIT 1`,
      [ctx.userId]
    );
    return enrichScopeFromAttendance(s.rows[0] || null);
  }
  if (ctx.roleId === ROLES.PARENT || ctx.roleName === 'parent') {
    const linked = await getParentsForUser(ctx.userId).catch(() => ({ studentIds: [] }));
    if (!linked.studentIds || linked.studentIds.length === 0) return null;

    let selectedId = linked.studentIds[0];
    if (targetStudentId && linked.studentIds.includes(parseId(targetStudentId))) {
      selectedId = parseId(targetStudentId);
    }

    const sid = await resolveLatestLinkedStudentId(selectedId);
    if (!sid) return null;

    const s = await query(
      `SELECT ${baseCols.join(', ')}
       ${baseFrom}
       WHERE s.id = $1
         AND s.status = 'Active'
       LIMIT 1`,
      [sid]
    );
    return enrichScopeFromAttendance(s.rows[0] || null);
  }
  if (ctx.roleId === ROLES.GUARDIAN || ctx.roleName === 'guardian') {
    const gCols = ['s.id AS student_id'];
    if (schema.studentHasClassId) gCols.push('s.class_id');
    if (schema.studentHasSectionId) gCols.push('s.section_id');

    let s = await query(
      `SELECT ${gCols.join(', ')}
       FROM guardians g
       INNER JOIN students s ON s.id = g.student_id
       WHERE g.user_id = $1
         AND s.status = 'Active'
       ORDER BY s.id DESC
       LIMIT 1`,
      [ctx.userId]
    );
    if (!s.rows.length) {
      const linked = await getParentsForUser(ctx.userId).catch(() => ({ studentIds: [] }));
      const sid = await resolveLatestLinkedStudentId(linked.studentIds?.[0]);
      if (sid) {
        s = await query(
          `SELECT ${baseCols.join(', ')}
           FROM students
           WHERE id = $1
             AND status = 'Active'
           LIMIT 1`,
          [sid]
        );
      }
    }
    return enrichScopeFromAttendance(s.rows[0] || null);
  }
  return null;
}

async function viewExamSchedule(req, res) {
  try {
    const ctx = getAuthContext(req);
    let examId = parseId(req.query.exam_id);
    let classId = parseId(req.query.class_id);
    let sectionId = parseId(req.query.section_id);

    const selfStudent = await resolveStudentScopeByUser(ctx);
    if (selfStudent) {
      classId = parseId(selfStudent.class_id);
      sectionId = parseId(selfStudent.section_id);
    }

    if (!classId) {
      return error(res, 400, 'class_id is required');
    }

    let classSectionId = null;
    if (sectionId) {
      const sec = await query(
        `SELECT id FROM class_sections WHERE section_id = $1 AND class_id = $2 AND deleted_at IS NULL LIMIT 1`,
        [sectionId, classId]
      );
      if (sec.rows.length) {
        classSectionId = sec.rows[0].id;
      }
    }

    let academicYearId = null;
    if (examId) {
      const examInfo = await query('SELECT academic_year_id FROM exams WHERE id = $1', [examId]);
      academicYearId = examInfo.rows[0]?.academic_year_id;
    }

    if (!isAdmin(ctx) && isTeacherRole(ctx) && sectionId) {
      const ok = await teacherCanAccessClassSection(ctx.userId, classId, sectionId, academicYearId);
      if (!ok) return error(res, 403, 'You are not allowed to view this class section timetable');
    }

    const params = [classId];
    let sectionFilter = '';
    if (classSectionId) {
      params.push(classSectionId);
      sectionFilter = ` AND es.class_section_id = $${params.length}`;
    } else {
      sectionFilter = ' AND es.class_section_id IS NULL';
    }
    let examFilter = '';
    if (examId) {
      params.push(examId);
      examFilter = ` AND es.exam_id = $${params.length}`;
    }

    const r = await query(
      `SELECT
         es.exam_id,
         e.exam_name,
         e.exam_type,
         es.class_id,
         c.class_name,
         cs_rel.section_id,
         sec_ref.section_name,
         es.class_subject_id AS subject_id,
         s.subject_name,
         s.subject_code,
         es.exam_date::TEXT,
         es.start_time,
         es.end_time,
         es.max_marks,
         es.passing_marks,
         cr.room_number,
         cr.building_name
       FROM exam_schedules es
       INNER JOIN exams e ON e.id = es.exam_id
       INNER JOIN class_subjects cs ON cs.id = es.class_subject_id
       INNER JOIN subjects s ON s.id = cs.subject_id
       LEFT JOIN classes c ON c.id = es.class_id
       LEFT JOIN class_sections cs_rel ON cs_rel.id = es.class_section_id
       LEFT JOIN sections sec_ref ON sec_ref.id = cs_rel.section_id
       LEFT JOIN class_rooms cr ON cr.id = es.class_room_id
       WHERE es.class_id = $1 ${sectionFilter} ${examFilter}
       ORDER BY es.exam_date ASC, es.start_time ASC`,
      params
    );

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

    // Check if exam results are published
    const examCheck = await query('SELECT is_published, academic_year_id FROM exams WHERE id = $1', [examId]);
    if (!examCheck.rows.length) return error(res, 404, 'Exam not found');
    const isPublished = !!examCheck.rows[0].is_published;
    const examYearId = examCheck.rows[0].academic_year_id;

    const selfStudent = await resolveStudentScopeByUser(ctx, req.query.student_id);
    // Students/Parents only see published results (Admins and Teachers see everything)
    if (selfStudent && !isPublished && !isAdmin(ctx) && !isTeacherRole(ctx)) {
      return success(res, 200, 'Results for this exam have not been published yet.', { results: [], has_pending_electives: false });
    }

    if (selfStudent) {
      const studentId = parseId(selfStudent.student_id);
      if (!studentId) return success(res, 200, 'Result loaded', { results: [], has_pending_electives: false });

      const rows = await query(
        `SELECT
           st.id AS student_id,
           st.admission_number AS admission_no,
           st.roll_number,
           CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS student_name,
           es.class_subject_id AS subject_id,
           sb.subject_name,
           sb.subject_code,
           er.marks_obtained,
           COALESCE(er.is_absent, false) AS is_absent,
           es.max_marks,
           es.passing_marks
         FROM students st
         INNER JOIN users u ON u.id = st.user_id
         INNER JOIN student_lifecycle_ledger l ON l.student_id = st.id
         INNER JOIN exam_schedules es
           ON es.exam_id = $1
          AND es.class_id = l.to_class_id
          AND es.academic_year_id = l.to_academic_year_id
         INNER JOIN class_subjects cs ON cs.id = es.class_subject_id
         INNER JOIN subjects sb ON sb.id = cs.subject_id
         LEFT JOIN class_sections cs_match ON cs_match.id = es.class_section_id
         LEFT JOIN exam_results er
           ON er.exam_schedule_id = es.id
          AND er.student_id = st.id
         WHERE st.id = $2
           AND l.to_academic_year_id = $3
           AND (
             es.class_section_id IS NULL 
             OR cs_match.section_id = l.to_section_id
           )
           AND (
             cs.is_elective = false 
             OR EXISTS (
               SELECT 1 FROM student_subject_choices ssc
               WHERE ssc.student_id = st.id
                 AND ssc.class_subject_id = cs.id
                 AND ssc.deleted_at IS NULL
             )
           )
         ORDER BY sb.subject_name ASC`,
        [examId, studentId, examYearId]
      );

      // Resolve current class/section for elective pending check
      const currentClassId = selfStudent.class_id;
      const pendingCheck = await query(
        `SELECT COUNT(DISTINCT cs.elective_group_id) AS pending_count
         FROM class_subjects cs
         WHERE cs.class_id = $1 
           AND cs.is_elective = true 
           AND cs.elective_group_id IS NOT NULL
           AND cs.deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM student_subject_choices ssc
             INNER JOIN class_subjects cs2 ON cs2.id = ssc.class_subject_id
             WHERE ssc.student_id = $2
               AND ssc.class_id = $1
               AND cs2.elective_group_id = cs.elective_group_id
               AND ssc.deleted_at IS NULL
           )`,
        [currentClassId, studentId]
      );

      return success(res, 200, 'Result loaded', {
        student: {
          id: studentId,
          name: `${selfStudent.student_name || ""}`.trim() || "Student",
          admission_no: selfStudent.admission_no || selfStudent.admission_number,
          class_name: selfStudent.class_name,
          section_name: selfStudent.section_name
        },
        results: rows.rows,
        has_pending_electives: parseInt(pendingCheck.rows[0]?.pending_count || 0) > 0
      });
    }

    if (!classId) {
      return error(res, 400, 'class_id is required');
    }

    const examInfo = await query('SELECT academic_year_id FROM exams WHERE id = $1', [examId]);
    const academicYearId = examInfo.rows[0]?.academic_year_id;

    if (!isAdmin(ctx) && isTeacherRole(ctx)) {
      const ok = await teacherCanAccessClassSection(ctx.userId, classId, sectionId, academicYearId);
      if (!ok) return error(res, 403, 'You are not allowed to view this class section result');
    }

    let classSectionId = null;
    if (sectionId) {
      const secRes = await query(
        'SELECT id FROM class_sections WHERE section_id = $1 AND class_id = $2 AND deleted_at IS NULL LIMIT 1',
        [sectionId, classId]
      );
      classSectionId = secRes.rows[0]?.id || null;
    }

    const rows = await query(
      `WITH subject_plan AS (
         SELECT es.id AS exam_schedule_id, es.class_subject_id AS subject_id, es.max_marks, es.passing_marks,
                cs.is_elective, cs.elective_group_id
         FROM exam_schedules es
         INNER JOIN class_subjects cs ON cs.id = es.class_subject_id
         WHERE es.exam_id = $1 AND es.class_id = $2 
           AND ${classSectionId ? 'es.class_section_id = $3' : 'es.class_section_id IS NULL'}
       )
       SELECT
         st.id AS student_id,
         st.admission_number AS admission_no,
         st.roll_number,
         CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS student_name,
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
          WHEN COUNT(sp.subject_id) = 0 THEN 'N/A'
          WHEN COUNT(er.student_id) < COUNT(sp.subject_id) THEN 'PENDING'
          WHEN BOOL_OR(er.student_id IS NULL) THEN 'FAIL'
           WHEN BOOL_OR(COALESCE(er.is_absent, false) = true)
             OR BOOL_OR(COALESCE(er.marks_obtained, 0) < COALESCE(sp.passing_marks, 0))
           THEN 'FAIL'
           ELSE 'PASS'
         END AS result_status
       FROM students st
       INNER JOIN users u ON u.id = st.user_id
       INNER JOIN LATERAL (
         SELECT to_class_id, to_section_id
         FROM student_lifecycle_ledger l
         WHERE l.student_id = st.id
           ${academicYearId ? 'AND l.to_academic_year_id = $4' : ''}
         ORDER BY l.event_date DESC, l.id DESC
         LIMIT 1
       ) enr ON enr.to_class_id = $2 ${sectionId ? 'AND (enr.to_section_id = $5 OR (enr.to_section_id IS NULL AND $5 IS NULL))' : ''}
       LEFT JOIN subject_plan sp ON (
         sp.is_elective = false 
         OR EXISTS (
           SELECT 1 FROM student_subject_choices ssc
           WHERE ssc.student_id = st.id
             AND ssc.class_subject_id = sp.subject_id
             AND ssc.deleted_at IS NULL
         )
       )
       LEFT JOIN exam_results er
         ON er.exam_schedule_id = sp.exam_schedule_id
        AND er.student_id = st.id
       WHERE st.status = 'Active'
       GROUP BY st.id, st.admission_number, u.first_name, u.last_name
       ORDER BY u.first_name ASC, u.last_name ASC`,
      classSectionId 
        ? (academicYearId ? [examId, classId, classSectionId, academicYearId, sectionId] : [examId, classId, classSectionId, sectionId])
        : (academicYearId ? [examId, classId, academicYearId, sectionId] : [examId, classId, sectionId])
    );
    const gradeScale = await loadActiveGradeScale();
    const withGrade = (rows.rows || []).map((r) => ({
      ...r,
      grade: r.percentage == null ? null : getGradeFromScale(r.percentage, gradeScale),
    }));
    return success(res, 200, 'Result loaded', withGrade);
  } catch (e) {
    console.error('viewExamResults', e);
    return error(res, 500, 'Failed to load exam result', e.message);
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

    let allowedScopes = [];
    if (isAdmin(ctx)) {
      const scopeRes = await query(
        `SELECT DISTINCT es.class_id, cs_rel.section_id
         FROM exam_schedules es
         INNER JOIN class_sections cs_rel ON cs_rel.id = es.class_section_id
         WHERE es.exam_id = $1
           AND es.class_id IS NOT NULL
           AND es.class_section_id IS NOT NULL`,
        [examId]
      );
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
      const scopeRes = await query(
        `SELECT DISTINCT es.class_id, cs_rel.section_id
         FROM exam_schedules es
         INNER JOIN class_sections cs_rel ON cs_rel.id = es.class_section_id
         WHERE es.exam_id = $1
           AND es.class_id IS NOT NULL
           AND es.class_section_id IS NOT NULL
           AND (
             EXISTS (
               SELECT 1 FROM class_teachers ct
               WHERE ct.staff_id = ANY($2::int[])
                 AND ct.class_id = es.class_id
                 AND (ct.class_section_id IS NULL OR ct.class_section_id = es.class_section_id)
                 AND ct.deleted_at IS NULL
             )
             OR EXISTS (
               SELECT 1 FROM class_schedules cs
               WHERE cs.teacher_id = ANY($2::int[])
                 AND cs.class_id = es.class_id
             )
             OR EXISTS (
               SELECT 1 FROM subject_teacher_assignments sta
               WHERE sta.staff_id = ANY($2::int[])
                 AND sta.class_id = es.class_id
                 AND sta.deleted_at IS NULL
             )
           )`,
        [examId, staffIds]
      );
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
      scopeValuesSql.push(`($${idx * 2 + 1}, $${idx * 2 + 2})`);
    });
    const examInfo = await query('SELECT academic_year_id FROM exams WHERE id = $1', [examId]);
    const academicYearId = examInfo.rows[0]?.academic_year_id;

    const examParamIdx = scopeParams.length + 1;
    const yearParamIdx = scopeParams.length + 2;
    const rowsRes = await query(
      `WITH allowed_scopes(class_id, section_id) AS (
         VALUES ${scopeValuesSql.join(', ')}
       ),
       subject_plan AS (
         SELECT es.id AS exam_schedule_id, es.class_id, cs_rel.section_id, es.class_subject_id AS subject_id,
                COALESCE(es.max_marks, 100) AS max_marks,
                COALESCE(es.passing_marks, 35) AS passing_marks,
                cs.is_elective
         FROM exam_schedules es
         INNER JOIN class_sections cs_rel ON cs_rel.id = es.class_section_id
         INNER JOIN class_subjects cs ON cs.id = es.class_subject_id
         INNER JOIN allowed_scopes a
           ON a.class_id::text = es.class_id::text
          AND a.section_id::text = cs_rel.section_id::text
         WHERE es.exam_id = $${examParamIdx}
       ),
       scored AS (
         SELECT
           st.id AS student_id,
           u.first_name,
           u.last_name,
           u.avatar AS photo_url,
           enr.class_id,
           enr.section_id,
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
         INNER JOIN users u ON u.id = st.user_id
         INNER JOIN LATERAL (
           SELECT to_class_id AS class_id, to_section_id AS section_id
           FROM student_lifecycle_ledger l
           WHERE l.student_id = st.id
             ${academicYearId ? `AND l.to_academic_year_id = $${yearParamIdx}` : ''}
           ORDER BY l.event_date DESC, l.id DESC
           LIMIT 1
         ) enr ON TRUE
         INNER JOIN allowed_scopes a
           ON a.class_id::text = enr.class_id::text
          AND a.section_id::text = enr.section_id::text
         INNER JOIN subject_plan sp
           ON sp.class_id::text = enr.class_id::text
          AND sp.section_id::text = enr.section_id::text
          AND (
            sp.is_elective = false 
            OR EXISTS (
              SELECT 1 FROM student_subject_choices ssc
              WHERE ssc.student_id = st.id
                AND ssc.class_subject_id = sp.subject_id
                AND ssc.deleted_at IS NULL
            )
          )
         LEFT JOIN exam_results er
           ON er.exam_schedule_id = sp.exam_schedule_id
          AND er.student_id = st.id
         WHERE st.status = 'Active'
         GROUP BY st.id, st.admission_number, u.first_name, u.last_name, u.avatar, enr.class_id, enr.section_id
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
      academicYearId ? [...scopeParams, examId, academicYearId] : [...scopeParams, examId]
    );

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
    return error(res, 500, 'Failed to load top performers', e.message);
  }
}

async function listSelfExamOptions(req, res) {
  try {
    const ctx = getAuthContext(req);
    const schema = await getExamSchemaFlags();
    const selfStudent = await resolveStudentScopeByUser(ctx, req.query.student_id);
    let availableStudents = [];
    if (ctx.roleId === ROLES.PARENT || ctx.roleName === 'parent') {
      const linked = await getParentsForUser(ctx.userId).catch(() => ({ parents: [] }));
      availableStudents = linked.parents.map(p => ({
        id: p.student_id,
        name: `${p.student_first_name} ${p.student_last_name}`.trim(),
        admission_no: p.admission_number,
        class_name: p.class_name,
        section_name: p.section_name
      }));
    }

    if (!selfStudent) return success(res, 200, 'Self exams loaded', { exams: [], students: availableStudents });
    const classId = parseId(selfStudent.class_id);
    const sectionId = parseId(selfStudent.section_id);
    if (!classId) return success(res, 200, 'Self exams loaded', { exams: [], students: availableStudents });
    const academicYearId = req.query.academic_year_id ? parseId(req.query.academic_year_id) : null;
    const isStaff = [ROLES.ADMIN, ROLES.TEACHER, ROLES.ADMINISTRATIVE].includes(ctx.roleId);
    const publishFilter = isStaff ? "" : "AND e.is_published = true";
 
    const esCaps = await query(`SELECT (to_regclass('public.exam_schedules') IS NOT NULL) AS has_es`);
    const hasExamSchedules = !!esCaps.rows?.[0]?.has_es;
 
    if (hasExamSchedules) {
      const esParams = [classId];
      let esWhere = 'WHERE es.class_id = $1';
      if (sectionId) {
        esParams.push(sectionId);
        esWhere += ` AND (cs_rel.section_id = $${esParams.length} OR es.class_section_id IS NULL)`;
      } else {
        esWhere += ` AND es.class_section_id IS NULL`;
      }
      if (academicYearId) {
        esParams.push(academicYearId);
        esWhere += ` AND e.academic_year_id = $${esParams.length}`;
      }
      const fromExamSubjects = await query(
        `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
         FROM exam_schedules es
         INNER JOIN exams e ON e.id = es.exam_id
         LEFT JOIN class_sections cs_rel ON cs_rel.id = es.class_section_id
         ${esWhere} ${publishFilter}
         ORDER BY e.id DESC`,
        esParams
      );
      if (fromExamSubjects.rows.length > 0) {
        return success(res, 200, 'Self exams loaded', { exams: fromExamSubjects.rows, students: availableStudents });
      }
    }

    if (academicYearId && hasExamSchedules) {
      const retryParams = [classId];
      let retryWhere = 'WHERE es.class_id = $1';
      if (sectionId) {
        retryParams.push(sectionId);
        retryWhere += ` AND (cs_rel.section_id = $${retryParams.length} OR es.class_section_id IS NULL)`;
      } else {
        retryWhere += ` AND es.class_section_id IS NULL`;
      }
      const retryNoYear = await query(
        `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
         FROM exam_schedules es
         INNER JOIN exams e ON e.id = es.exam_id
         LEFT JOIN class_sections cs_rel ON cs_rel.id = es.class_section_id
         ${retryWhere} ${publishFilter}
         ORDER BY e.id DESC`,
        retryParams
      );
      if (retryNoYear.rows.length > 0) {
        return success(res, 200, 'Self exams loaded', { exams: retryNoYear.rows, students: availableStudents });
      }
    }

    if (parseId(selfStudent.student_id) && hasExamSchedules && schema.hasStudentPromotionsTable) {
      const promotedScope = await query(
        `SELECT to_class_id AS class_id, to_section_id AS section_id
         FROM student_promotions
         WHERE student_id = $1
           AND to_class_id IS NOT NULL
           AND to_section_id IS NOT NULL
         ORDER BY id DESC
         LIMIT 1`,
        [selfStudent.student_id]
      );
      const promotedClassId = parseId(promotedScope.rows?.[0]?.class_id);
      const promotedSectionId = parseId(promotedScope.rows?.[0]?.section_id);
      if (
        promotedClassId &&
        promotedSectionId &&
        (promotedClassId !== classId || promotedSectionId !== sectionId)
      ) {
        const promotedParams = [promotedClassId, promotedSectionId];
        let promotedWhere = 'WHERE es.class_id = $1 AND (cs_rel.section_id = $2 OR es.class_section_id IS NULL)';
        if (academicYearId) {
          promotedParams.push(academicYearId);
          promotedWhere += ` AND e.academic_year_id = $${promotedParams.length}`;
        }
        const promotedRows = await query(
          `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
           FROM exam_schedules es
           INNER JOIN exams e ON e.id = es.exam_id
           LEFT JOIN class_sections cs_rel ON cs_rel.id = es.class_section_id
           ${promotedWhere} ${publishFilter}
           ORDER BY e.id DESC`,
          promotedParams
        );
        if (promotedRows.rows.length > 0) {
          return success(res, 200, 'Self exams loaded', { exams: promotedRows.rows, students: availableStudents });
        }
      }
    }

    const params = [classId];
    let yearWhere = '';
    if (academicYearId) {
      params.push(academicYearId);
      yearWhere = ` AND e.academic_year_id = $${params.length}`;
    }
    let fallbackSql = '';
    if (schema.hasExamClassesTable) {
      fallbackSql = `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
         FROM exams e
         INNER JOIN exam_classes ec ON ec.exam_id = e.id
         WHERE ec.class_id = $1${yearWhere} ${publishFilter}
         ORDER BY e.id DESC`;
    } else if (schema.hasClassIdColumn) {
      fallbackSql = `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
         FROM exams e
         WHERE e.class_id = $1${yearWhere} ${publishFilter}
         ORDER BY e.id DESC`;
    }
 
    if (fallbackSql) {
      const fallback = await query(fallbackSql, params);
      return success(res, 200, 'Self exams loaded', { exams: fallback.rows || [], students: availableStudents });
    }

    return success(res, 200, 'Self exams loaded', { exams: [], students: availableStudents });
  } catch (e) {
    console.error('listSelfExamOptions', e);
    return error(res, 500, 'Failed to load self exams', e.message);
  }
}

async function saveExamSubjectSetup(req, res) {
  try {
    const { error: vErr, value } = saveSubjectSetupSchema.validate(req.body, { stripUnknown: true });
    if (vErr) return error(res, 400, vErr.details[0].message);

    const ctx = getAuthContext(req);
    const examInfo = await query('SELECT academic_year_id FROM exams WHERE id = $1', [value.exam_id]);
    const academicYearId = examInfo.rows[0]?.academic_year_id;

    if (!isAdmin(ctx) && isTeacherRole(ctx)) {
      const ok = await teacherCanAccessClassSection(ctx.userId, value.class_id, value.section_id, academicYearId);
      if (!ok) return error(res, 403, 'You are not allowed to edit this class section');
    }

    let classSectionId = null;
    if (value.section_id) {
      const sec = await query(
        'SELECT id FROM class_sections WHERE section_id = $1 AND class_id = $2 AND deleted_at IS NULL LIMIT 1',
        [value.section_id, value.class_id]
      );
      if (sec.rows.length) {
        classSectionId = sec.rows[0].id;
      }
    }

    await assertExamClassLinked(value.exam_id, value.class_id);
    await assertExamNotFinalized(value.exam_id);

    const classSubjects = await getClassSubjects(value.class_id, academicYearId);
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
    const subjectMetaMap = new Map(classSubjects.map((s) => [parseId(s.id), s]));
    const enrichedRows = value.rows.map((row) => {
      const meta = subjectMetaMap.get(parseId(row.subject_id));
      return {
        ...row,
        is_elective: !!meta?.is_elective,
        elective_group_id: meta?.elective_group_id || null,
      };
    });

    const slotErr = validateNoExamSlotCollision(enrichedRows);
    if (slotErr) return error(res, 400, slotErr);

    await executeTransaction(async (client) => {
      await client.query(
        `DELETE FROM exam_schedules WHERE exam_id = $1 AND class_id = $2 AND ${classSectionId ? 'class_section_id = $3' : 'class_section_id IS NULL'}`,
        classSectionId ? [value.exam_id, value.class_id, classSectionId] : [value.exam_id, value.class_id]
      );

      for (const row of value.rows) {
        await client.query(
          `INSERT INTO exam_schedules
           (exam_id, academic_year_id, class_id, class_section_id, class_subject_id, max_marks, passing_marks, exam_date, start_time, end_time, class_room_id, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            value.exam_id,
            academicYearId,
            value.class_id,
            classSectionId,
            row.subject_id,
            row.max_marks,
            row.passing_marks,
            row.exam_date || null,
            row.start_time || null,
            row.end_time || null,
            row.room_id || null,
            parseId(req.user?.id),
          ]
        );
      }
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
    const examInfo = await query('SELECT academic_year_id FROM exams WHERE id = $1', [value.exam_id]);
    const academicYearId = examInfo.rows[0]?.academic_year_id;

    const ok = await teacherCanAccessClassSection(ctx.userId, value.class_id, value.section_id, academicYearId);
    if (!ok) return error(res, 403, 'You are not allowed to edit this class section timetable');

    const dedup = new Set();
    for (const row of value.subjects) {
      const k = `${row.subject_id}`;
      if (dedup.has(k)) return error(res, 400, 'Duplicate subject in timetable payload');
      dedup.add(k);
      if (Number(row.passing_marks) > Number(row.max_marks)) return error(res, 400, 'Passing marks cannot exceed max marks');
    }
    const classSubjects = await getClassSubjects(value.class_id, academicYearId);
    const subjectMetaMap = new Map(classSubjects.map((s) => [parseId(s.id), s]));

    const enrichedSubjects = value.subjects.map((row) => {
      const meta = subjectMetaMap.get(parseId(row.subject_id));
      return {
        ...row,
        is_elective: !!meta?.is_elective,
        elective_group_id: meta?.elective_group_id || null,
      };
    });

    const slotErr = validateNoExamSlotCollision(enrichedSubjects);
    if (slotErr) return error(res, 400, slotErr);
    await assertExamClassLinked(value.exam_id, value.class_id);
    await assertExamNotFinalized(value.exam_id);
    const examSubjectsSchema = await getExamSubjectsSchemaFlags();

    let classSectionId = null;
    if (value.section_id) {
      const secRes = await query(
        'SELECT id FROM class_sections WHERE section_id = $1 AND class_id = $2 AND deleted_at IS NULL LIMIT 1',
        [value.section_id, value.class_id]
      );
      if (!secRes.rows.length) return error(res, 400, 'Invalid class and section combination');
      classSectionId = secRes.rows[0].id;
    }

    await executeTransaction(async (client) => {
      await client.query(
        `DELETE FROM exam_schedules WHERE exam_id = $1 AND class_id = $2 AND ${classSectionId ? 'class_section_id = $3' : 'class_section_id IS NULL'}`,
        classSectionId ? [value.exam_id, value.class_id, classSectionId] : [value.exam_id, value.class_id]
      );

      for (const row of value.subjects) {
        await client.query(
          `INSERT INTO exam_schedules (
            exam_id, academic_year_id, class_id, class_section_id, class_subject_id, 
            max_marks, passing_marks, exam_date, start_time, end_time, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            value.exam_id,
            academicYearId,
            value.class_id,
            classSectionId,
            row.subject_id,
            row.max_marks,
            row.passing_marks,
            row.exam_date || null,
            row.start_time || null,
            row.end_time || null,
            parseId(req.user?.id),
          ]
        );
      }
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

async function getExamMarksContext(req, res) {
  try {
    const { error: vErr, value } = examMarksContextSchema.validate(req.query, { stripUnknown: true });
    if (vErr) return error(res, 400, vErr.details[0].message);

    // Normalize empty strings to null for database safety
    if (value.section_id === "") value.section_id = null;

    const examInfo = await query('SELECT academic_year_id FROM exams WHERE id = $1', [value.exam_id]);
    const academicYearId = examInfo.rows[0]?.academic_year_id;

    const ctx = getAuthContext(req);
    if (!isAdmin(ctx) && isTeacherRole(ctx)) {
      const ok = await teacherCanAccessClassSection(ctx.userId, value.class_id, value.section_id, academicYearId);
      if (!ok) return error(res, 403, 'You are not allowed to manage marks for this class section');
    }
    await assertExamClassLinked(value.exam_id, value.class_id);
    await assertExamNotFinalized(value.exam_id);

    let classSectionId = null;
    if (value.section_id) {
      const secRes = await query(
        'SELECT id FROM class_sections WHERE section_id = $1 AND class_id = $2 AND deleted_at IS NULL LIMIT 1',
        [value.section_id, value.class_id]
      );
      if (secRes.rows.length) {
        classSectionId = secRes.rows[0].id;
      }
    }

    const subjects = await query(
      `SELECT es.id AS exam_schedule_id, es.class_subject_id AS subject_id, 
              sb.subject_name, sb.subject_code, sb.subject_type, 
              cs.is_elective, cs.elective_group_id,
              es.max_marks, es.passing_marks
       FROM exam_schedules es
       INNER JOIN class_subjects cs ON cs.id = es.class_subject_id
       INNER JOIN subjects sb ON sb.id = cs.subject_id
       WHERE es.exam_id = $1
         AND es.class_id = $2
         AND ${classSectionId ? 'es.class_section_id = $3' : 'es.class_section_id IS NULL'}
       ORDER BY cs.is_elective ASC, cs.elective_group_id, sb.subject_name ASC`,
      classSectionId ? [value.exam_id, value.class_id, classSectionId] : [value.exam_id, value.class_id]
    );
    if (!subjects.rows.length) {
      return success(res, 200, 'Timetable not found for selected exam/class/section', { subjects: [], students: [] });
    }

    const studentParams = [value.class_id];
    let studentSql = `
      SELECT st.id AS student_id,
             CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS student_name,
             st.roll_number
      FROM students st
      INNER JOIN users u ON u.id = st.user_id
      INNER JOIN LATERAL (
        SELECT to_class_id, to_section_id
        FROM student_lifecycle_ledger l
        WHERE l.student_id = st.id
    `;

    if (academicYearId) {
      studentParams.push(academicYearId);
      studentSql += ` AND l.to_academic_year_id = $${studentParams.length} `;
    }

    studentSql += `
        ORDER BY l.event_date DESC, l.id DESC
        LIMIT 1
      ) enr ON enr.to_class_id = $1
    `;

    if (value.section_id) {
      studentParams.push(value.section_id);
      studentSql += ` AND enr.to_section_id = $${studentParams.length} `;
    }

    studentSql += `
      WHERE st.status = 'Active'
      ORDER BY u.first_name ASC, u.last_name ASC
    `;

    const students = await query(studentSql, studentParams);

    const studentIds = students.rows.map((s) => parseId(s.student_id));
    const choices = await query(
      `SELECT student_id, class_subject_id
       FROM student_subject_choices
       WHERE student_id = ANY($1::int[])
         AND class_id = $2
         ${academicYearId ? 'AND academic_year_id = $3' : ''}
         AND deleted_at IS NULL`,
      academicYearId ? [studentIds, value.class_id, academicYearId] : [studentIds, value.class_id]
    );

    const choicesByStudent = new Map();
    for (const row of choices.rows) {
      const sid = parseId(row.student_id);
      if (!choicesByStudent.has(sid)) choicesByStudent.set(sid, new Set());
      choicesByStudent.get(sid).add(parseId(row.class_subject_id));
    }

    const marks = await query(
      `SELECT student_id, exam_schedule_id, marks_obtained, is_absent
       FROM exam_results
       WHERE exam_schedule_id = ANY($1::int[])
         AND student_id = ANY($2::int[])`,
      [
        subjects.rows.map((s) => parseId(s.exam_schedule_id)),
        studentIds,
      ]
    );

    const byKey = new Map();
    for (const row of marks.rows) {
      byKey.set(`${row.student_id}:${row.exam_schedule_id}`, row);
    }

    // Determine which subjects are "active" (Mandatory OR Selected by at least one student)
    const activeScheduleIds = new Set();
    for (const subject of subjects.rows) {
      if (!subject.is_elective) {
        activeScheduleIds.add(parseId(subject.exam_schedule_id));
        continue;
      }
      const classSubId = parseId(subject.subject_id);
      const isSelectedByAny = Array.from(choicesByStudent.values()).some((choiceSet) => choiceSet.has(classSubId));
      if (isSelectedByAny) {
        activeScheduleIds.add(parseId(subject.exam_schedule_id));
      }
    }

    const filteredSubjects = subjects.rows.filter((s) => activeScheduleIds.has(parseId(s.exam_schedule_id)));
    const hasHiddenElectives = subjects.rows.some(s => s.is_elective && !activeScheduleIds.has(parseId(s.exam_schedule_id)));

    const matrix = students.rows.map((student) => {
      const studentId = parseId(student.student_id);
      const studentChoices = choicesByStudent.get(studentId);

      const cells = filteredSubjects.map((subject) => {
        const mark = byKey.get(`${studentId}:${subject.exam_schedule_id}`);
        const classSubjectId = parseId(subject.subject_id);
        const isAvailable = !subject.is_elective || !!(studentChoices && studentChoices.has(classSubjectId));

        return {
          subject_id: classSubjectId,
          exam_schedule_id: parseId(subject.exam_schedule_id),
          is_absent: isAvailable ? !!mark?.is_absent : false,
          marks_obtained: isAvailable ? (mark?.is_absent ? null : (mark?.marks_obtained ?? null)) : null,
          max_marks: Number(subject.max_marks),
          passing_marks: Number(subject.passing_marks),
          is_elective: !!subject.is_elective,
          elective_group_id: parseId(subject.elective_group_id),
          is_available: isAvailable,
        };
      });

      return {
        student_id: studentId,
        student_name: student.student_name.trim(),
        roll_number: student.roll_number || null,
        cells,
      };
    });

    return success(res, 200, 'Marks context loaded', {
      subjects: filteredSubjects,
      students: matrix,
      has_hidden_electives: hasHiddenElectives
    });
  } catch (e) {
    console.error('getExamMarksContext', e);
    if (e?.statusCode) return error(res, e.statusCode, e.message);
    return error(res, 500, 'Failed to load marks context', e.message);
  }
}

async function saveExamMarks(req, res) {
  try {
    const { error: vErr, value } = saveExamMarksSchema.validate(req.body, { stripUnknown: true });
    const ctx = getAuthContext(req);
    const examInfo = await query('SELECT academic_year_id FROM exams WHERE id = $1', [value.exam_id]);
    const academicYearId = examInfo.rows[0]?.academic_year_id;

    if (!isAdmin(ctx) && isTeacherRole(ctx)) {
      const ok = await teacherCanAccessClassSection(ctx.userId, value.class_id, value.section_id, academicYearId);
      if (!ok) return error(res, 403, 'You are not allowed to manage marks for this class section');
    }
    await assertExamClassLinked(value.exam_id, value.class_id);
    await assertExamNotFinalized(value.exam_id);

    let classSectionId = null;
    if (value.section_id) {
      const secRes = await query(
        'SELECT id FROM class_sections WHERE section_id = $1 AND class_id = $2 AND deleted_at IS NULL LIMIT 1',
        [value.section_id, value.class_id]
      );
      if (secRes.rows.length) {
        classSectionId = secRes.rows[0].id;
      }
    }

    const timetable = await query(
      `SELECT es.id AS exam_schedule_id, es.class_subject_id AS subject_id, es.max_marks, cs.is_elective
       FROM exam_schedules es
       JOIN class_subjects cs ON cs.id = es.class_subject_id
       WHERE es.exam_id = $1 AND es.class_id = $2 AND ${classSectionId ? 'es.class_section_id = $3' : 'es.class_section_id IS NULL'}`,
      classSectionId ? [value.exam_id, value.class_id, classSectionId] : [value.exam_id, value.class_id]
    );
    if (!timetable.rows.length) {
      return error(res, 400, 'Timetable not found for selected exam/class/section');
    }
    const scheduleBySubjectId = new Map(timetable.rows.map((r) => [parseId(r.subject_id), r]));

    const payloadStudentIds = [...new Set(value.rows.map((r) => parseId(r.student_id)))];
    const choices = await query(
      `SELECT student_id, class_subject_id
       FROM student_subject_choices
       WHERE student_id = ANY($1::int[])
         AND class_id = $2
         ${academicYearId ? 'AND academic_year_id = $3' : ''}
         AND deleted_at IS NULL`,
      academicYearId ? [payloadStudentIds, value.class_id, academicYearId] : [payloadStudentIds, value.class_id]
    );
    const choicesByStudent = new Map();
    for (const row of choices.rows) {
      const sid = parseId(row.student_id);
      if (!choicesByStudent.has(sid)) choicesByStudent.set(sid, new Set());
      choicesByStudent.get(sid).add(parseId(row.class_subject_id));
    }

    const students = await query(
      `SELECT st.id
       FROM students st
       INNER JOIN LATERAL (
         SELECT to_class_id, to_section_id
         FROM student_lifecycle_ledger l
         WHERE l.student_id = st.id
           ${academicYearId ? 'AND l.to_academic_year_id = $3' : ''}
         ORDER BY l.event_date DESC, l.id DESC
         LIMIT 1
       ) enr ON enr.to_class_id = $1 ${value.section_id ? 'AND enr.to_section_id = $2' : ''}
       WHERE st.status = 'Active'`,
      academicYearId ? [value.class_id, value.section_id, academicYearId] : [value.class_id, value.section_id]
    );
    const allowedStudentIds = new Set(students.rows.map((s) => parseId(s.id)));

    for (const row of value.rows) {
      const schedule = scheduleBySubjectId.get(parseId(row.subject_id));
      if (!schedule) return error(res, 400, 'Payload contains subject outside timetable');
      if (!allowedStudentIds.has(parseId(row.student_id))) {
        return error(res, 400, 'Payload contains student outside selected class section');
      }

      if (schedule.is_elective) {
        const studentChoices = choicesByStudent.get(parseId(row.student_id));
        if (!studentChoices || !studentChoices.has(parseId(row.subject_id))) {
          return error(res, 400, `Student has not chosen elective subject (Subject ID: ${row.subject_id}, Student ID: ${row.student_id})`);
        }
      }

      if (row.is_absent) continue;
      if (row.marks_obtained == null) {
        return error(res, 400, 'Marks are required for non-absent entries');
      }
      if (Number(row.marks_obtained) > Number(schedule.max_marks)) {
        return error(res, 400, 'Marks obtained cannot exceed max marks');
      }
    }

    const staffRes = await query(
      `SELECT id FROM staff WHERE user_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [ctx.userId]
    );
    const staffId = staffRes.rows[0]?.id;
    if (!staffId) {
      return error(res, 403, 'Your account is not linked to a staff record. Only staff can enter marks.');
    }

    await executeTransaction(async (client) => {
      for (const row of value.rows) {
        const schedule = scheduleBySubjectId.get(parseId(row.subject_id));
        await client.query(
          `INSERT INTO exam_results (exam_schedule_id, student_id, marks_obtained, is_absent, entered_by, created_by)
           VALUES ($1, $2, $3, $4, $5, $5)
           ON CONFLICT (student_id, exam_schedule_id)
           DO UPDATE SET
             marks_obtained = EXCLUDED.marks_obtained,
             is_absent = EXCLUDED.is_absent,
             updated_at = NOW(),
             updated_by = EXCLUDED.created_by`,
          [
            schedule.exam_schedule_id,
            row.student_id,
            row.marks_obtained,
            row.is_absent || false,
            staffId,
          ]
        );
      }
    });

    return success(res, 200, 'Marks saved successfully');
  } catch (e) {
    console.error('saveExamMarks', e);
    if (e?.statusCode) return error(res, e.statusCode, e.message);
    return error(res, 500, 'Failed to save marks', e.message);
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
      const insertCols = ['exam_name', 'exam_type', 'academic_year_id', 'description', 'is_published'];
      const insertVals = [
        value.exam_name,
        value.exam_type,
        value.academic_year_id || null,
        value.description || null,
        value.is_published ?? false,
      ];
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
         RETURNING id, exam_name, exam_type, academic_year_id, description, is_published, created_at`,
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

      // Defensive explicit deletes so legacy schemas also remain clean.
      await client.query(`DELETE FROM exam_results WHERE exam_schedule_id IN (SELECT id FROM exam_schedules WHERE exam_id = $1)`, [examId]);
      await client.query(`DELETE FROM exam_schedules WHERE exam_id = $1`, [examId]);
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

async function updateExam(req, res) {
  try {
    const examId = parseId(req.params.id);
    if (!examId) return error(res, 400, 'Invalid exam ID');

    const { error: vErr, value } = updateExamSchema.validate(req.body, { stripUnknown: true });
    if (vErr) return error(res, 400, vErr.details[0].message);

    const ctx = getAuthContext(req);
    if (!isAdmin(ctx)) return error(res, 403, 'Permission denied');

    const updates = [];
    const params = [];
    let idx = 1;

    if (value.exam_name !== undefined) {
      updates.push(`exam_name = $${idx++}`);
      params.push(value.exam_name);
    }
    if (value.exam_type !== undefined) {
      updates.push(`exam_type = $${idx++}`);
      params.push(value.exam_type);
    }
    if (value.description !== undefined) {
      updates.push(`description = $${idx++}`);
      params.push(value.description);
    }
    if (value.is_published !== undefined) {
      updates.push(`is_published = $${idx++}`);
      params.push(value.is_published);
    }

    if (!updates.length) return error(res, 400, 'No fields to update');

    params.push(examId);
    const result = await query(
      `UPDATE exams SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      params
    );

    if (!result.rows.length) return error(res, 404, 'Exam not found');

    return success(res, 200, 'Exam updated', result.rows[0]);
  } catch (e) {
    console.error('updateExam', e);
    return error(res, 500, 'Failed to update exam');
  }
}

module.exports = {
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
  getExamSchemaFlags,
  listSelfExamOptions,
  updateExam,
};

