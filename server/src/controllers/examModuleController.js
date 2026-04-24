const Joi = require('joi');
const { executeTransaction, query } = require('../config/database');
const { success, error } = require('../utils/responseHelper');
const { getAuthContext, isAdmin, parseId, isTeacherRole } = require('../utils/accessControl');
const { ROLES } = require('../config/roles');
const { getParentsForUser } = require('../utils/parentUserMatch');
const {
  DEFAULT_GRADE_SCALE,
  loadActiveGradeScale,
  getGradeFromScale,
  isMissingTableError,
} = require('../utils/gradeScaleService');

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
    const scaleRows = await loadActiveGradeScale();
    const rows = scaleRows.map((item, idx) => ({
      id: item.id ?? idx + 1,
      grade: item.grade,
      min_percentage: Number(item.min_percentage),
      max_percentage: Number(item.max_percentage),
      percentage_label: `${Number(item.min_percentage)}% - ${Math.floor(Number(item.max_percentage))}%`,
      status: item.is_active === false ? 'Inactive' : 'Active',
    }));
    return success(res, 200, 'Grade scale fetched', rows, { count: rows.length });
  } catch (e) {
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

function validateNoGradeOverlap(rows, currentId = null) {
  const activeRows = (rows || []).filter((r) => r.is_active !== false && Number(r.id) !== Number(currentId));
  for (let i = 0; i < activeRows.length; i += 1) {
    const a = activeRows[i];
    const aMin = Number(a.min_percentage);
    const aMax = Number(a.max_percentage);
    for (let j = i + 1; j < activeRows.length; j += 1) {
      const b = activeRows[j];
      const bMin = Number(b.min_percentage);
      const bMax = Number(b.max_percentage);
      if (aMin <= bMax && bMin <= aMax) {
        return `Grade ranges overlap between "${a.grade}" and "${b.grade}"`;
      }
    }
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
      const allRowsRes = await client.query(
        `SELECT
           id,
           grad AS grade,
           min_precentage AS min_percentage,
           max_precentage AS max_percentage,
           is_active
         FROM exam_grade`
      );
      const allRows = allRowsRes.rows || [];
      const conflict = validateNoGradeOverlap(
        [...allRows, { ...value, id: -1 }],
        null
      );
      if (value.is_active !== false && conflict) {
        const errObj = new Error(conflict);
        errObj.statusCode = 409;
        throw errObj;
      }
      const ins = await client.query(
        `INSERT INTO exam_grade (grad, min_precentage, max_precentage, is_active)
         VALUES ($1, $2, $3, $4)
         RETURNING
           id,
           grad AS grade,
           min_precentage AS min_percentage,
           max_precentage AS max_percentage,
           is_active,
           created_at,
           modified_at`,
        [
          value.grade,
          Number(value.min_percentage),
          Number(value.max_percentage),
          value.is_active !== false,
        ]
      );
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
      const exists = await client.query('SELECT id FROM exam_grade WHERE id = $1 LIMIT 1', [gradeId]);
      if (!exists.rows.length) {
        const errObj = new Error('Grade scale not found');
        errObj.statusCode = 404;
        throw errObj;
      }
      const allRowsRes = await client.query(
        `SELECT
           id,
           grad AS grade,
           min_precentage AS min_percentage,
           max_precentage AS max_percentage,
           is_active
         FROM exam_grade`
      );
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
      const conflict = validateNoGradeOverlap(allRows, gradeId);
      if (value.is_active !== false && conflict) {
        const errObj = new Error(conflict);
        errObj.statusCode = 409;
        throw errObj;
      }
      const upd = await client.query(
        `UPDATE exam_grade
         SET grad = $1,
             min_precentage = $2,
             max_precentage = $3,
             is_active = $4,
             modified_at = NOW()
         WHERE id = $5
         RETURNING
           id,
           grad AS grade,
           min_precentage AS min_percentage,
           max_precentage AS max_percentage,
           is_active,
           created_at,
           modified_at`,
        [
          value.grade,
          Number(value.min_percentage),
          Number(value.max_percentage),
          value.is_active !== false,
          gradeId,
        ]
      );
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
    const del = await query(
      `DELETE FROM exam_grade WHERE id = $1 RETURNING id`,
      [gradeId]
    );
    if (!del.rows.length) return error(res, 404, 'Grade scale not found');
    const remaining = await query(`SELECT COUNT(*)::int AS c FROM exam_grade WHERE is_active = true`);
    if (Number(remaining.rows?.[0]?.c || 0) === 0) {
      // Never allow all active rows to be deleted; restore defaults for safe grading.
      for (const item of DEFAULT_GRADE_SCALE) {
        await query(
          `INSERT INTO exam_grade (grad, min_precentage, max_precentage, is_active)
           VALUES ($1, $2, $3, true)
           ON CONFLICT DO NOTHING`,
          [item.grade, item.min_percentage, item.max_percentage]
        );
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
  const [tableCheck, colCheck] = await Promise.all([
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
  ]);

  const cols = new Set((colCheck.rows || []).map((r) => String(r.column_name)));
  return {
    hasExamClassesTable: !!tableCheck.rows?.[0]?.exam_classes_table,
    hasIsActiveColumn: cols.has('is_active'),
    hasClassIdColumn: cols.has('class_id'),
    hasCreatedByColumn: cols.has('created_by'),
    hasIsFinalizedColumn: cols.has('is_finalized'),
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
         AND column_name IN ('created_by', 'modified_at', 'exam_component')`
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
    hasModifiedAtColumn: cols.has('modified_at'),
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
         WHERE st.user_id = $1 AND st.is_active = true`,
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
                )
                OR EXISTS (
                  SELECT 1
                  FROM classes c_map
                  WHERE c_map.id = ec2.class_id
                    AND (c_map.class_teacher_id = ANY($${teacherIdsIdx}::int[]) OR c_map.class_teacher_id = ANY($${staffIdsIdx}::int[]))
                )
                OR EXISTS (
                  SELECT 1
                  FROM sections s_map
                  WHERE s_map.class_id = ec2.class_id
                    AND s_map.section_teacher_id = ANY($${staffIdsIdx}::int[])
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
            )
            OR EXISTS (
              SELECT 1
              FROM classes c_map
              WHERE c_map.id = e.class_id
                AND (c_map.class_teacher_id = ANY($${teacherIdsIdx}::int[]) OR c_map.class_teacher_id = ANY($${staffIdsIdx}::int[]))
            )
            OR EXISTS (
              SELECT 1
              FROM sections s_map
              WHERE s_map.class_id = e.class_id
                AND s_map.section_teacher_id = ANY($${staffIdsIdx}::int[])
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
    `SELECT t.id AS teacher_id, t.staff_id
     FROM teachers t
     INNER JOIN staff st ON st.id = t.staff_id
     WHERE st.user_id = $1 AND st.is_active = true`,
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
  const p = [classId, sectionId, teacherIds, staffIds];
  const check = await query(
    `SELECT 1
     WHERE
      EXISTS (
        SELECT 1 FROM sections s
        WHERE s.id = $2 AND s.class_id = $1
          AND s.section_teacher_id = ANY($4::int[])
      )
      OR EXISTS (
        SELECT 1 FROM class_schedules cs
        WHERE cs.class_id = $1
          AND (cs.section_id = $2 OR cs.section_id IS NULL)
          AND cs.teacher_id = ANY($3::int[])
      )
      OR EXISTS (
        SELECT 1 FROM classes c
        WHERE c.id = $1
          AND (c.class_teacher_id = ANY($3::int[]) OR c.class_teacher_id = ANY($4::int[]))
      )`,
    p
  );
  return check.rows.length > 0;
}

async function getClassSubjects(classId) {
  const r = await query(
    `SELECT id, subject_name, subject_code, COALESCE(theory_hours, 0) AS theory_hours, COALESCE(practical_hours, 0) AS practical_hours
     FROM subjects
     WHERE class_id = $1
       AND COALESCE(is_active, true) = true
     ORDER BY subject_name ASC`,
    [classId]
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
      const sectionRows = await query(
        `SELECT s.id AS section_id, s.section_name, s.class_id
         FROM sections s
         WHERE s.class_id = ANY($1::int[])
           AND (
             s.section_teacher_id = ANY($2::int[])
             OR EXISTS (
               SELECT 1 FROM class_schedules cs
               WHERE cs.class_id = s.class_id
                 AND (cs.section_id = s.id OR cs.section_id IS NULL)
                 AND cs.teacher_id = ANY($3::int[])
             )
             OR EXISTS (
               SELECT 1 FROM classes c
               WHERE c.id = s.class_id
                 AND (c.class_teacher_id = ANY($3::int[]) OR c.class_teacher_id = ANY($2::int[]))
             )
           )
         ORDER BY s.section_name`,
        [classMap.map((x) => x.class_id).filter(Boolean), staffIds, teacherIds]
      );
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
      const sec = await query(
        `SELECT id AS section_id, section_name, class_id
         FROM sections
         WHERE class_id = ANY($1::int[])
         ORDER BY section_name`,
        [classMap.map((x) => x.class_id).filter(Boolean)]
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

    const r = await query(
      `SELECT es.id, es.subject_id, s.subject_name, es.max_marks, es.passing_marks, es.exam_date, es.start_time, es.end_time
       FROM exam_subjects es
       INNER JOIN subjects s ON s.id = es.subject_id
       WHERE es.exam_id = $1 AND es.class_id = $2 AND es.section_id = $3
       ORDER BY s.subject_name`,
      [examId, classId, sectionId]
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

    const r = await query(
      `SELECT id, subject_name
       FROM subjects
       WHERE class_id = $1 AND COALESCE(is_active, true) = true
       ORDER BY subject_name ASC`,
      [classId]
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
    if (!examId || !classId || !sectionId) {
      return error(res, 400, 'exam_id, class_id and section_id are required');
    }

    // Section must belong to class (prevents cross-class leakage)
    const sec = await query(
      `SELECT id FROM sections WHERE id = $1 AND class_id = $2 LIMIT 1`,
      [sectionId, classId]
    );
    if (!sec.rows.length) return error(res, 400, 'Invalid class and section combination');

    const ctx = getAuthContext(req);
    if (isTeacherRole(ctx)) {
      const ok = await teacherCanAccessClassSection(ctx.userId, classId, sectionId);
      if (!ok) return error(res, 403, 'You are not allowed to access this class section');
    }

    const classSubjects = await getClassSubjects(classId);
    if (!classSubjects.length) {
      return success(res, 200, 'No subjects found for selected class', {
        subjects: [],
        timetable_rows: [],
      });
    }

    const existing = await query(
      `SELECT subject_id, max_marks, passing_marks, exam_date, start_time, end_time
       FROM exam_subjects
       WHERE exam_id = $1 AND class_id = $2 AND section_id = $3`,
      [examId, classId, sectionId]
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

async function resolveStudentScopeByUser(ctx) {
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
         ON COALESCE(s2.is_active, true) = true
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

  const normalizeToLatestStudentRecord = async (row) => {
    const studentId = parseId(row?.student_id);
    if (!studentId) return row || null;
    const resolvedId = await resolveLatestLinkedStudentId(studentId);

    const latest = await query(
      `SELECT s2.id AS student_id, s2.class_id, s2.section_id
       FROM students s2
       WHERE s2.id = $1
       LIMIT 1`,
      [resolvedId]
    );
    return latest.rows?.[0] || row;
  };

  const enrichScopeFromAttendance = async (row) => {
    const normalizedRow = await normalizeToLatestStudentRecord(row);
    if (!normalizedRow?.student_id) return normalizedRow || null;
    const baseClassId = parseId(normalizedRow.class_id);
    const baseSectionId = parseId(normalizedRow.section_id);

    // Prefer latest promotion target class/section when available.
    // This avoids stale students.class_id/section_id mappings.
    const promotion = await query(
      `SELECT to_class_id AS class_id, to_section_id AS section_id
       FROM student_promotions
       WHERE student_id = $1
         AND to_class_id IS NOT NULL
         AND to_section_id IS NOT NULL
       ORDER BY id DESC
       LIMIT 1`,
      [normalizedRow.student_id]
    );
    if (promotion.rows.length) {
      return {
        ...normalizedRow,
        class_id: promotion.rows[0].class_id,
        section_id: promotion.rows[0].section_id,
      };
    }

    if (baseClassId && baseSectionId) {
      return normalizedRow;
    }

    // Fallback 2: derive from latest attendance.
    const fallback = await query(
      `SELECT class_id, section_id
       FROM attendance
       WHERE student_id = $1
         AND class_id IS NOT NULL
         AND section_id IS NOT NULL
       ORDER BY attendance_date DESC NULLS LAST, id DESC
       LIMIT 1`,
      [normalizedRow.student_id]
    );
    if (!fallback.rows.length) return normalizedRow;
    return {
      ...normalizedRow,
      class_id: normalizedRow.class_id || fallback.rows[0].class_id,
      section_id: normalizedRow.section_id || fallback.rows[0].section_id,
    };
  };

  if (!ctx?.userId) return null;
  if (ctx.roleId === ROLES.STUDENT || ctx.roleName === 'student') {
    let s = await query(
      `SELECT id AS student_id, class_id, section_id
       FROM students
       WHERE user_id = $1 AND COALESCE(is_active, true) = true
       ORDER BY id DESC
       LIMIT 1`,
      [ctx.userId]
    );
    return enrichScopeFromAttendance(s.rows[0] || null);
  }
  if (ctx.roleId === ROLES.PARENT || ctx.roleName === 'parent') {
    // Legacy direct mapping first.
    let s = await query(
      `SELECT s.id AS student_id, s.class_id, s.section_id
       FROM parents p
       INNER JOIN students s ON s.id = p.student_id
       WHERE p.user_id = $1
         AND COALESCE(s.is_active, true) = true
       ORDER BY s.id DESC
       LIMIT 1`,
      [ctx.userId]
    );
    if (!s.rows.length) {
      // Canonical resolver: guardians + legacy parents matching by identity.
      const linked = await getParentsForUser(ctx.userId).catch(() => ({ studentIds: [] }));
      const sid = await resolveLatestLinkedStudentId(linked.studentIds?.[0]);
      if (sid) {
        s = await query(
          `SELECT id AS student_id, class_id, section_id
           FROM students
           WHERE id = $1
             AND COALESCE(is_active, true) = true
           LIMIT 1`,
          [sid]
        );
      }
    }
    return enrichScopeFromAttendance(s.rows[0] || null);
  }
  if (ctx.roleId === ROLES.GUARDIAN || ctx.roleName === 'guardian') {
    let s = await query(
      `SELECT s.id AS student_id, s.class_id, s.section_id
       FROM guardians g
       INNER JOIN students s ON s.id = g.student_id
       WHERE g.user_id = $1
         AND COALESCE(s.is_active, true) = true
       ORDER BY s.id DESC
       LIMIT 1`,
      [ctx.userId]
    );
    if (!s.rows.length) {
      const linked = await getParentsForUser(ctx.userId).catch(() => ({ studentIds: [] }));
      const sid = await resolveLatestLinkedStudentId(linked.studentIds?.[0]);
      if (sid) {
        s = await query(
          `SELECT id AS student_id, class_id, section_id
           FROM students
           WHERE id = $1
             AND COALESCE(is_active, true) = true
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

    if (!classId || !sectionId) {
      return error(res, 400, 'class_id and section_id are required');
    }

    const sec = await query(
      `SELECT id FROM sections WHERE id = $1 AND class_id = $2 LIMIT 1`,
      [sectionId, classId]
    );
    if (!sec.rows.length) return error(res, 400, 'Invalid class and section combination');

    if (isTeacherRole(ctx)) {
      const ok = await teacherCanAccessClassSection(ctx.userId, classId, sectionId);
      if (!ok) return error(res, 403, 'You are not allowed to view this class section timetable');
    }

    const params = [classId, sectionId];
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
         ${examFilter}
       ORDER BY e.created_at DESC, es.exam_date ASC NULLS LAST, es.start_time ASC NULLS LAST, s.subject_name ASC`,
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

    const selfStudent = await resolveStudentScopeByUser(ctx);
    if (selfStudent) {
      const studentId = parseId(selfStudent.student_id);
      if (!studentId) return success(res, 200, 'Result loaded', []);

      const rows = await query(
        `SELECT
           st.id AS student_id,
           CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, '')) AS student_name,
           es.subject_id,
           sb.subject_name,
           sb.subject_code,
           er.marks_obtained,
           COALESCE(er.is_absent, false) AS is_absent,
           es.max_marks,
           es.passing_marks
         FROM students st
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

    if (!classId || !sectionId) {
      return error(res, 400, 'class_id and section_id are required');
    }

    if (isTeacherRole(ctx)) {
      const ok = await teacherCanAccessClassSection(ctx.userId, classId, sectionId);
      if (!ok) return error(res, 403, 'You are not allowed to view this class section result');
    }

    const rows = await query(
      `WITH subject_plan AS (
         SELECT subject_id, max_marks, passing_marks
         FROM exam_subjects
         WHERE exam_id = $1 AND class_id = $2 AND section_id = $3
       )
       SELECT
         st.id AS student_id,
         CONCAT(COALESCE(st.first_name, ''), ' ', COALESCE(st.last_name, '')) AS student_name,
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
       LEFT JOIN subject_plan sp ON TRUE
       LEFT JOIN exam_results er
         ON er.exam_id = $1
        AND er.student_id = st.id
        AND er.subject_id = sp.subject_id
       WHERE st.class_id = $2
         AND st.section_id = $3
       GROUP BY st.id, st.first_name, st.last_name
       ORDER BY st.first_name ASC, st.last_name ASC`,
      [examId, classId, sectionId]
    );
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

    let allowedScopes = [];
    if (isAdmin(ctx)) {
      const scopeRes = await query(
        `SELECT DISTINCT class_id, section_id
         FROM exam_subjects
         WHERE exam_id = $1
           AND class_id IS NOT NULL
           AND section_id IS NOT NULL`,
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
        `SELECT DISTINCT es.class_id, es.section_id
         FROM exam_subjects es
         WHERE es.exam_id = $1
           AND es.class_id IS NOT NULL
           AND es.section_id IS NOT NULL
           AND (
             EXISTS (
               SELECT 1 FROM sections s
               WHERE s.id = es.section_id
                 AND s.class_id = es.class_id
                 AND s.section_teacher_id = ANY($2::int[])
             )
             OR EXISTS (
               SELECT 1 FROM class_schedules cs
               WHERE cs.class_id = es.class_id
                 AND (cs.section_id = es.section_id OR cs.section_id IS NULL)
                 AND cs.teacher_id = ANY($3::int[])
             )
             OR EXISTS (
               SELECT 1 FROM classes c
               WHERE c.id = es.class_id
                 AND (c.class_teacher_id = ANY($3::int[]) OR c.class_teacher_id = ANY($2::int[]))
             )
           )`,
        [examId, staffIds, teacherIds]
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
    const examParamIdx = scopeParams.length + 1;
    const rowsRes = await query(
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
           st.photo_url,
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
         WHERE COALESCE(st.is_active, true) = true
         GROUP BY st.id, st.first_name, st.last_name, st.photo_url, st.class_id, st.section_id
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

async function listSelfExamOptions(req, res) {
  try {
    const ctx = getAuthContext(req);
    const selfStudent = await resolveStudentScopeByUser(ctx);
    if (!selfStudent) return success(res, 200, 'Self exams loaded', []);
    const classId = parseId(selfStudent.class_id);
    const sectionId = parseId(selfStudent.section_id);
    if (!classId) return success(res, 200, 'Self exams loaded', []);
    const academicYearId = req.query.academic_year_id ? parseId(req.query.academic_year_id) : null;
    const esParams = [classId];
    let esWhere = 'WHERE es.class_id = $1';
    if (sectionId) {
      esParams.push(sectionId);
      esWhere += ` AND es.section_id = $${esParams.length}`;
    }
    if (academicYearId) {
      esParams.push(academicYearId);
      esWhere += ` AND e.academic_year_id = $${esParams.length}`;
    }
    const fromExamSubjects = await query(
      `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
       FROM exam_subjects es
       INNER JOIN exams e ON e.id = es.exam_id
       ${esWhere}
       ORDER BY e.id DESC`,
      esParams
    );
    if (fromExamSubjects.rows.length > 0) {
      return success(res, 200, 'Self exams loaded', fromExamSubjects.rows);
    }

    if (academicYearId) {
      const retryParams = [classId];
      let retryWhere = 'WHERE es.class_id = $1';
      if (sectionId) {
        retryParams.push(sectionId);
        retryWhere += ` AND es.section_id = $${retryParams.length}`;
      }
      const retryNoYear = await query(
        `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
         FROM exam_subjects es
         INNER JOIN exams e ON e.id = es.exam_id
         ${retryWhere}
         ORDER BY e.id DESC`,
        retryParams
      );
      if (retryNoYear.rows.length > 0) {
        return success(res, 200, 'Self exams loaded', retryNoYear.rows);
      }
    }

    if (parseId(selfStudent.student_id)) {
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
        let promotedWhere = 'WHERE es.class_id = $1 AND es.section_id = $2';
        if (academicYearId) {
          promotedParams.push(academicYearId);
          promotedWhere += ` AND e.academic_year_id = $${promotedParams.length}`;
        }
        const promotedRows = await query(
          `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
           FROM exam_subjects es
           INNER JOIN exams e ON e.id = es.exam_id
           ${promotedWhere}
           ORDER BY e.id DESC`,
          promotedParams
        );
        if (promotedRows.rows.length > 0) {
          return success(res, 200, 'Self exams loaded', promotedRows.rows);
        }
      }
    }

    const schema = await getExamSchemaFlags();
    const params = [classId];
    let yearWhere = '';
    if (academicYearId) {
      params.push(academicYearId);
      yearWhere = ` AND e.academic_year_id = $${params.length}`;
    }
    const fallbackSql = schema.hasExamClassesTable
      ? `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
         FROM exams e
         INNER JOIN exam_classes ec ON ec.exam_id = e.id
         WHERE ec.class_id = $1${yearWhere}
         ORDER BY e.id DESC`
      : `SELECT DISTINCT e.id, e.exam_name, e.exam_type, e.academic_year_id
         FROM exams e
         WHERE e.class_id = $1${yearWhere}
         ORDER BY e.id DESC`;

    const fallback = await query(fallbackSql, params);
    return success(res, 200, 'Self exams loaded', fallback.rows || []);
  } catch (e) {
    console.error('listSelfExamOptions', e);
    return error(res, 500, 'Failed to load self exams');
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

    const sec = await query(
      `SELECT id FROM sections WHERE id = $1 AND class_id = $2 LIMIT 1`,
      [value.section_id, value.class_id]
    );
    if (!sec.rows.length) return error(res, 400, 'Invalid class and section combination');
    await assertExamClassLinked(value.exam_id, value.class_id);
    await assertExamNotFinalized(value.exam_id);

    const classSubjects = await getClassSubjects(value.class_id);
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
      await client.query(
        `DELETE FROM exam_subjects WHERE exam_id = $1 AND class_id = $2 AND section_id = $3`,
        [value.exam_id, value.class_id, value.section_id]
      );

      for (const row of value.rows) {
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
               modified_at = NOW()`,
            [
              value.exam_id,
              value.class_id,
              value.section_id,
              row.subject_id,
              row.max_marks,
              row.passing_marks,
              row.exam_date || null,
              row.start_time || null,
              row.end_time || null,
              parseId(req.user?.id),
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
               modified_at = NOW()`,
            [
              value.exam_id,
              value.class_id,
              value.section_id,
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
    const examSubjectsSchema = await getExamSubjectsSchemaFlags();

    await executeTransaction(async (client) => {
      await client.query(
        `DELETE FROM exam_subjects WHERE exam_id = $1 AND class_id = $2 AND section_id = $3`,
        [value.exam_id, value.class_id, value.section_id]
      );
      for (const row of value.subjects) {
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
               modified_at = NOW()`,
            [
              value.exam_id,
              value.class_id,
              value.section_id,
              row.subject_id,
              row.max_marks,
              row.passing_marks,
              row.exam_date || null,
              row.start_time || null,
              row.end_time || null,
              parseId(req.user?.id),
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
               modified_at = NOW()`,
            [
              value.exam_id,
              value.class_id,
              value.section_id,
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

    const ctx = getAuthContext(req);
    const ok = await teacherCanAccessClassSection(ctx.userId, value.class_id, value.section_id);
    if (!ok) return error(res, 403, 'You are not allowed to manage marks for this class section');
    await assertExamClassLinked(value.exam_id, value.class_id);
    await assertExamNotFinalized(value.exam_id);

    const subjects = await query(
      `SELECT es.subject_id, sb.subject_name, sb.subject_code, es.max_marks, es.passing_marks
       FROM exam_subjects es
       INNER JOIN subjects sb ON sb.id = es.subject_id
       WHERE es.exam_id = $1
         AND es.class_id = $2
         AND es.section_id = $3
       ORDER BY sb.subject_name ASC`,
      [value.exam_id, value.class_id, value.section_id]
    );
    if (!subjects.rows.length) {
      return error(res, 400, 'Timetable not found for selected exam/class/section');
    }

    const students = await query(
      `SELECT id AS student_id,
              CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) AS student_name,
              roll_number
       FROM students
       WHERE class_id = $1
         AND section_id = $2
         AND COALESCE(is_active, true) = true
       ORDER BY first_name ASC, last_name ASC`,
      [value.class_id, value.section_id]
    );

    const marks = await query(
      `SELECT student_id, subject_id, marks_obtained, is_absent
       FROM exam_results
       WHERE exam_id = $1
         AND student_id = ANY($2::int[])
         AND subject_id = ANY($3::int[])`,
      [
        value.exam_id,
        students.rows.map((s) => parseId(s.student_id)),
        subjects.rows.map((s) => parseId(s.subject_id)),
      ]
    );

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
      return {
        student_id: parseId(student.student_id),
        student_name: student.student_name.trim(),
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

    const subjects = await query(
      `SELECT subject_id, max_marks, passing_marks
       FROM exam_subjects
       WHERE exam_id = $1
         AND class_id = $2
         AND section_id = $3`,
      [value.exam_id, value.class_id, value.section_id]
    );
    if (!subjects.rows.length) return error(res, 400, 'Timetable not found for selected exam/class/section');
    const subjectMap = new Map(subjects.rows.map((s) => [parseId(s.subject_id), s]));

    const students = await query(
      `SELECT id FROM students
       WHERE class_id = $1
         AND section_id = $2
         AND COALESCE(is_active, true) = true`,
      [value.class_id, value.section_id]
    );
    const allowedStudentIds = new Set(students.rows.map((s) => parseId(s.id)));
    const examResultsSchema = await getExamResultsSchemaFlags();
    const conflictTarget = examResultsSchema.hasExamComponentColumn && examResultsSchema.hasUniqueExamStudentSubjectComponent
      ? '(exam_id, student_id, subject_id, exam_component)'
      : examResultsSchema.hasUniqueExamStudentSubject
        ? '(exam_id, student_id, subject_id)'
        : null;
    if (!conflictTarget) {
      return error(
        res,
        500,
        'exam_results unique key for marks upsert is missing. Apply exam module migrations before saving marks.'
      );
    }

    for (const row of value.rows) {
      const subject = subjectMap.get(parseId(row.subject_id));
      if (!subject) return error(res, 400, 'Payload contains subject outside timetable');
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
        const marksValue = row.is_absent ? null : Number(row.marks_obtained);
        const insertColumns = ['exam_id', 'student_id', 'subject_id', 'marks_obtained', 'is_absent'];
        const insertValues = [
          value.exam_id,
          row.student_id,
          row.subject_id,
          marksValue,
          !!row.is_absent,
        ];
        if (examResultsSchema.hasExamComponentColumn) {
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
          updateSet.push('modified_at = NOW()');
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

      // Defensive explicit deletes so legacy schemas also remain clean.
      await client.query(`DELETE FROM exam_results WHERE exam_id = $1`, [examId]);
      await client.query(`DELETE FROM exam_subjects WHERE exam_id = $1`, [examId]);
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

