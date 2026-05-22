const { query } = require('../config/database');
const { lateralCurrentEnrollment } = require('../utils/studentEnrollmentSql');
const { ROLES, ADMIN_ROLE_IDS } = require('../config/roles');

const parseId = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const isAdminRole = (user) => {
  const roleId = parseId(user?.role_id);
  if (roleId && ADMIN_ROLE_IDS.includes(roleId)) return true;
  const roleName = String(user?.role_name || user?.role || '')
    .trim()
    .toLowerCase();
  return ['admin', 'headmaster', 'administrative', 'administrator'].includes(roleName);
};

const isTeacherRole = (user) => {
  const roleId = parseId(user?.role_id);
  if (roleId === ROLES.TEACHER) return true;
  return String(user?.role_name || user?.role || '')
    .trim()
    .toLowerCase() === 'teacher';
};

async function resolveStaffIdForUser(userId) {
  const uid = parseId(userId);
  if (!uid) return null;
  const r = await query(
    `SELECT id FROM staff WHERE user_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [uid]
  );
  return r.rows[0]?.id ?? null;
}

/**
 * Load and validate subject_teacher_assignments row for homework create.
 */
async function loadTeacherAssignment(teacherAssignmentId) {
  const id = parseId(teacherAssignmentId);
  if (!id) return { ok: false, status: 400, message: 'Invalid teacher_assignment_id' };

  const r = await query(
    `SELECT
      sta.id,
      sta.staff_id,
      sta.class_id,
      sta.class_section_id,
      sta.class_subject_id,
      sta.academic_year_id
    FROM subject_teacher_assignments sta
    WHERE sta.id = $1 AND sta.deleted_at IS NULL
    LIMIT 1`,
    [id]
  );
  if (!r.rows.length) {
    return { ok: false, status: 400, message: 'Teacher assignment not found or inactive' };
  }
  return { ok: true, assignment: r.rows[0] };
}

/**
 * Ensure payload class/section/subject/year align with the assignment anchor.
 */
function assertPayloadMatchesAssignment(payload, assignment) {
  const mismatches = [];
  if (parseId(payload.academic_year_id) !== parseId(assignment.academic_year_id)) {
    mismatches.push('academic_year_id');
  }
  if (parseId(payload.class_id) !== parseId(assignment.class_id)) {
    mismatches.push('class_id');
  }
  if (parseId(payload.class_section_id) !== parseId(assignment.class_section_id)) {
    mismatches.push('class_section_id');
  }
  if (parseId(payload.class_subject_id) !== parseId(assignment.class_subject_id)) {
    mismatches.push('class_subject_id');
  }
  if (mismatches.length) {
    return {
      ok: false,
      status: 400,
      message: `Homework context does not match teacher assignment: ${mismatches.join(', ')}`,
    };
  }
  return { ok: true };
}

async function assertTeacherMayUseAssignment(user, assignment) {
  if (isAdminRole(user)) return { ok: true };
  if (!isTeacherRole(user)) {
    return { ok: false, status: 403, message: 'Only teachers or admins can create homework' };
  }
  const staffId = await resolveStaffIdForUser(user.id);
  if (!staffId) {
    return { ok: false, status: 403, message: 'Teacher staff profile not found' };
  }
  if (parseId(assignment.staff_id) !== staffId) {
    return { ok: false, status: 403, message: 'You can only assign homework for your own subject assignments' };
  }
  return { ok: true, staffId };
}

/**
 * Active students in a class_section for the academic year (lifecycle-scoped).
 */
async function assertManagerCanAccessClassSection(user, classSectionId, academicYearId) {
  if (isAdminRole(user)) return { ok: true };
  if (!isTeacherRole(user)) {
    return { ok: false, status: 403, message: 'Not authorized for this class section' };
  }
  const staffId = await resolveStaffIdForUser(user.id);
  if (!staffId) {
    return { ok: false, status: 403, message: 'Teacher staff profile not found' };
  }
  const r = await query(
    `SELECT 1
     FROM subject_teacher_assignments sta
     WHERE sta.class_section_id = $1
       AND sta.academic_year_id = $2
       AND sta.staff_id = $3
       AND sta.deleted_at IS NULL
     LIMIT 1`,
    [parseId(classSectionId), parseId(academicYearId), staffId]
  );
  if (!r.rows.length) {
    return { ok: false, status: 403, message: 'Not authorized for this class section' };
  }
  return { ok: true };
}

/**
 * Students in section for homework create UI (names + roll for bulk picker).
 */
async function listSectionStudentsForPicker(classSectionId, academicYearId, user) {
  const csId = parseId(classSectionId);
  const ayId = parseId(academicYearId);
  if (!csId || !ayId) {
    return { ok: false, status: 400, message: 'class_section_id and academic_year_id are required' };
  }

  const access = await assertManagerCanAccessClassSection(user, csId, ayId);
  if (!access.ok) return access;

  const r = await query(
    `SELECT
      s.id AS student_id,
      s.roll_number,
      s.admission_number,
      TRIM(CONCAT(COALESCE(su.first_name, ''), ' ', COALESCE(su.last_name, ''))) AS student_name
    FROM class_sections cs
    INNER JOIN students s ON s.deleted_at IS NULL AND s.status = 'Active'
    LEFT JOIN users su ON su.id = s.user_id
    ${lateralCurrentEnrollment('s.id', { academicYearIdParam: '$2' })}
    WHERE cs.id = $1
      AND cs.deleted_at IS NULL
      AND cs.academic_year_id = $2
      AND enr.class_id = cs.class_id
      AND enr.section_id = cs.section_id
      AND enr.academic_year_id = cs.academic_year_id
      AND enr.lifecycle_id IS NOT NULL
    ORDER BY NULLIF(TRIM(s.roll_number), '') NULLS LAST, student_name ASC, s.id ASC`,
    [csId, ayId]
  );

  return { ok: true, students: r.rows };
}

async function listSectionStudentsForRecipients(classSectionId, academicYearId, client = null) {
  const q = client ? client.query.bind(client) : query;
  const csId = parseId(classSectionId);
  const ayId = parseId(academicYearId);
  if (!csId || !ayId) return [];

  const r = await q(
    `SELECT
      s.id AS student_id,
      enr.lifecycle_id AS student_lifecycle_id,
      enr.class_id,
      enr.academic_year_id
    FROM class_sections cs
    INNER JOIN students s ON s.deleted_at IS NULL AND s.status = 'Active'
    ${lateralCurrentEnrollment('s.id', { academicYearIdParam: '$2' })}
    WHERE cs.id = $1
      AND cs.deleted_at IS NULL
      AND cs.academic_year_id = $2
      AND enr.class_id = cs.class_id
      AND enr.section_id = cs.section_id
      AND enr.academic_year_id = cs.academic_year_id
      AND enr.lifecycle_id IS NOT NULL
    ORDER BY s.id ASC`,
    [csId, ayId]
  );
  return r.rows;
}

/**
 * Resolve explicit student_ids with lifecycle for homework context.
 */
async function listStudentsByIdsForRecipients(studentIds, classId, academicYearId, classSectionId, client = null) {
  const q = client ? client.query.bind(client) : query;
  const ids = [...new Set((studentIds || []).map(parseId).filter(Boolean))];
  if (!ids.length) return [];

  const cs = await q(
    `SELECT class_id, section_id, academic_year_id
     FROM class_sections
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [classSectionId]
  );
  if (!cs.rows.length) return [];

  const r = await q(
    `SELECT
      s.id AS student_id,
      enr.lifecycle_id AS student_lifecycle_id,
      enr.class_id,
      enr.academic_year_id
    FROM students s
    ${lateralCurrentEnrollment('s.id', { academicYearIdParam: '$2' })}
    WHERE s.id = ANY($1::int[])
      AND s.deleted_at IS NULL
      AND s.status = 'Active'
      AND enr.class_id = $3
      AND enr.section_id = $4
      AND enr.academic_year_id = $2
      AND enr.lifecycle_id IS NOT NULL`,
    [ids, academicYearId, classId, cs.rows[0].section_id]
  );

  if (r.rows.length !== ids.length) {
    return { ok: false, status: 400, message: 'One or more students are not in this class section for the academic year' };
  }
  return { ok: true, rows: r.rows };
}

async function insertHomeworkRecipients(client, homeworkId, recipientRows) {
  for (const row of recipientRows) {
    await client.query(
      `INSERT INTO homework_recipients (
        homework_id, student_id, student_lifecycle_id,
        academic_year_id, class_id, status, assigned_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'Assigned', NOW(), NOW())
      ON CONFLICT (homework_id, student_id) DO NOTHING`,
      [
        homeworkId,
        row.student_id,
        row.student_lifecycle_id,
        row.academic_year_id,
        row.class_id,
      ]
    );
  }
}

async function insertHomeworkAttachments(client, homeworkId, attachments, uploadedBy) {
  for (const att of attachments || []) {
    await client.query(
      `INSERT INTO homework_attachments (
        homework_id, file_name, file_path, file_type, file_size, uploaded_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        homeworkId,
        att.file_name,
        att.file_path,
        att.file_type || null,
        att.file_size ?? null,
        uploadedBy ?? null,
      ]
    );
  }
}

const HOMEWORK_LIST_FROM = `
  FROM homework h
  INNER JOIN classes c ON c.id = h.class_id
  INNER JOIN class_sections cs ON cs.id = h.class_section_id
  INNER JOIN sections sec ON sec.id = cs.section_id
  INNER JOIN class_subjects csub ON csub.id = h.class_subject_id
  INNER JOIN subjects sub ON sub.id = csub.subject_id
  INNER JOIN staff st ON st.id = h.teacher_id
  LEFT JOIN users u ON u.id = st.user_id
`;

function mapHomeworkListRow(row) {
  const teacherName = [row.teacher_first_name, row.teacher_last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return {
    id: row.id,
    academic_year_id: row.academic_year_id,
    class_id: row.class_id,
    class_section_id: row.class_section_id,
    class_subject_id: row.class_subject_id,
    teacher_id: row.teacher_id,
    teacher_assignment_id: row.teacher_assignment_id,
    title: row.title,
    description: row.description ?? null,
    instructions: row.instructions ?? null,
    homework_type: row.homework_type,
    assign_date: row.assign_date,
    due_date: row.due_date,
    publish_at: row.publish_at,
    visible_until: row.visible_until,
    status: row.status,
    is_graded: row.is_graded,
    max_marks: row.max_marks,
    max_attempts: row.max_attempts,
    resubmission_allowed: row.resubmission_allowed,
    allow_late_submission: row.allow_late_submission,
    created_at: row.created_at,
    updated_at: row.updated_at,
    class_name: row.class_name,
    section_name: row.section_name,
    subject_name: row.subject_name,
    teacher_name: teacherName || null,
    recipient_count: parseInt(row.recipient_count, 10) || 0,
    submitted_count: parseInt(row.submitted_count, 10) || 0,
    pending_evaluation_count: parseInt(row.pending_evaluation_count, 10) || 0,
  };
}

async function listHomework(user, filters = {}) {
  const params = [];
  let where = 'WHERE h.deleted_at IS NULL';

  if (!isAdminRole(user) && isTeacherRole(user)) {
    const staffId = await resolveStaffIdForUser(user.id);
    if (!staffId) {
      return { rows: [], total: 0, page: filters.page || 1, limit: filters.limit || 25 };
    }
    params.push(staffId);
    where += ` AND h.teacher_id = $${params.length}`;
  }

  if (filters.academic_year_id) {
    params.push(filters.academic_year_id);
    where += ` AND h.academic_year_id = $${params.length}`;
  }
  if (filters.class_id) {
    params.push(filters.class_id);
    where += ` AND h.class_id = $${params.length}`;
  }
  if (filters.class_section_id) {
    params.push(filters.class_section_id);
    where += ` AND h.class_section_id = $${params.length}`;
  }
  if (filters.class_subject_id) {
    params.push(filters.class_subject_id);
    where += ` AND h.class_subject_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    where += ` AND h.status = $${params.length}`;
  }
  if (filters.from_date) {
    params.push(filters.from_date);
    where += ` AND h.due_date >= $${params.length}::date`;
  }
  if (filters.to_date) {
    params.push(filters.to_date);
    where += ` AND h.assign_date <= $${params.length}::date`;
  }

  const countRes = await query(
    `SELECT COUNT(*)::int AS total ${HOMEWORK_LIST_FROM} ${where}`,
    params
  );
  const total = countRes.rows[0]?.total ?? 0;

  const page = filters.page || 1;
  const limit = filters.limit || 25;
  const offset = (page - 1) * limit;

  params.push(limit, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;

  const listRes = await query(
    `SELECT
      h.*,
      c.class_name,
      sec.section_name,
      sub.subject_name,
      u.first_name AS teacher_first_name,
      u.last_name AS teacher_last_name,
      (SELECT COUNT(*)::int FROM homework_recipients hr WHERE hr.homework_id = h.id) AS recipient_count,
      (SELECT COUNT(DISTINCT hs.student_id)::int
       FROM homework_submissions hs
       WHERE hs.homework_id = h.id AND hs.deleted_at IS NULL
         AND hs.status NOT IN ('Draft')) AS submitted_count,
      (SELECT COUNT(*)::int
       FROM homework_submissions hs
       WHERE hs.homework_id = h.id AND hs.deleted_at IS NULL
         AND hs.status IN ('Submitted', 'Late', 'Under Review')) AS pending_evaluation_count
    ${HOMEWORK_LIST_FROM}
    ${where}
    ORDER BY h.due_date DESC, h.id DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  return {
    rows: listRes.rows.map(mapHomeworkListRow),
    total,
    page,
    limit,
  };
}

async function getHomeworkById(homeworkId, user) {
  const id = parseId(homeworkId);
  if (!id) return { ok: false, status: 400, message: 'Invalid homework id' };

  const params = [id];
  let scopeSql = '';
  if (!isAdminRole(user) && isTeacherRole(user)) {
    const staffId = await resolveStaffIdForUser(user.id);
    if (!staffId) return { ok: false, status: 403, message: 'Access denied' };
    params.push(staffId);
    scopeSql = ` AND h.teacher_id = $${params.length}`;
  }

  const r = await query(
    `SELECT
      h.*,
      c.class_name,
      sec.section_name,
      sub.subject_name,
      u.first_name AS teacher_first_name,
      u.last_name AS teacher_last_name,
      (SELECT COUNT(*)::int FROM homework_recipients hr WHERE hr.homework_id = h.id) AS recipient_count,
      (SELECT COUNT(DISTINCT hs.student_id)::int
       FROM homework_submissions hs
       WHERE hs.homework_id = h.id AND hs.deleted_at IS NULL
         AND hs.status NOT IN ('Draft')) AS submitted_count,
      (SELECT COUNT(*)::int
       FROM homework_submissions hs
       WHERE hs.homework_id = h.id AND hs.deleted_at IS NULL
         AND hs.status IN ('Submitted', 'Late', 'Under Review')) AS pending_evaluation_count
    ${HOMEWORK_LIST_FROM}
    WHERE h.id = $1 AND h.deleted_at IS NULL${scopeSql}
    LIMIT 1`,
    params
  );

  if (!r.rows.length) {
    return { ok: false, status: 404, message: 'Homework not found' };
  }

  const att = await query(
    `SELECT id, homework_id, file_name, file_path, file_type, file_size, uploaded_by, created_at
     FROM homework_attachments
     WHERE homework_id = $1 AND deleted_at IS NULL
     ORDER BY id ASC`,
    [id]
  );

  const homework = mapHomeworkListRow(r.rows[0]);
  homework.attachments = att.rows;

  return { ok: true, homework };
}

async function assertHomeworkManagerAccess(homeworkId, user) {
  return getHomeworkById(homeworkId, user);
}

const PUBLISHED_LIMITED_FIELDS = new Set([
  'title',
  'description',
  'instructions',
  'due_date',
  'visible_until',
  'resubmission_allowed',
  'allow_late_submission',
  'max_attempts',
  'max_marks',
  'is_graded',
  'publish_at',
]);

async function updateHomework(homeworkId, user, payload) {
  const access = await assertHomeworkManagerAccess(homeworkId, user);
  if (!access.ok) return access;

  const hw = access.homework;
  const isDraft = hw.status === 'Draft';
  const keys = Object.keys(payload);
  if (!keys.length) {
    return { ok: false, status: 400, message: 'No fields to update' };
  }

  if (!isDraft) {
    const invalid = keys.filter((k) => !PUBLISHED_LIMITED_FIELDS.has(k));
    if (invalid.length) {
      return {
        ok: false,
        status: 400,
        message: `Cannot change ${invalid.join(', ')} after homework is published. Edit as Draft or contact admin.`,
      };
    }
  }

  if (payload.assign_date && payload.due_date && payload.due_date < payload.assign_date) {
    return { ok: false, status: 400, message: 'due_date must be on or after assign_date' };
  }
  const due = payload.due_date ?? hw.due_date;
  const assign = payload.assign_date ?? hw.assign_date;
  if (due < assign) {
    return { ok: false, status: 400, message: 'due_date must be on or after assign_date' };
  }

  const isGraded = payload.is_graded ?? hw.is_graded;
  const maxMarks = payload.max_marks !== undefined ? payload.max_marks : hw.max_marks;
  if (isGraded && maxMarks == null) {
    return { ok: false, status: 400, message: 'max_marks is required when homework is graded' };
  }

  const sets = [];
  const params = [];
  let idx = 1;
  const allowed = isDraft
    ? [
        'title',
        'description',
        'instructions',
        'homework_type',
        'assign_date',
        'due_date',
        'publish_at',
        'visible_until',
        'resubmission_allowed',
        'allow_late_submission',
        'max_attempts',
        'is_graded',
        'max_marks',
        'status',
      ]
    : [...PUBLISHED_LIMITED_FIELDS];

  for (const field of allowed) {
    if (payload[field] === undefined) continue;
    if (field === 'assign_date' || field === 'due_date') {
      sets.push(`${field} = $${idx}::date`);
    } else {
      sets.push(`${field} = $${idx}`);
    }
    params.push(payload[field]);
    idx += 1;
  }

  if (!sets.length) {
    return { ok: false, status: 400, message: 'No valid fields to update' };
  }

  sets.push(`updated_at = NOW()`);
  sets.push(`updated_by = $${idx}`);
  params.push(parseId(user?.id));
  idx += 1;
  params.push(parseId(homeworkId));

  await query(
    `UPDATE homework SET ${sets.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL`,
    params
  );

  const refreshed = await getHomeworkById(homeworkId, user);
  if (!refreshed.ok) return refreshed;
  return { ok: true, homework: refreshed.homework };
}

async function patchHomeworkStatus(homeworkId, user, status) {
  const access = await assertHomeworkManagerAccess(homeworkId, user);
  if (!access.ok) return access;

  await query(
    `UPDATE homework SET status = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3 AND deleted_at IS NULL`,
    [status, parseId(user?.id), parseId(homeworkId)]
  );

  const refreshed = await getHomeworkById(homeworkId, user);
  if (!refreshed.ok) return refreshed;
  return { ok: true, homework: refreshed.homework };
}

async function softDeleteHomework(homeworkId, user) {
  const access = await assertHomeworkManagerAccess(homeworkId, user);
  if (!access.ok) return access;

  await query(
    `UPDATE homework SET deleted_at = NOW(), updated_at = NOW(), updated_by = $1 WHERE id = $2 AND deleted_at IS NULL`,
    [parseId(user?.id), parseId(homeworkId)]
  );

  return { ok: true };
}

async function addHomeworkAttachment(homeworkId, user, attachment) {
  const access = await assertHomeworkManagerAccess(homeworkId, user);
  if (!access.ok) return access;

  const id = parseId(homeworkId);
  const r = await query(
    `INSERT INTO homework_attachments (
      homework_id, file_name, file_path, file_type, file_size, uploaded_by, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING *`,
    [
      id,
      attachment.file_name,
      attachment.file_path,
      attachment.file_type || null,
      attachment.file_size ?? null,
      parseId(user?.id),
    ]
  );

  return { ok: true, attachment: r.rows[0] };
}

async function softDeleteHomeworkAttachment(attachmentId, user) {
  const attId = parseId(attachmentId);
  if (!attId) return { ok: false, status: 400, message: 'Invalid attachment id' };

  const att = await query(
    `SELECT ha.id, ha.homework_id FROM homework_attachments ha WHERE ha.id = $1 AND ha.deleted_at IS NULL`,
    [attId]
  );
  if (!att.rows.length) {
    return { ok: false, status: 404, message: 'Attachment not found' };
  }

  const access = await assertHomeworkManagerAccess(att.rows[0].homework_id, user);
  if (!access.ok) return access;

  await query(`UPDATE homework_attachments SET deleted_at = NOW() WHERE id = $1`, [attId]);
  return { ok: true };
}

async function listHomeworkSubmissions(homeworkId, user) {
  const access = await assertHomeworkManagerAccess(homeworkId, user);
  if (!access.ok) return access;

  const id = parseId(homeworkId);
  const r = await query(
    `SELECT
      hs.id,
      hs.homework_id,
      hs.student_id,
      hs.attempt_number,
      hs.submission_date,
      hs.submission_text,
      hs.status,
      hs.is_late,
      hs.marks_obtained,
      hs.teacher_feedback,
      hs.evaluation_date,
      hs.returned_for_correction,
      s.admission_number,
      s.roll_number,
      TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS student_name,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', sa.id,
          'file_name', sa.file_name,
          'file_path', sa.file_path,
          'file_type', sa.file_type,
          'file_size', sa.file_size
        ) ORDER BY sa.id), '[]'::json)
        FROM submission_attachments sa
        WHERE sa.submission_id = hs.id AND sa.deleted_at IS NULL
      ) AS attachments
    FROM homework_submissions hs
    INNER JOIN students s ON s.id = hs.student_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE hs.homework_id = $1 AND hs.deleted_at IS NULL
    ORDER BY student_name ASC, hs.attempt_number DESC`,
    [id]
  );

  return { ok: true, submissions: r.rows, homework: access.homework };
}

async function getSubmissionById(submissionId, user) {
  const subId = parseId(submissionId);
  if (!subId) return { ok: false, status: 400, message: 'Invalid submission id' };

  const r = await query(
    `SELECT hs.*, h.teacher_id, h.max_marks, h.is_graded
     FROM homework_submissions hs
     INNER JOIN homework h ON h.id = hs.homework_id AND h.deleted_at IS NULL
     WHERE hs.id = $1 AND hs.deleted_at IS NULL`,
    [subId]
  );
  if (!r.rows.length) {
    return { ok: false, status: 404, message: 'Submission not found' };
  }

  const access = await assertHomeworkManagerAccess(r.rows[0].homework_id, user);
  if (!access.ok) return access;

  return { ok: true, submission: r.rows[0], homework: access.homework };
}

async function evaluateSubmission(submissionId, user, payload) {
  const loaded = await getSubmissionById(submissionId, user);
  if (!loaded.ok) return loaded;

  const staffId = await resolveStaffIdForUser(user.id);
  const marks = payload.marks_obtained;
  if (loaded.homework.is_graded && marks != null) {
    const max = Number(loaded.homework.max_marks);
    if (Number.isFinite(max) && marks > max) {
      return { ok: false, status: 400, message: `Marks cannot exceed ${max}` };
    }
  }

  const r = await query(
    `UPDATE homework_submissions SET
      marks_obtained = $1,
      teacher_feedback = $2,
      status = $3,
      evaluated_by = $4,
      evaluation_date = NOW(),
      reviewed_at = NOW(),
      returned_for_correction = false,
      updated_at = NOW(),
      updated_by = $5
    WHERE id = $6 AND deleted_at IS NULL
    RETURNING *`,
    [
      marks ?? null,
      payload.teacher_feedback || null,
      payload.status || 'Evaluated',
      staffId,
      parseId(user?.id),
      parseId(submissionId),
    ]
  );

  await query(
    `UPDATE homework_recipients SET status = 'Completed'
     WHERE homework_id = $1 AND student_id = $2`,
    [loaded.submission.homework_id, loaded.submission.student_id]
  );

  return { ok: true, submission: r.rows[0] };
}

async function returnSubmission(submissionId, user, payload) {
  const loaded = await getSubmissionById(submissionId, user);
  if (!loaded.ok) return loaded;

  if (!loaded.homework.resubmission_allowed) {
    return { ok: false, status: 400, message: 'Resubmission is not allowed for this homework' };
  }

  const r = await query(
    `UPDATE homework_submissions SET
      teacher_feedback = $1,
      status = $2,
      returned_for_correction = true,
      reviewed_at = NOW(),
      updated_at = NOW(),
      updated_by = $3
    WHERE id = $4 AND deleted_at IS NULL
    RETURNING *`,
    [
      payload.teacher_feedback || null,
      payload.status || 'Resubmission Requested',
      parseId(user?.id),
      parseId(submissionId),
    ]
  );

  return { ok: true, submission: r.rows[0] };
}

async function listHomeworkRecipients(homeworkId, user) {
  const access = await getHomeworkById(homeworkId, user);
  if (!access.ok) return access;

  const id = parseId(homeworkId);
  const r = await query(
    `SELECT
      hr.id,
      hr.homework_id,
      hr.student_id,
      hr.student_lifecycle_id,
      hr.academic_year_id,
      hr.class_id,
      hr.status,
      hr.viewed_at,
      hr.assigned_at,
      hr.created_at,
      s.admission_number,
      s.roll_number,
      TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS student_name
    FROM homework_recipients hr
    INNER JOIN students s ON s.id = hr.student_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE hr.homework_id = $1
    ORDER BY student_name ASC, hr.id ASC`,
    [id]
  );

  return { ok: true, recipients: r.rows, homework: access.homework };
}

async function createHomework(user, payload, executeTransaction) {
  const assignLoad = await loadTeacherAssignment(payload.teacher_assignment_id);
  if (!assignLoad.ok) return assignLoad;

  const match = assertPayloadMatchesAssignment(payload, assignLoad.assignment);
  if (!match.ok) return match;

  const teacherCheck = await assertTeacherMayUseAssignment(user, assignLoad.assignment);
  if (!teacherCheck.ok) return teacherCheck;

  const teacherId = assignLoad.assignment.staff_id;
  const createdBy = parseId(user?.id);

  let recipientRows = [];
  if (payload.assignment_mode === 'students') {
    const studentsResult = await listStudentsByIdsForRecipients(
      payload.student_ids,
      payload.class_id,
      payload.academic_year_id,
      payload.class_section_id
    );
    if (!studentsResult.ok) return studentsResult;
    recipientRows = studentsResult.rows;
  } else {
    recipientRows = await listSectionStudentsForRecipients(
      payload.class_section_id,
      payload.academic_year_id
    );
  }

  if (!recipientRows.length) {
    return {
      ok: false,
      status: 400,
      message: 'No active students found for this assignment',
    };
  }

  if (payload.is_graded && payload.max_marks == null) {
    return { ok: false, status: 400, message: 'max_marks is required when homework is graded' };
  }

  const homeworkRow = await executeTransaction(async (client) => {
    const ins = await client.query(
      `INSERT INTO homework (
        academic_year_id, class_id, class_section_id, class_subject_id,
        teacher_id, teacher_assignment_id,
        title, description, instructions, homework_type,
        assign_date, due_date, publish_at, visible_until,
        resubmission_allowed, allow_late_submission, max_attempts,
        is_graded, max_marks, status,
        created_by, updated_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11::date, $12::date, $13, $14,
        $15, $16, $17,
        $18, $19, $20,
        $21, $21, NOW(), NOW()
      )
      RETURNING *`,
      [
        payload.academic_year_id,
        payload.class_id,
        payload.class_section_id,
        payload.class_subject_id,
        teacherId,
        payload.teacher_assignment_id,
        payload.title,
        payload.description || null,
        payload.instructions || null,
        payload.homework_type,
        payload.assign_date,
        payload.due_date,
        payload.publish_at || null,
        payload.visible_until || null,
        payload.resubmission_allowed,
        payload.allow_late_submission,
        payload.max_attempts,
        payload.is_graded,
        payload.max_marks ?? null,
        payload.status,
        createdBy,
      ]
    );

    const hw = ins.rows[0];
    await insertHomeworkAttachments(client, hw.id, payload.attachments, createdBy);
    await insertHomeworkRecipients(client, hw.id, recipientRows);
    return hw;
  });

  const detail = await getHomeworkById(homeworkRow.id, user);
  return {
    ok: true,
    homework: detail.homework,
    recipient_count: recipientRows.length,
  };
}

const { getParentsForUser } = require('../utils/parentUserMatch');

async function resolveLinkedStudentIdsForPortalUser(userId) {
  const { studentIds } = await getParentsForUser(userId).catch(() => ({ studentIds: [] }));
  return (studentIds || []).map((id) => parseId(id)).filter(Boolean);
}

async function assertPortalAccessToStudent(userId, studentId) {
  const sid = parseId(studentId);
  if (!sid) {
    return { ok: false, status: 400, message: 'Invalid student id' };
  }
  const allowed = await resolveLinkedStudentIdsForPortalUser(userId);
  if (!allowed.includes(sid)) {
    return { ok: false, status: 403, message: 'Not authorized for this student' };
  }
  return { ok: true, studentId: sid };
}

async function resolveStudentIdForUser(userId) {
  const uid = parseId(userId);
  if (!uid) return null;
  const r = await query(
    `SELECT s.id
     FROM students s
     WHERE s.user_id = $1 AND s.deleted_at IS NULL AND s.status = 'Active'
     LIMIT 1`,
    [uid]
  );
  return r.rows[0]?.id ?? null;
}

const STUDENT_VISIBLE_HOMEWORK_SQL = `
  h.deleted_at IS NULL
  AND h.status = 'Published'
  AND (h.publish_at IS NULL OR h.publish_at <= NOW())
  AND (h.visible_until IS NULL OR h.visible_until >= NOW())
`;

async function assertStudentRecipient(homeworkId, studentId) {
  const r = await query(
    `SELECT hr.id, hr.student_lifecycle_id, hr.academic_year_id, hr.class_id, hr.status AS recipient_status
     FROM homework_recipients hr
     INNER JOIN homework h ON h.id = hr.homework_id
     WHERE hr.homework_id = $1 AND hr.student_id = $2 AND ${STUDENT_VISIBLE_HOMEWORK_SQL}
     LIMIT 1`,
    [homeworkId, studentId]
  );
  if (!r.rows.length) {
    return { ok: false, status: 404, message: 'Homework not found or not available' };
  }
  return { ok: true, recipient: r.rows[0] };
}

async function listHomeworkForStudent(studentId) {
  const r = await query(
    `SELECT
      h.id,
      h.title,
      h.homework_type,
      h.assign_date,
      h.due_date,
      h.is_graded,
      h.max_marks,
      h.max_attempts,
      h.allow_late_submission,
      sub.subject_name,
      sec.section_name,
      c.class_name,
      hr.status AS recipient_status,
      hr.viewed_at,
      (
        SELECT hs.status
        FROM homework_submissions hs
        WHERE hs.homework_id = h.id AND hs.student_id = $1 AND hs.deleted_at IS NULL
        ORDER BY hs.attempt_number DESC
        LIMIT 1
      ) AS latest_submission_status,
      (
        SELECT hs.attempt_number
        FROM homework_submissions hs
        WHERE hs.homework_id = h.id AND hs.student_id = $1 AND hs.deleted_at IS NULL
        ORDER BY hs.attempt_number DESC
        LIMIT 1
      ) AS latest_attempt_number
    FROM homework_recipients hr
    INNER JOIN homework h ON h.id = hr.homework_id
    INNER JOIN classes c ON c.id = h.class_id
    INNER JOIN class_sections cs ON cs.id = h.class_section_id
    INNER JOIN sections sec ON sec.id = cs.section_id
    INNER JOIN class_subjects csub ON csub.id = h.class_subject_id
    INNER JOIN subjects sub ON sub.id = csub.subject_id
    WHERE hr.student_id = $1 AND ${STUDENT_VISIBLE_HOMEWORK_SQL}
    ORDER BY h.due_date ASC, h.id DESC`,
    [studentId]
  );

  return r.rows;
}

async function listMyHomework(user) {
  const studentId = await resolveStudentIdForUser(user.id);
  if (!studentId) {
    return { ok: false, status: 403, message: 'Student profile not found' };
  }
  const items = await listHomeworkForStudent(studentId);
  return { ok: true, items };
}

async function listChildHomework(studentId, user) {
  const access = await assertPortalAccessToStudent(user.id, studentId);
  if (!access.ok) return access;
  const items = await listHomeworkForStudent(access.studentId);
  return { ok: true, items, student_id: access.studentId };
}

async function getHomeworkDetailForStudent(homeworkId, studentId, { markViewed = true } = {}) {
  const hid = parseId(homeworkId);
  const recip = await assertStudentRecipient(hid, studentId);
  if (!recip.ok) return recip;

  const hwRes = await query(
    `SELECT
      h.*,
      sub.subject_name,
      sec.section_name,
      c.class_name,
      TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS teacher_name
    FROM homework h
    INNER JOIN classes c ON c.id = h.class_id
    INNER JOIN class_sections cs ON cs.id = h.class_section_id
    INNER JOIN sections sec ON sec.id = cs.section_id
    INNER JOIN class_subjects csub ON csub.id = h.class_subject_id
    INNER JOIN subjects sub ON sub.id = csub.subject_id
    INNER JOIN staff st ON st.id = h.teacher_id
    LEFT JOIN users u ON u.id = st.user_id
    WHERE h.id = $1 AND ${STUDENT_VISIBLE_HOMEWORK_SQL}
    LIMIT 1`,
    [hid]
  );
  if (!hwRes.rows.length) {
    return { ok: false, status: 404, message: 'Homework not found' };
  }

  const att = await query(
    `SELECT id, file_name, file_path, file_type, file_size, created_at
     FROM homework_attachments
     WHERE homework_id = $1 AND deleted_at IS NULL
     ORDER BY id ASC`,
    [hid]
  );

  const subs = await query(
    `SELECT
      hs.*,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', sa.id,
          'file_name', sa.file_name,
          'file_path', sa.file_path,
          'file_type', sa.file_type,
          'file_size', sa.file_size
        ) ORDER BY sa.id), '[]'::json)
        FROM submission_attachments sa
        WHERE sa.submission_id = hs.id AND sa.deleted_at IS NULL
      ) AS attachments
    FROM homework_submissions hs
    WHERE hs.homework_id = $1 AND hs.student_id = $2 AND hs.deleted_at IS NULL
    ORDER BY hs.attempt_number ASC`,
    [hid, studentId]
  );

  if (markViewed && recip.recipient.recipient_status === 'Assigned') {
    await query(
      `UPDATE homework_recipients
       SET viewed_at = NOW(), status = 'Viewed'
       WHERE homework_id = $1 AND student_id = $2 AND status = 'Assigned'`,
      [hid, studentId]
    );
  }

  const row = hwRes.rows[0];
  const homework = {
    ...mapHomeworkListRow(row),
    description: row.description,
    instructions: row.instructions,
    resubmission_allowed: row.resubmission_allowed,
    allow_late_submission: row.allow_late_submission,
    attachments: att.rows,
    submissions: subs.rows,
    recipient_status: recip.recipient.recipient_status,
  };

  return { ok: true, homework, student_id: studentId };
}

async function getMyHomeworkById(homeworkId, user, options = {}) {
  const studentId = await resolveStudentIdForUser(user.id);
  if (!studentId) {
    return { ok: false, status: 403, message: 'Student profile not found' };
  }
  return getHomeworkDetailForStudent(homeworkId, studentId, options);
}

async function getChildHomeworkById(homeworkId, studentId, user) {
  const access = await assertPortalAccessToStudent(user.id, studentId);
  if (!access.ok) return access;
  return getHomeworkDetailForStudent(homeworkId, access.studentId, { markViewed: false });
}

async function getLatestSubmission(homeworkId, studentId) {
  const r = await query(
    `SELECT * FROM homework_submissions
     WHERE homework_id = $1 AND student_id = $2 AND deleted_at IS NULL
     ORDER BY attempt_number DESC
     LIMIT 1`,
    [homeworkId, studentId]
  );
  return r.rows[0] ?? null;
}

function canSubmitHomework(homework, latestSubmission) {
  if (homework.status !== 'Published') {
    return { ok: false, message: 'Homework is not open for submission' };
  }
  const now = new Date();
  const dueEnd = new Date(homework.due_date);
  dueEnd.setHours(23, 59, 59, 999);
  const isLate = now > dueEnd;
  if (isLate && !homework.allow_late_submission) {
    return { ok: false, message: 'Late submission is not allowed' };
  }

  if (!latestSubmission) {
    return { ok: true, isLate, nextAttempt: 1, isNewAttempt: true };
  }

  const st = latestSubmission.status;
  if (st === 'Draft') {
    return { ok: true, isLate, nextAttempt: latestSubmission.attempt_number, isNewAttempt: false };
  }

  const resubmitStates = ['Returned', 'Resubmission Requested'];
  if (resubmitStates.includes(st) && homework.resubmission_allowed) {
    const next = latestSubmission.attempt_number + 1;
    if (next > homework.max_attempts) {
      return { ok: false, message: 'Maximum submission attempts reached' };
    }
    return { ok: true, isLate, nextAttempt: next, isNewAttempt: true };
  }

  if (st === 'Submitted' || st === 'Late' || st === 'Under Review') {
    return { ok: false, message: 'Submission is already under review' };
  }
  if (st === 'Evaluated') {
    if (!homework.resubmission_allowed) {
      return { ok: false, message: 'Homework already evaluated' };
    }
    const next = latestSubmission.attempt_number + 1;
    if (next > homework.max_attempts) {
      return { ok: false, message: 'Maximum submission attempts reached' };
    }
    return { ok: true, isLate, nextAttempt: next, isNewAttempt: true };
  }

  return { ok: false, message: 'Cannot submit at this time' };
}

async function insertSubmissionAttachments(client, submissionId, attachments, uploadedBy) {
  for (const att of attachments || []) {
    await client.query(
      `INSERT INTO submission_attachments (
        submission_id, file_name, file_path, file_type, file_size, uploaded_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        submissionId,
        att.file_name,
        att.file_path,
        att.file_type || null,
        att.file_size ?? null,
        uploadedBy,
      ]
    );
  }
}

async function submitMyHomework(homeworkId, user, payload, executeTransaction) {
  const loaded = await getMyHomeworkById(homeworkId, user, { markViewed: false });
  if (!loaded.ok) return loaded;

  const studentId = loaded.student_id;
  const hw = loaded.homework;
  const latest = await getLatestSubmission(parseId(homeworkId), studentId);

  let gate;
  if (payload.status === 'Draft') {
    if (latest && latest.status !== 'Draft') {
      return {
        ok: false,
        status: 400,
        message: 'Cannot save draft after a final submission exists for this attempt',
      };
    }
    gate = {
      ok: true,
      isLate: false,
      nextAttempt: latest?.attempt_number || 1,
      isNewAttempt: !latest,
    };
  } else {
    gate = canSubmitHomework(hw, latest);
    if (!gate.ok) return { ok: false, status: 400, message: gate.message };
  }

  const recip = await assertStudentRecipient(parseId(homeworkId), studentId);
  if (!recip.ok) return recip;

  const submissionStatus =
    payload.status === 'Draft'
      ? 'Draft'
      : gate.isLate
        ? 'Late'
        : 'Submitted';

  const row = await executeTransaction(async (client) => {
    let submissionId;
    if (gate.isNewAttempt) {
      const ins = await client.query(
        `INSERT INTO homework_submissions (
          homework_id, student_id, student_lifecycle_id, academic_year_id, class_id,
          attempt_number, submission_date, submission_text, status, is_late,
          created_by, updated_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $10, NOW(), NOW())
        RETURNING *`,
        [
          parseId(homeworkId),
          studentId,
          recip.recipient.student_lifecycle_id,
          recip.recipient.academic_year_id,
          recip.recipient.class_id,
          gate.nextAttempt,
          payload.submission_text || null,
          submissionStatus,
          gate.isLate === true,
          parseId(user?.id),
        ]
      );
      submissionId = ins.rows[0].id;
      if (payload.status === 'Submitted') {
        await insertSubmissionAttachments(client, submissionId, payload.attachments, parseId(user?.id));
      }
      return ins.rows[0];
    }

    const upd = await client.query(
      `UPDATE homework_submissions SET
        submission_text = $1,
        status = $2,
        is_late = $3,
        submission_date = CASE WHEN $4 = 'Submitted' THEN NOW() ELSE submission_date END,
        updated_at = NOW(),
        updated_by = $5
      WHERE id = $6 AND student_id = $7 AND deleted_at IS NULL
      RETURNING *`,
      [
        payload.submission_text || null,
        submissionStatus,
        gate.isLate === true,
        submissionStatus,
        parseId(user?.id),
        latest.id,
        studentId,
      ]
    );
    submissionId = upd.rows[0].id;
    if (payload.status === 'Submitted') {
      await client.query(
        `UPDATE submission_attachments SET deleted_at = NOW() WHERE submission_id = $1`,
        [submissionId]
      );
      await insertSubmissionAttachments(client, submissionId, payload.attachments, parseId(user?.id));
    }
    return upd.rows[0];
  });

  if (payload.status === 'Submitted') {
    await query(
      `UPDATE homework_recipients SET status = 'Completed' WHERE homework_id = $1 AND student_id = $2`,
      [parseId(homeworkId), studentId]
    );
  }

  const refreshed = await getMyHomeworkById(homeworkId, user, { markViewed: false });
  return { ok: true, submission: row, homework: refreshed.homework };
}

module.exports = {
  parseId,
  isAdminRole,
  isTeacherRole,
  resolveStaffIdForUser,
  resolveStudentIdForUser,
  listHomework,
  getHomeworkById,
  listHomeworkRecipients,
  createHomework,
  updateHomework,
  patchHomeworkStatus,
  softDeleteHomework,
  addHomeworkAttachment,
  softDeleteHomeworkAttachment,
  listHomeworkSubmissions,
  evaluateSubmission,
  returnSubmission,
  listMyHomework,
  listChildHomework,
  getMyHomeworkById,
  getChildHomeworkById,
  submitMyHomework,
  loadTeacherAssignment,
  listSectionStudentsForRecipients,
  listSectionStudentsForPicker,
};
