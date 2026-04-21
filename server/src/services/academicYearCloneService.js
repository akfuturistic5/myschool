const MODULE_KEYS = [
  'classes',
  'sections',
  'subjects',
  'teacherAssignments',
  'timetable',
  'departments',
  'designations',
  'transport',
];

const DEFAULT_COPY_OPTIONS = Object.freeze({
  classes: false,
  sections: false,
  subjects: false,
  teacherAssignments: false,
  timetable: false,
  departments: false,
  designations: false,
  transport: false,
});

function normalizeBool(v, fallback = false) {
  if (v === true || v === 'true' || v === 1 || v === '1' || v === 't' || v === 'T') return true;
  if (v === false || v === 'false' || v === 0 || v === '0' || v === 'f' || v === 'F') return false;
  return fallback;
}

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function normalizeCopyOptions(input) {
  const base = { ...DEFAULT_COPY_OPTIONS };
  const src = input && typeof input === 'object' ? input : {};
  for (const key of MODULE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(src, key)) {
      base[key] = normalizeBool(src[key], false);
    }
  }

  // Global/master modules: always auto-available, never user-selected for cloning.
  base.departments = false;
  base.designations = false;
  base.transport = false;

  return base;
}

function anyCopySelected(options) {
  return MODULE_KEYS.some((k) => options[k] === true);
}

function makeCloneError(status, code, message, details) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (details !== undefined) err.details = details;
  return err;
}

function normText(v) {
  return String(v || '').trim().toLowerCase();
}

async function tableExists(client, tableName) {
  const r = await client.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = $1
     LIMIT 1`,
    [String(tableName || '').trim()]
  );
  return r.rows.length > 0;
}

async function columnExists(client, tableName, columnName) {
  const r = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2
     LIMIT 1`,
    [String(tableName || '').trim(), String(columnName || '').trim()]
  );
  return r.rows.length > 0;
}

async function getColumnMaxLength(client, tableName, columnName) {
  const r = await client.query(
    `SELECT character_maximum_length
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2
     LIMIT 1`,
    [String(tableName || '').trim(), String(columnName || '').trim()]
  );
  const n = Number(r.rows?.[0]?.character_maximum_length);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function makeCode(base, maxLen, suffix) {
  const trimmed = String(base || '')
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  const fallback = 'CODE';
  const root = (trimmed || fallback).slice(0, Math.max(1, maxLen - suffix.length));
  return `${root}${suffix}`.slice(0, maxLen);
}

async function codeExists(client, tableName, columnName, code) {
  if (!code) return false;
  const r = await client.query(
    `SELECT 1 FROM ${tableName} WHERE ${columnName} = $1 LIMIT 1`,
    [code]
  );
  return r.rows.length > 0;
}

async function makeUniqueCode(client, tableName, columnName, preferred, maxLen, seed) {
  const first = String(preferred || '')
    .trim()
    .slice(0, Math.max(1, Number(maxLen) || 1));
  if (first && !(await codeExists(client, tableName, columnName, first))) return first;

  const suffixSeed = String(seed || 'Y').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'Y';
  for (let i = 0; i < 200; i += 1) {
    const suffix = i === 0 ? suffixSeed : `${suffixSeed}${i}`;
    const candidate = makeCode(first || 'CODE', maxLen, suffix);
    if (!(await codeExists(client, tableName, columnName, candidate))) return candidate;
  }
  return null;
}

async function cloneDepartments(client, createdByStaffId, targetYearId) {
  const map = new Map();
  let insertedCount = 0;
  const rowsRes = await client.query(
    `SELECT id, department_name, department_code, head_of_department, description, is_active
     FROM departments
     ORDER BY id ASC`
  );

  for (const row of rowsRes.rows) {
    const existing = await client.query(
      `SELECT id
       FROM departments
       WHERE LOWER(TRIM(department_name)) = LOWER(TRIM($1))
       LIMIT 1`,
      [row.department_name]
    );
    if (existing.rows.length) {
      const existingRow = await client.query(
        `SELECT id, department_code, description, is_active
         FROM departments
         WHERE id = $1`,
        [existing.rows[0].id]
      );
      const ex = existingRow.rows[0];
      if (
        normText(ex?.department_code) !== normText(row.department_code) ||
        normText(ex?.description) !== normText(row.description)
      ) {
        throw makeCloneError(
          409,
          'ACADEMIC_YEAR_CLONE_DEPARTMENT_CONFLICT',
          `Department conflict for "${row.department_name}". Existing department details do not match source.`,
          { department_name: row.department_name }
        );
      }
      map.set(Number(row.id), Number(existing.rows[0].id));
      continue;
    }

    const headStaffId = toPositiveInt(row.head_of_department);
    let finalHead = null;
    if (headStaffId) {
      const headOk = await client.query('SELECT id FROM staff WHERE id = $1 LIMIT 1', [headStaffId]);
      if (!headOk.rows.length) {
        throw makeCloneError(
          400,
          'ACADEMIC_YEAR_CLONE_DEPARTMENT_HEAD_NOT_FOUND',
          `Cannot clone department "${row.department_name}" because head_of_department ${headStaffId} does not exist.`
        );
      }
      finalHead = headStaffId;
    }

    const ins = await client.query(
      `INSERT INTO departments (
        department_name, department_code, head_of_department, description, is_active, created_by, modified_at, academic_year_id
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      RETURNING id`,
      [
        row.department_name,
        row.department_code || null,
        finalHead,
        row.description || null,
        normalizeBool(row.is_active, true),
        createdByStaffId || null,
        targetYearId || null,
      ]
    );
    map.set(Number(row.id), Number(ins.rows[0].id));
    insertedCount += 1;
  }
  return { map, inserted: insertedCount };
}

async function cloneDesignations(client, departmentMap, createdByStaffId, targetYearId) {
  const map = new Map();
  let insertedCount = 0;
  const rowsRes = await client.query(
    `SELECT id, designation_name, department_id, salary_range_min, salary_range_max, description, is_active
     FROM designations
     ORDER BY id ASC`
  );

  for (const row of rowsRes.rows) {
    const existing = await client.query(
      `SELECT id
       FROM designations
       WHERE LOWER(TRIM(designation_name)) = LOWER(TRIM($1))
       LIMIT 1`,
      [row.designation_name]
    );
    if (existing.rows.length) {
      const exRes = await client.query(
        `SELECT id, department_id, salary_range_min, salary_range_max, description
         FROM designations
         WHERE id = $1`,
        [existing.rows[0].id]
      );
      const ex = exRes.rows[0];
      const oldDeptId = toPositiveInt(row.department_id);
      const mappedDept = oldDeptId ? departmentMap.get(oldDeptId) ?? null : null;
      if ((toPositiveInt(ex?.department_id) || null) !== (mappedDept || null)) {
        throw makeCloneError(
          409,
          'ACADEMIC_YEAR_CLONE_DESIGNATION_CONFLICT',
          `Designation conflict for "${row.designation_name}". Existing designation department mapping does not match source.`,
          { designation_name: row.designation_name }
        );
      }
      map.set(Number(row.id), Number(existing.rows[0].id));
      continue;
    }

    const oldDeptId = toPositiveInt(row.department_id);
    const newDeptId = oldDeptId ? departmentMap.get(oldDeptId) ?? null : null;
    if (oldDeptId && !newDeptId) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_DESIGNATION_DEPARTMENT_MAPPING_MISSING',
        `Cannot clone designation "${row.designation_name}" because department mapping is missing.`,
        { designation_name: row.designation_name, source_department_id: oldDeptId }
      );
    }

    const ins = await client.query(
      `INSERT INTO designations (
        designation_name, department_id, salary_range_min, salary_range_max, description, is_active, created_by, modified_at, academic_year_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      RETURNING id`,
      [
        row.designation_name,
        newDeptId,
        row.salary_range_min ?? null,
        row.salary_range_max ?? null,
        row.description || null,
        normalizeBool(row.is_active, true),
        createdByStaffId || null,
        targetYearId || null,
      ]
    );
    map.set(Number(row.id), Number(ins.rows[0].id));
    insertedCount += 1;
  }

  return { map, inserted: insertedCount };
}

async function cloneClasses(client, sourceYearId, targetYearId, createdByStaffId) {
  const classMap = new Map();
  let insertedCount = 0;
  const sourceRows = await client.query(
    `SELECT id, class_name, class_code, class_teacher_id, max_students, class_fee, description, is_active, has_sections
     FROM classes
     WHERE academic_year_id = $1
     ORDER BY id ASC`,
    [sourceYearId]
  );

  for (const row of sourceRows.rows) {
    let classTeacherId = toPositiveInt(row.class_teacher_id);
    if (classTeacherId) {
      const t = await client.query('SELECT id FROM staff WHERE id = $1 LIMIT 1', [classTeacherId]);
      if (!t.rows.length) {
        throw makeCloneError(
          400,
          'ACADEMIC_YEAR_CLONE_CLASS_TEACHER_NOT_FOUND',
          `Cannot clone class "${row.class_name}" because class teacher ${classTeacherId} does not exist.`
        );
      }
    }

    const classCode = await makeUniqueCode(
      client,
      'classes',
      'class_code',
      row.class_code || null,
      10,
      `Y${targetYearId}`
    );
    if (!classCode) {
      throw makeCloneError(
        409,
        'ACADEMIC_YEAR_CLONE_CLASS_CODE_CONFLICT',
        `Unable to allocate unique class code for "${row.class_name}".`
      );
    }

    const ins = await client.query(
      `INSERT INTO classes (
        class_name, class_code, academic_year_id, class_teacher_id, max_students, class_fee,
        description, is_active, has_sections, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id`,
      [
        row.class_name,
        classCode,
        targetYearId,
        classTeacherId,
        row.max_students ?? 30,
        row.class_fee ?? null,
        row.description || null,
        normalizeBool(row.is_active, true),
        normalizeBool(row.has_sections, true),
        createdByStaffId || null,
      ]
    );
    classMap.set(Number(row.id), Number(ins.rows[0].id));
    insertedCount += 1;
  }

  return { map: classMap, inserted: insertedCount };
}

async function cloneSections(client, sourceYearId, targetYearId, classMap, createdByStaffId) {
  const sectionMap = new Map();
  let insertedCount = 0;
  const rowsRes = await client.query(
    `SELECT s.id, s.section_name, s.class_id, s.section_teacher_id, s.max_students, s.room_number,
            s.description, s.is_active, s.academic_year_id
     FROM sections s
     LEFT JOIN classes c ON c.id = s.class_id
     WHERE COALESCE(s.academic_year_id, c.academic_year_id) = $1
     ORDER BY s.id ASC`,
    [sourceYearId]
  );

  for (const row of rowsRes.rows) {
    const oldClassId = toPositiveInt(row.class_id);
    const newClassId = oldClassId ? classMap.get(oldClassId) : null;
    if (!newClassId) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_SECTION_CLASS_MAPPING_MISSING',
        `Cannot clone section "${row.section_name}" because class mapping is missing.`,
        { source_section_id: row.id, source_class_id: oldClassId }
      );
    }

    const existing = await client.query(
      `SELECT id
       FROM sections
       WHERE class_id = $1
         AND academic_year_id = $2
         AND LOWER(TRIM(section_name)) = LOWER(TRIM($3))
       LIMIT 1`,
      [newClassId, targetYearId, row.section_name]
    );
    if (existing.rows.length) {
      throw makeCloneError(
        409,
        'ACADEMIC_YEAR_CLONE_SECTION_ALREADY_EXISTS',
        `Cannot clone section "${row.section_name}" because it already exists in target class.`
      );
    }

    let teacherId = toPositiveInt(row.section_teacher_id);
    if (teacherId) {
      const t = await client.query('SELECT id FROM staff WHERE id = $1 LIMIT 1', [teacherId]);
      if (!t.rows.length) {
        throw makeCloneError(
          400,
          'ACADEMIC_YEAR_CLONE_SECTION_TEACHER_NOT_FOUND',
          `Cannot clone section "${row.section_name}" because section teacher ${teacherId} does not exist.`
        );
      }
    }

    const ins = await client.query(
      `INSERT INTO sections (
        section_name, class_id, section_teacher_id, max_students, room_number, description,
        is_active, created_by, academic_year_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id`,
      [
        row.section_name,
        newClassId,
        teacherId,
        row.max_students ?? 30,
        row.room_number || null,
        row.description || null,
        normalizeBool(row.is_active, true),
        createdByStaffId || null,
        targetYearId,
      ]
    );
    sectionMap.set(Number(row.id), Number(ins.rows[0].id));
    insertedCount += 1;
  }

  return { map: sectionMap, inserted: insertedCount };
}

async function cloneSubjects(
  client,
  sourceYearId,
  classMap,
  createdByStaffId,
  targetYearId,
  includeAssignmentSubjects = false
) {
  const subjectMap = new Map();
  let insertedCount = 0;
  const sourceClassIds = [...classMap.keys()];
  if (sourceClassIds.length === 0) {
    throw makeCloneError(
      400,
      'ACADEMIC_YEAR_CLONE_SUBJECTS_REQUIRES_CLASSES',
      'Cannot clone subjects because class mapping is empty.'
    );
  }

  const subjectIds = new Set();

  // Base scope: subjects attached to source-year classes.
  const classSubjects = await client.query(
    `SELECT id
     FROM subjects
     WHERE class_id = ANY($1::int[])`,
    [sourceClassIds]
  );
  for (const row of classSubjects.rows) {
    subjectIds.add(Number(row.id));
  }

  // Optional strict extension: assignments may legally point to global subjects (class_id IS NULL).
  // When assignment cloning is selected, include those referenced subjects too.
  if (includeAssignmentSubjects) {
    const assignmentSubjects = await client.query(
      `SELECT DISTINCT ta.subject_id
       FROM teacher_assignments ta
       INNER JOIN classes c ON c.id = ta.class_id
       WHERE c.academic_year_id = $1`,
      [sourceYearId]
    );
    for (const row of assignmentSubjects.rows) {
      const sid = toPositiveInt(row.subject_id);
      if (sid) subjectIds.add(sid);
    }
  }

  const selectedIds = [...subjectIds];
  if (selectedIds.length === 0) {
    return { map: subjectMap, inserted: 0 };
  }

  const rowsRes = await client.query(
    `SELECT id, subject_name, subject_code, class_id, teacher_id, theory_hours, practical_hours,
            total_marks, passing_marks, description, is_active
     FROM subjects
     WHERE id = ANY($1::int[])
     ORDER BY id ASC`,
    [selectedIds]
  );

  for (const row of rowsRes.rows) {
    const oldClassId = toPositiveInt(row.class_id);
    const newClassId = oldClassId ? classMap.get(oldClassId) : null;
    if (oldClassId && !newClassId) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_SUBJECT_CLASS_MAPPING_MISSING',
        `Cannot clone subject "${row.subject_name}" because class mapping is missing.`
      );
    }

    let teacherId = toPositiveInt(row.teacher_id);
    if (teacherId) {
      const t = await client.query('SELECT id FROM staff WHERE id = $1 LIMIT 1', [teacherId]);
      if (!t.rows.length) {
        throw makeCloneError(
          400,
          'ACADEMIC_YEAR_CLONE_SUBJECT_TEACHER_NOT_FOUND',
          `Cannot clone subject "${row.subject_name}" because teacher ${teacherId} does not exist.`
        );
      }
    }

    const subjectCode = await makeUniqueCode(
      client,
      'subjects',
      'subject_code',
      row.subject_code || null,
      10,
      `Y${targetYearId}`
    );
    if (!subjectCode) {
      throw makeCloneError(
        409,
        'ACADEMIC_YEAR_CLONE_SUBJECT_CODE_CONFLICT',
        `Unable to allocate unique subject code for "${row.subject_name}".`
      );
    }

    const ins = await client.query(
      `INSERT INTO subjects (
        subject_name, subject_code, class_id, teacher_id, theory_hours, practical_hours,
        total_marks, passing_marks, description, is_active, created_by, academic_year_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id`,
      [
        row.subject_name,
        subjectCode,
        oldClassId ? newClassId : null,
        teacherId,
        row.theory_hours ?? 0,
        row.practical_hours ?? 0,
        row.total_marks ?? 100,
        row.passing_marks ?? 35,
        row.description || null,
        normalizeBool(row.is_active, true),
        createdByStaffId || null,
        targetYearId,
      ]
    );
    subjectMap.set(Number(row.id), Number(ins.rows[0].id));
    insertedCount += 1;
  }
  return { map: subjectMap, inserted: insertedCount };
}

async function cloneTeacherAssignments(client, sourceYearId, targetYearId, classMap, sectionMap, subjectMap) {
  if (classMap.size === 0) {
    throw makeCloneError(
      400,
      'ACADEMIC_YEAR_CLONE_ASSIGNMENTS_REQUIRES_CLASSES',
      'Cannot clone teacher assignments because class mapping is empty.'
    );
  }

  const rowsRes = await client.query(
    `SELECT ta.id, ta.teacher_id, ta.class_id, ta.section_id, ta.subject_id
     FROM teacher_assignments ta
     INNER JOIN classes c ON c.id = ta.class_id
     WHERE c.academic_year_id = $1
     ORDER BY ta.id ASC`,
    [sourceYearId]
  );

  let inserted = 0;
  for (const row of rowsRes.rows) {
    const teacherId = toPositiveInt(row.teacher_id);
    const oldClassId = toPositiveInt(row.class_id);
    const oldSectionId = toPositiveInt(row.section_id);
    const oldSubjectId = toPositiveInt(row.subject_id);
    const newClassId = oldClassId ? classMap.get(oldClassId) : null;
    const newSectionId = oldSectionId ? sectionMap.get(oldSectionId) ?? null : null;
    const newSubjectId = oldSubjectId ? subjectMap.get(oldSubjectId) : null;
    if (!teacherId) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_ASSIGNMENT_TEACHER_INVALID',
        `Teacher assignment ${row.id} has invalid teacher reference.`
      );
    }
    if (!newClassId) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_ASSIGNMENT_CLASS_MAPPING_MISSING',
        `Teacher assignment ${row.id} cannot be cloned because class mapping is missing.`
      );
    }
    if (!newSubjectId) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_ASSIGNMENT_SUBJECT_MAPPING_MISSING',
        `Teacher assignment ${row.id} cannot be cloned because subject mapping is missing.`
      );
    }
    if (oldSectionId && !newSectionId) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_ASSIGNMENT_SECTION_MAPPING_MISSING',
        `Teacher assignment ${row.id} cannot be cloned because section mapping is missing.`
      );
    }

    const teacherExists = await client.query('SELECT id FROM teachers WHERE id = $1 LIMIT 1', [teacherId]);
    if (!teacherExists.rows.length) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_ASSIGNMENT_TEACHER_NOT_FOUND',
        `Teacher assignment failed: teacher not found (teacher_id=${teacherId}).`
      );
    }

    const exists = await client.query(
      `SELECT id
       FROM teacher_assignments
       WHERE class_id = $1
         AND subject_id = $2
         AND section_id IS NOT DISTINCT FROM $3
       LIMIT 1`,
      [newClassId, newSubjectId, newSectionId]
    );
    if (exists.rows.length) {
      throw makeCloneError(
        409,
        'ACADEMIC_YEAR_CLONE_ASSIGNMENT_ALREADY_EXISTS',
        `Cannot clone teacher assignment for class ${newClassId}, subject ${newSubjectId} because it already exists in target year.`
      );
    }

    await client.query(
      `INSERT INTO teacher_assignments (teacher_id, class_id, section_id, subject_id, academic_year_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [teacherId, newClassId, newSectionId, newSubjectId, targetYearId]
    );
    inserted += 1;
  }

  return inserted;
}

async function cloneTimetable(client, sourceYearId, targetYearId, classMap, sectionMap, subjectMap, createdByStaffId) {
  const rowsRes = await client.query(
    `SELECT id, class_id, section_id, subject_id, time_slot_id, day_of_week, room_number, teacher_id, class_room_id, is_active
     FROM class_schedules
     WHERE academic_year_id = $1
     ORDER BY id ASC`,
    [sourceYearId]
  );

  const insertedRows = [];

  if (classMap.size === 0 || sectionMap.size === 0 || subjectMap.size === 0) {
    throw makeCloneError(
      400,
      'ACADEMIC_YEAR_CLONE_TIMETABLE_DEPENDENCY_MISSING',
      'Cannot clone timetable because class/section/subject mapping is incomplete.'
    );
  }

  for (const row of rowsRes.rows) {
    const oldClassId = toPositiveInt(row.class_id);
    const oldSectionId = toPositiveInt(row.section_id);
    const oldSubjectId = toPositiveInt(row.subject_id);
    const teacherStaffId = toPositiveInt(row.teacher_id);
    const timeSlotId = toPositiveInt(row.time_slot_id);
    const dayOfWeek = toPositiveInt(row.day_of_week);

    const newClassId = oldClassId ? classMap.get(oldClassId) : null;
    const newSectionId = oldSectionId ? sectionMap.get(oldSectionId) ?? null : null;
    const newSubjectId = oldSubjectId ? subjectMap.get(oldSubjectId) ?? null : null;
    if (!newClassId) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_TIMETABLE_CLASS_MAPPING_MISSING',
        `Cannot clone timetable row ${row.id} because class mapping is missing.`
      );
    }
    if (oldSectionId && !newSectionId) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_TIMETABLE_SECTION_MAPPING_MISSING',
        `Cannot clone timetable row ${row.id} because section mapping is missing.`
      );
    }
    if (oldSubjectId && !newSubjectId) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_TIMETABLE_SUBJECT_MAPPING_MISSING',
        `Cannot clone timetable row ${row.id} because subject mapping is missing.`
      );
    }
    if (!timeSlotId || !dayOfWeek) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_TIMETABLE_SLOT_INVALID',
        `Timetable row ${row.id} has invalid day/time slot.`
      );
    }

    const slotExists = await client.query('SELECT id FROM time_slots WHERE id = $1 LIMIT 1', [timeSlotId]);
    if (!slotExists.rows.length) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_TIMETABLE_SLOT_NOT_FOUND',
        `Timetable row ${row.id} references missing time slot ${timeSlotId}.`
      );
    }

    let teacherId = teacherStaffId;
    if (teacherId) {
      const t = await client.query('SELECT id FROM staff WHERE id = $1 LIMIT 1', [teacherId]);
      if (!t.rows.length) {
        throw makeCloneError(
          400,
          'ACADEMIC_YEAR_CLONE_TIMETABLE_TEACHER_NOT_FOUND',
          `Timetable row ${row.id} references missing teacher ${teacherId}.`
        );
      }
    }

    const conflict = await client.query(
      `SELECT 1
       FROM class_schedules
       WHERE academic_year_id = $1
         AND day_of_week = $2
         AND (
           (class_id = $3 AND section_id IS NOT DISTINCT FROM $4 AND time_slot_id = $5)
           OR
           ($6::int IS NOT NULL AND teacher_id = $6 AND time_slot_id = $5)
         )
       LIMIT 1`,
      [targetYearId, dayOfWeek, newClassId, newSectionId, timeSlotId, teacherId]
    );
    if (conflict.rows.length) {
      throw makeCloneError(
        409,
        'ACADEMIC_YEAR_CLONE_TIMETABLE_CONFLICT',
        `Cannot clone timetable because target year already has a conflicting slot (class/teacher conflict).`
      );
    }

    let classRoomId = toPositiveInt(row.class_room_id);
    if (classRoomId) {
      const room = await client.query('SELECT id FROM class_rooms WHERE id = $1 LIMIT 1', [classRoomId]);
      if (!room.rows.length) {
        throw makeCloneError(
          400,
          'ACADEMIC_YEAR_CLONE_TIMETABLE_CLASSROOM_NOT_FOUND',
          `Timetable row ${row.id} references missing class room ${classRoomId}.`
        );
      }
    }

    const ins = await client.query(
      `INSERT INTO class_schedules (
        class_id, section_id, subject_id, time_slot_id, day_of_week, academic_year_id,
        room_number, teacher_id, class_room_id, is_active, created_by, modified_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
      RETURNING id, teacher_id`,
      [
        newClassId,
        newSectionId,
        newSubjectId,
        timeSlotId,
        dayOfWeek,
        targetYearId,
        row.room_number || null,
        teacherId,
        classRoomId,
        normalizeBool(row.is_active, true),
        createdByStaffId || null,
      ]
    );
    insertedRows.push(ins.rows[0]);
  }

  for (const row of insertedRows) {
    const teacherId = toPositiveInt(row.teacher_id);
    const scheduleId = toPositiveInt(row.id);
    if (!scheduleId) {
      throw makeCloneError(
        500,
        'ACADEMIC_YEAR_CLONE_TIMETABLE_INTERNAL_INVALID_SCHEDULE',
        'Failed to link teacher routines because cloned schedule id is invalid.'
      );
    }
    if (!teacherId) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_TIMETABLE_TEACHER_MISSING_FOR_ROUTINE',
        `Cannot create teacher routine because timetable entry ${scheduleId} has no teacher.`
      );
    }
    const ex = await client.query(
      'SELECT id FROM teacher_routines WHERE class_schedule_id = $1 LIMIT 1',
      [scheduleId]
    );
    if (ex.rows.length) {
      throw makeCloneError(
        409,
        'ACADEMIC_YEAR_CLONE_TEACHER_ROUTINE_ALREADY_EXISTS',
        `Teacher routine already exists for schedule ${scheduleId}.`
      );
    }
    await client.query(
      `INSERT INTO teacher_routines (teacher_id, class_schedule_id, academic_year_id, is_active, created_at, created_by, modified_at)
       VALUES ($1, $2, $3, true, NOW(), $4, NOW())`,
      [teacherId, scheduleId, targetYearId, createdByStaffId || null]
    );
  }

  return insertedRows.length;
}

async function cloneTransport(client, sourceYearId, targetYearId) {
  const hasRouteStops = await tableExists(client, 'route_stops');
  const pickupPointsHasRouteId = await columnExists(client, 'pickup_points', 'route_id');
  const routesHasDeletedAt = await columnExists(client, 'routes', 'deleted_at');
  const driversHasDeletedAt = await columnExists(client, 'drivers', 'deleted_at');
  const pickupPointsHasDeletedAt = await columnExists(client, 'pickup_points', 'deleted_at');
  const routesHasDistanceKm = await columnExists(client, 'routes', 'distance_km');
  const routesHasTotalDistance = await columnExists(client, 'routes', 'total_distance');
  const routesHasRouteCode = await columnExists(client, 'routes', 'route_code');
  const routeCodeMaxLen = routesHasRouteCode
    ? getColumnMaxLength(client, 'routes', 'route_code')
    : Promise.resolve(null);
  const routesHasDescription = await columnExists(client, 'routes', 'description');
  if (!hasRouteStops && !pickupPointsHasRouteId) {
    throw makeCloneError(
      400,
      'ACADEMIC_YEAR_CLONE_TRANSPORT_SCHEMA_UNSUPPORTED',
      'Cannot clone transport because neither route_stops nor pickup_points.route_id schema is available.'
    );
  }

  const driverMap = new Map();
  const pickupPointMap = new Map();
  const routeMap = new Map();
  let driversInserted = 0;
  let driversReused = 0;

  const sourceDrivers = await client.query(
    `SELECT id, driver_name, phone, license_number, role, address, user_id, is_active
     FROM drivers
     WHERE 1=1
       ${driversHasDeletedAt ? 'AND deleted_at IS NULL' : ''}
       AND academic_year_id = $1
     ORDER BY id ASC`,
    [sourceYearId]
  );
  for (const row of sourceDrivers.rows) {
    // Drivers are effectively global entities in many tenant schemas
    // (license_number unique across table). Reuse existing driver when same
    // person is already present by license_number/phone instead of duplicate insert.
    const existing = await client.query(
      `SELECT id, license_number, phone, academic_year_id
       FROM drivers
       WHERE 1=1
         ${driversHasDeletedAt ? 'AND deleted_at IS NULL' : ''}
         AND (
           ($1::text IS NOT NULL AND license_number = $1)
           OR
           ($2::text IS NOT NULL AND phone = $2)
         )
       ORDER BY id ASC
       LIMIT 1`,
      [row.license_number || null, row.phone || null]
    );
    if (existing.rows.length) {
      driverMap.set(Number(row.id), Number(existing.rows[0].id));
      driversReused += 1;
      continue;
    }
    const ins = await client.query(
      `INSERT INTO drivers (driver_name, phone, license_number, role, address, user_id, is_active, academic_year_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        row.driver_name,
        row.phone,
        row.license_number || null,
        row.role || 'driver',
        row.address || null,
        row.user_id || null,
        normalizeBool(row.is_active, true),
        targetYearId,
      ]
    );
    driverMap.set(Number(row.id), Number(ins.rows[0].id));
    driversInserted += 1;
  }

  const sourceRoutes = await client.query(
    `SELECT id, route_name,
            ${routesHasDistanceKm ? 'distance_km' : routesHasTotalDistance ? 'total_distance' : 'NULL'} AS route_distance,
            is_active
     FROM routes
     WHERE 1=1
       ${routesHasDeletedAt ? 'AND deleted_at IS NULL' : ''}
       AND academic_year_id = $1
     ORDER BY id ASC`,
    [sourceYearId]
  );

  async function buildUniqueRouteName(baseName) {
    const raw = String(baseName || '').trim() || 'Route';
    const cap = 100;
    const root = raw.slice(0, cap);
    const firstTry = `${root} (${targetYearId})`.slice(0, cap);
    const ex1 = await client.query('SELECT 1 FROM routes WHERE LOWER(TRIM(route_name)) = LOWER(TRIM($1)) LIMIT 1', [firstTry]);
    if (!ex1.rows.length) return firstTry;

    for (let i = 1; i <= 200; i += 1) {
      const candidate = `${root} (${targetYearId}-${i})`.slice(0, cap);
      const ex = await client.query(
        'SELECT 1 FROM routes WHERE LOWER(TRIM(route_name)) = LOWER(TRIM($1)) LIMIT 1',
        [candidate]
      );
      if (!ex.rows.length) return candidate;
    }
    throw makeCloneError(
      409,
      'ACADEMIC_YEAR_CLONE_TRANSPORT_ROUTE_NAME_CONFLICT',
      `Cannot clone route "${raw}" because a unique route name could not be allocated.`
    );
  }

  for (const row of sourceRoutes.rows) {
    const existing = await client.query(
      `SELECT id
       FROM routes
       WHERE 1=1
         ${routesHasDeletedAt ? 'AND deleted_at IS NULL' : ''}
         AND academic_year_id = $1
         AND LOWER(TRIM(route_name)) = LOWER(TRIM($2))
       LIMIT 1`,
      [targetYearId, row.route_name]
    );
    let newRouteId = null;
    if (existing.rows.length) {
      routeMap.set(Number(row.id), Number(existing.rows[0].id));
      continue;
    }

    // Global uniqueness can still conflict on route_name in legacy schemas.
    const globalNameConflict = await client.query(
      `SELECT id, academic_year_id
       FROM routes
       WHERE 1=1
         ${routesHasDeletedAt ? 'AND deleted_at IS NULL' : ''}
         AND LOWER(TRIM(route_name)) = LOWER(TRIM($1))
       LIMIT 1`,
      [row.route_name]
    );
    let routeNameToInsert = row.route_name;
    if (globalNameConflict.rows.length) {
      routeNameToInsert = await buildUniqueRouteName(row.route_name);
    }

    const routeDistance = Number(row.route_distance ?? 0);
    let routeCode = null;
    if (routesHasRouteCode) {
      const maxLen = (await routeCodeMaxLen) || 10;
      const preferredRouteCode = String(row.route_code || '').trim();
      const codeBase =
        String(row.route_name || 'ROUTE')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase()
          .slice(0, maxLen) || 'ROUTE';
      routeCode = await makeUniqueCode(
        client,
        'routes',
        'route_code',
        preferredRouteCode || `${codeBase}${targetYearId}`.slice(0, maxLen),
        maxLen,
        `Y${targetYearId}`
      );
      if (!routeCode) {
        throw makeCloneError(
          409,
          'ACADEMIC_YEAR_CLONE_TRANSPORT_ROUTE_CODE_CONFLICT',
          `Unable to allocate unique route code for route "${row.route_name}".`
        );
      }
    }
    const insertCols = ['route_name'];
    const insertVals = [row.route_name];
    const placeholders = ['$1'];
    let p = 2;
    if (routesHasDistanceKm) {
      insertCols.push('distance_km');
      insertVals.push(routeDistance);
      placeholders.push(`$${p++}`);
    } else if (routesHasTotalDistance) {
      insertCols.push('total_distance');
      insertVals.push(routeDistance);
      placeholders.push(`$${p++}`);
    }
    if (routesHasRouteCode) {
      insertCols.push('route_code');
      insertVals.push(routeCode);
      placeholders.push(`$${p++}`);
    }
    if (routesHasDescription) {
      insertCols.push('description');
      insertVals.push(null);
      placeholders.push(`$${p++}`);
    }
    insertCols.push('is_active');
    insertVals.push(normalizeBool(row.is_active, true));
    placeholders.push(`$${p++}`);
    insertCols.push('academic_year_id');
    insertVals.push(targetYearId);
    placeholders.push(`$${p++}`);
    const ins = await client.query(
      `INSERT INTO routes (${insertCols.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING id`,
      [routeNameToInsert, ...insertVals.slice(1)]
    );
    newRouteId = Number(ins.rows[0].id);
    routeMap.set(Number(row.id), newRouteId);
  }

  let sourceStops;
  if (hasRouteStops) {
    sourceStops = await client.query(
      `SELECT rs.route_id, rs.pickup_point_id, rs.pickup_time, rs.drop_time, rs.order_index, pp.point_name, pp.is_active
       FROM route_stops rs
       INNER JOIN routes r ON r.id = rs.route_id
       INNER JOIN pickup_points pp ON pp.id = rs.pickup_point_id
       WHERE 1=1
         ${routesHasDeletedAt ? 'AND r.deleted_at IS NULL' : ''}
         AND r.academic_year_id = $1
         ${pickupPointsHasDeletedAt ? 'AND pp.deleted_at IS NULL' : ''}
       ORDER BY rs.route_id ASC, rs.order_index ASC, rs.id ASC`,
      [sourceYearId]
    );
  } else {
    sourceStops = await client.query(
      `SELECT pp.route_id, pp.id AS pickup_point_id, pp.pickup_time, pp.drop_time,
              COALESCE(pp.sequence_order, 0) AS order_index, pp.point_name, pp.is_active
       FROM pickup_points pp
       INNER JOIN routes r ON r.id = pp.route_id
       WHERE 1=1
         ${routesHasDeletedAt ? 'AND r.deleted_at IS NULL' : ''}
         AND r.academic_year_id = $1
         ${pickupPointsHasDeletedAt ? 'AND pp.deleted_at IS NULL' : ''}
       ORDER BY pp.route_id ASC, COALESCE(pp.sequence_order, 0) ASC, pp.id ASC`,
      [sourceYearId]
    );
  }

  for (const stop of sourceStops.rows) {
    const oldPickupId = toPositiveInt(stop.pickup_point_id);
    if (!oldPickupId) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_TRANSPORT_PICKUP_INVALID',
        'Cannot clone transport: source stop has invalid pickup point id.'
      );
    }
    if (pickupPointMap.has(oldPickupId)) continue;

    const existing = await client.query(
      `SELECT id
       FROM pickup_points
       WHERE 1=1
         ${pickupPointsHasDeletedAt ? 'AND deleted_at IS NULL' : ''}
         AND academic_year_id = $1
         AND LOWER(TRIM(point_name)) = LOWER(TRIM($2))
         ${hasRouteStops ? '' : 'AND route_id = $3'}
       LIMIT 1`,
      hasRouteStops ? [targetYearId, stop.point_name] : [targetYearId, stop.point_name, routeMap.get(Number(stop.route_id))]
    );
    if (existing.rows.length) {
      throw makeCloneError(
        409,
        'ACADEMIC_YEAR_CLONE_TRANSPORT_PICKUP_EXISTS',
        `Cannot clone transport: pickup point "${stop.point_name}" already exists in target year.`
      );
    }

    const ins = await client.query(
      hasRouteStops
        ? `INSERT INTO pickup_points (point_name, is_active, academic_year_id)
           VALUES ($1, $2, $3)
           RETURNING id`
        : `INSERT INTO pickup_points (point_name, route_id, pickup_time, drop_time, sequence_order, is_active, academic_year_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
      hasRouteStops
        ? [stop.point_name, normalizeBool(stop.is_active, true), targetYearId]
        : [
            stop.point_name,
            routeMap.get(Number(stop.route_id)),
            stop.pickup_time || null,
            stop.drop_time || null,
            stop.order_index ?? 0,
            normalizeBool(stop.is_active, true),
            targetYearId,
          ]
    );
    pickupPointMap.set(oldPickupId, Number(ins.rows[0].id));
  }

  if (hasRouteStops) {
    for (const stop of sourceStops.rows) {
    const oldRouteId = toPositiveInt(stop.route_id);
    const oldPickupId = toPositiveInt(stop.pickup_point_id);
    const newRouteId = oldRouteId ? routeMap.get(oldRouteId) : null;
    const newPickupId = oldPickupId ? pickupPointMap.get(oldPickupId) : null;
    if (!newRouteId || !newPickupId) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_TRANSPORT_MAPPING_MISSING',
        'Cannot clone transport route stops because route/pickup mapping is missing.'
      );
    }

    const exists = await client.query(
      `SELECT id
       FROM route_stops
       WHERE route_id = $1
         AND pickup_point_id = $2
         AND order_index = $3
       LIMIT 1`,
      [newRouteId, newPickupId, stop.order_index ?? 0]
    );
    if (exists.rows.length) {
      throw makeCloneError(
        409,
        'ACADEMIC_YEAR_CLONE_TRANSPORT_STOP_EXISTS',
        'Cannot clone transport: duplicate route stop detected in target year.'
      );
    }

      await client.query(
        `INSERT INTO route_stops (route_id, pickup_point_id, pickup_time, drop_time, order_index, academic_year_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newRouteId, newPickupId, stop.pickup_time || null, stop.drop_time || null, stop.order_index ?? 0, targetYearId]
      );
    }
  }

  return {
    drivers_cloned: driversInserted,
    drivers_reused: driversReused,
    routes_cloned: routeMap.size,
    pickup_points_cloned: pickupPointMap.size,
  };
}

async function validatePreconditions(client, sourceYearId, targetYearId, options) {
  const sourceYear = await client.query('SELECT id FROM academic_years WHERE id = $1 LIMIT 1', [sourceYearId]);
  if (!sourceYear.rows.length) {
    throw makeCloneError(404, 'ACADEMIC_YEAR_COPY_SOURCE_NOT_FOUND', 'Source academic year not found for cloning');
  }
  const targetYear = await client.query('SELECT id FROM academic_years WHERE id = $1 LIMIT 1', [targetYearId]);
  if (!targetYear.rows.length) {
    throw makeCloneError(404, 'ACADEMIC_YEAR_COPY_TARGET_NOT_FOUND', 'Target academic year not found for cloning');
  }

  // Strict target-year emptiness per module to prevent merge ambiguity.
  if (options.classes) {
    const c = await client.query('SELECT COUNT(*)::int AS count FROM classes WHERE academic_year_id = $1', [targetYearId]);
    if ((c.rows[0]?.count || 0) > 0) {
      throw makeCloneError(409, 'ACADEMIC_YEAR_CLONE_TARGET_HAS_CLASSES', 'Target academic year already has classes. Strict clone requires an empty target year for selected modules.');
    }
  }
  if (options.sections) {
    const c = await client.query('SELECT COUNT(*)::int AS count FROM sections WHERE academic_year_id = $1', [targetYearId]);
    if ((c.rows[0]?.count || 0) > 0) {
      throw makeCloneError(409, 'ACADEMIC_YEAR_CLONE_TARGET_HAS_SECTIONS', 'Target academic year already has sections. Strict clone requires an empty target year for selected modules.');
    }
  }
  if (options.subjects) {
    const c = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM subjects s
       INNER JOIN classes c ON c.id = s.class_id
       WHERE c.academic_year_id = $1`,
      [targetYearId]
    );
    if ((c.rows[0]?.count || 0) > 0) {
      throw makeCloneError(409, 'ACADEMIC_YEAR_CLONE_TARGET_HAS_SUBJECTS', 'Target academic year already has subjects. Strict clone requires an empty target year for selected modules.');
    }
  }
  if (options.teacherAssignments) {
    const c = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM teacher_assignments ta
       INNER JOIN classes c ON c.id = ta.class_id
       WHERE c.academic_year_id = $1`,
      [targetYearId]
    );
    if ((c.rows[0]?.count || 0) > 0) {
      throw makeCloneError(409, 'ACADEMIC_YEAR_CLONE_TARGET_HAS_ASSIGNMENTS', 'Target academic year already has teacher assignments. Strict clone requires an empty target year for selected modules.');
    }
  }
  if (options.timetable) {
    const c = await client.query('SELECT COUNT(*)::int AS count FROM class_schedules WHERE academic_year_id = $1', [targetYearId]);
    if ((c.rows[0]?.count || 0) > 0) {
      throw makeCloneError(409, 'ACADEMIC_YEAR_CLONE_TARGET_HAS_TIMETABLE', 'Target academic year already has timetable entries. Strict clone requires an empty target year for selected modules.');
    }
  }
}

async function collectExpectedCounts(client, sourceYearId, options) {
  const counts = {};
  if (options.classes) {
    const r = await client.query('SELECT COUNT(*)::int AS count FROM classes WHERE academic_year_id = $1', [sourceYearId]);
    counts.classes_expected = r.rows[0]?.count || 0;
  }
  if (options.sections) {
    const r = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM sections s
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE COALESCE(s.academic_year_id, c.academic_year_id) = $1`,
      [sourceYearId]
    );
    counts.sections_expected = r.rows[0]?.count || 0;
  }
  if (options.subjects) {
    if (options.teacherAssignments) {
      const r = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM subjects s
         WHERE s.id IN (
           SELECT s1.id
           FROM subjects s1
           INNER JOIN classes c ON c.id = s1.class_id
           WHERE c.academic_year_id = $1
           UNION
           SELECT ta.subject_id
           FROM teacher_assignments ta
           INNER JOIN classes c2 ON c2.id = ta.class_id
           WHERE c2.academic_year_id = $1
         )`,
        [sourceYearId]
      );
      counts.subjects_expected = r.rows[0]?.count || 0;
    } else {
      const r = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM subjects s
         INNER JOIN classes c ON c.id = s.class_id
         WHERE c.academic_year_id = $1`,
        [sourceYearId]
      );
      counts.subjects_expected = r.rows[0]?.count || 0;
    }
  }
  if (options.teacherAssignments) {
    const r = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM teacher_assignments ta
       INNER JOIN classes c ON c.id = ta.class_id
       WHERE c.academic_year_id = $1`,
      [sourceYearId]
    );
    counts.teacher_assignments_expected = r.rows[0]?.count || 0;
  }
  if (options.timetable) {
    const r = await client.query('SELECT COUNT(*)::int AS count FROM class_schedules WHERE academic_year_id = $1', [sourceYearId]);
    counts.timetable_expected = r.rows[0]?.count || 0;
  }
  return counts;
}

function validateSelectedDependencies(options) {
  if (options.sections && !options.classes) {
    throw makeCloneError(
      400,
      'ACADEMIC_YEAR_CLONE_DEPENDENCY_SECTIONS_REQUIRES_CLASSES',
      'Sections cloning requires Classes to be selected.'
    );
  }
  if (options.subjects && !options.classes) {
    throw makeCloneError(
      400,
      'ACADEMIC_YEAR_CLONE_DEPENDENCY_SUBJECTS_REQUIRES_CLASSES',
      'Subjects cloning requires Classes to be selected.'
    );
  }
  if (options.teacherAssignments && !options.classes) {
    throw makeCloneError(
      400,
      'ACADEMIC_YEAR_CLONE_DEPENDENCY_ASSIGNMENTS_REQUIRES_CLASSES',
      'Teacher Assignments cloning requires Classes to be selected.'
    );
  }
  if (options.teacherAssignments && !options.subjects) {
    throw makeCloneError(
      400,
      'ACADEMIC_YEAR_CLONE_DEPENDENCY_ASSIGNMENTS_REQUIRES_SUBJECTS',
      'Teacher Assignments cloning requires Subjects to be selected.'
    );
  }
  if (options.timetable && (!options.classes || !options.sections || !options.subjects)) {
    throw makeCloneError(
      400,
      'ACADEMIC_YEAR_CLONE_DEPENDENCY_TIMETABLE_REQUIRES_CLASS_SECTION_SUBJECT',
      'Timetable cloning requires Classes, Sections, and Subjects to be selected.'
    );
  }
  if (options.designations && !options.departments) {
    throw makeCloneError(
      400,
      'ACADEMIC_YEAR_CLONE_DEPENDENCY_DESIGNATIONS_REQUIRES_DEPARTMENTS',
      'Designations cloning requires Departments to be selected.'
    );
  }
}

async function validateSourceDataConsistency(client, sourceYearId, options) {
  if (options.teacherAssignments) {
    const missingTeachers = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM teacher_assignments ta
       INNER JOIN classes c ON c.id = ta.class_id
       LEFT JOIN teachers t ON t.id = ta.teacher_id
       WHERE c.academic_year_id = $1 AND t.id IS NULL`,
      [sourceYearId]
    );
    if ((missingTeachers.rows[0]?.count || 0) > 0) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_ASSIGNMENT_SOURCE_TEACHER_MISSING',
        'Cannot clone teacher assignments because source year contains assignments with missing teachers.'
      );
    }
  }

  if (options.timetable) {
    const missingSlots = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM class_schedules cs
       LEFT JOIN time_slots ts ON ts.id = cs.time_slot_id
       WHERE cs.academic_year_id = $1 AND ts.id IS NULL`,
      [sourceYearId]
    );
    if ((missingSlots.rows[0]?.count || 0) > 0) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_TIMETABLE_SOURCE_SLOT_MISSING',
        'Cannot clone timetable because source year contains rows with missing time slots.'
      );
    }
  }
}

async function validateStrictIntegrity(client, targetYearId, options, summary) {
  if (options.sections) {
    const orphanSections = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM sections s
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE s.academic_year_id = $1
         AND (c.id IS NULL OR c.academic_year_id <> $1)`,
      [targetYearId]
    );
    if ((orphanSections.rows[0]?.count || 0) > 0) {
      throw makeCloneError(
        500,
        'ACADEMIC_YEAR_CLONE_INTEGRITY_SECTION_ORPHAN',
        'Clone integrity check failed: section-class linkage is invalid in target year.'
      );
    }
  }

  if (options.teacherAssignments) {
    const invalidAssignments = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM teacher_assignments ta
       INNER JOIN classes c ON c.id = ta.class_id
       LEFT JOIN subjects s ON s.id = ta.subject_id
       LEFT JOIN sections sec ON sec.id = ta.section_id
       LEFT JOIN teachers t ON t.id = ta.teacher_id
       WHERE c.academic_year_id = $1
         AND (
           t.id IS NULL
           OR s.id IS NULL
           OR s.class_id <> c.id
           OR (sec.id IS NOT NULL AND sec.class_id <> c.id)
         )`,
      [targetYearId]
    );
    if ((invalidAssignments.rows[0]?.count || 0) > 0) {
      throw makeCloneError(
        500,
        'ACADEMIC_YEAR_CLONE_INTEGRITY_ASSIGNMENT_INVALID',
        'Clone integrity check failed: teacher assignment references are invalid.'
      );
    }
  }

  if (options.timetable) {
    const invalidSchedules = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM class_schedules cs
       LEFT JOIN classes c ON c.id = cs.class_id
       LEFT JOIN sections sec ON sec.id = cs.section_id
       LEFT JOIN subjects s ON s.id = cs.subject_id
       LEFT JOIN time_slots ts ON ts.id = cs.time_slot_id
       WHERE cs.academic_year_id = $1
         AND (
           c.id IS NULL
           OR c.academic_year_id <> $1
           OR ts.id IS NULL
           OR (sec.id IS NOT NULL AND sec.class_id <> c.id)
           OR (s.id IS NOT NULL AND s.class_id <> c.id)
         )`,
      [targetYearId]
    );
    if ((invalidSchedules.rows[0]?.count || 0) > 0) {
      throw makeCloneError(
        500,
        'ACADEMIC_YEAR_CLONE_INTEGRITY_TIMETABLE_INVALID',
        'Clone integrity check failed: timetable references are invalid.'
      );
    }
  }

  // Ensure strict summary has no skips/errors.
  if (summary.skipped !== 0 || (summary.errors && summary.errors.length > 0)) {
    throw makeCloneError(
      500,
      'ACADEMIC_YEAR_CLONE_STRICT_SUMMARY_INVALID',
      'Clone summary indicates skipped records or unresolved errors, which is not allowed in strict mode.'
    );
  }
}

async function cloneAcademicYearData(client, { sourceYearId, targetYearId, options, createdByStaffId }) {
  const src = toPositiveInt(sourceYearId);
  const target = toPositiveInt(targetYearId);
  if (!src || !target) {
    throw makeCloneError(400, 'ACADEMIC_YEAR_CLONE_INVALID_IDS', 'Invalid source/target academic year id');
  }
  if (src === target) {
    throw makeCloneError(
      400,
      'ACADEMIC_YEAR_COPY_SOURCE_EQUALS_TARGET',
      'Source and target academic years must be different'
    );
  }

  const normalizedOptions = normalizeCopyOptions(options);
  validateSelectedDependencies(normalizedOptions);
  if (!anyCopySelected(normalizedOptions)) {
    return {
      options: normalizedOptions,
      summary: {
        classes_cloned: 0,
        sections_cloned: 0,
        subjects_cloned: 0,
        assignments_cloned: 0,
        timetable_entries_cloned: 0,
        skipped: 0,
        errors: [],
      },
    };
  }

  await validatePreconditions(client, src, target, normalizedOptions);
  const expected = await collectExpectedCounts(client, src, normalizedOptions);
  await validateSourceDataConsistency(client, src, normalizedOptions);

  const summary = {
    classes_cloned: 0,
    sections_cloned: 0,
    subjects_cloned: 0,
    assignments_cloned: 0,
    timetable_entries_cloned: 0,
    skipped: 0,
    errors: [],
  };

  const details = {};
  let departmentMap = new Map();
  let classMap = new Map();
  let sectionMap = new Map();
  let subjectMap = new Map();

  if (normalizedOptions.departments) {
    const departmentResult = await cloneDepartments(client, createdByStaffId, target);
    departmentMap = departmentResult.map;
    details.departments_cloned = departmentResult.inserted;
  }

  if (normalizedOptions.designations) {
    const designationResult = await cloneDesignations(client, departmentMap, createdByStaffId, target);
    details.designations_cloned = designationResult.inserted;
  }

  if (normalizedOptions.classes) {
    const classesResult = await cloneClasses(client, src, target, createdByStaffId);
    classMap = classesResult.map;
    summary.classes_cloned = classesResult.inserted;
  }

  if (normalizedOptions.sections) {
    const sectionsResult = await cloneSections(client, src, target, classMap, createdByStaffId);
    sectionMap = sectionsResult.map;
    summary.sections_cloned = sectionsResult.inserted;
  }

  if (normalizedOptions.subjects) {
    const subjectsResult = await cloneSubjects(
      client,
      src,
      classMap,
      createdByStaffId,
      target,
      normalizedOptions.teacherAssignments
    );
    subjectMap = subjectsResult.map;
    summary.subjects_cloned = subjectsResult.inserted;
  }

  if (normalizedOptions.teacherAssignments) {
    summary.assignments_cloned = await cloneTeacherAssignments(
      client,
      src,
      target,
      classMap,
      sectionMap,
      subjectMap
    );
  }

  if (normalizedOptions.timetable) {
    summary.timetable_entries_cloned = await cloneTimetable(
      client,
      src,
      target,
      classMap,
      sectionMap,
      subjectMap,
      createdByStaffId
    );
  }

  if (normalizedOptions.transport) {
    const t = await cloneTransport(client, src, target);
    details.transport = t;
  }

  if (normalizedOptions.classes && summary.classes_cloned !== (expected.classes_expected || 0)) {
    throw makeCloneError(
      500,
      'ACADEMIC_YEAR_CLONE_COUNT_MISMATCH_CLASSES',
      `Classes cloned count mismatch. Expected ${expected.classes_expected || 0}, got ${summary.classes_cloned}.`
    );
  }
  if (normalizedOptions.sections && summary.sections_cloned !== (expected.sections_expected || 0)) {
    throw makeCloneError(
      500,
      'ACADEMIC_YEAR_CLONE_COUNT_MISMATCH_SECTIONS',
      `Sections cloned count mismatch. Expected ${expected.sections_expected || 0}, got ${summary.sections_cloned}.`
    );
  }
  if (normalizedOptions.subjects && summary.subjects_cloned !== (expected.subjects_expected || 0)) {
    throw makeCloneError(
      500,
      'ACADEMIC_YEAR_CLONE_COUNT_MISMATCH_SUBJECTS',
      `Subjects cloned count mismatch. Expected ${expected.subjects_expected || 0}, got ${summary.subjects_cloned}.`
    );
  }
  if (normalizedOptions.teacherAssignments && summary.assignments_cloned !== (expected.teacher_assignments_expected || 0)) {
    throw makeCloneError(
      500,
      'ACADEMIC_YEAR_CLONE_COUNT_MISMATCH_ASSIGNMENTS',
      `Teacher assignments cloned count mismatch. Expected ${expected.teacher_assignments_expected || 0}, got ${summary.assignments_cloned}.`
    );
  }
  if (normalizedOptions.timetable && summary.timetable_entries_cloned !== (expected.timetable_expected || 0)) {
    throw makeCloneError(
      500,
      'ACADEMIC_YEAR_CLONE_COUNT_MISMATCH_TIMETABLE',
      `Timetable cloned count mismatch. Expected ${expected.timetable_expected || 0}, got ${summary.timetable_entries_cloned}.`
    );
  }

  await validateStrictIntegrity(client, target, normalizedOptions, summary);

  return {
    options: normalizedOptions,
    summary,
    details,
  };
}

module.exports = {
  DEFAULT_COPY_OPTIONS,
  normalizeCopyOptions,
  anyCopySelected,
  cloneAcademicYearData,
};

