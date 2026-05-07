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
  if (details !== undefined) {
    err.details = details;
    err.data = details;
  }
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

/** Parse DB/ISO date to local Date at noon (stable day boundaries). */
function parseLocalDateOnly(value) {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
  }
  const s = String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 12, 0, 0, 0);
}

function formatLocalDateOnly(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** Whole calendar days from `from` to `to` (to - from). */
function calendarDaysBetween(to, from) {
  const a = parseLocalDateOnly(to);
  const b = parseLocalDateOnly(from);
  if (!a || !b) return 0;
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function addCalendarDays(value, deltaDays) {
  const d = parseLocalDateOnly(value);
  if (!d) return null;
  d.setDate(d.getDate() + deltaDays);
  return d;
}

/**
 * uq_timetable_teacher_no_overlap is on (teacher, day, slot, overlapping date range).
 * Multiple source rows can share that key (e.g. different sections) with the same full-year range;
 * cloning would insert identical ranges → exclusion failure. Split the target year's inclusive
 * [rangeStart, rangeEnd] into partCount contiguous slices; this partition is partIndex (0-based).
 */
function partitionInclusiveRange(rangeStart, rangeEnd, partIndex, partCount) {
  const s = parseLocalDateOnly(rangeStart);
  const e = parseLocalDateOnly(rangeEnd);
  if (!s || !e) return { from: s, to: e };
  let pc = Math.max(1, parseInt(partCount, 10) || 1);
  let pi = parseInt(partIndex, 10) || 0;
  if (pi < 0) pi = 0;
  if (pi >= pc) pi = pc - 1;
  const totalDays = calendarDaysBetween(e, s) + 1;
  if (totalDays < 1) return { from: s, to: s };
  const base = Math.floor(totalDays / pc);
  const rem = totalDays % pc;
  let startOffset = 0;
  for (let j = 0; j < pi; j++) {
    startOffset += base + (j < rem ? 1 : 0);
  }
  const lenI = base + (pi < rem ? 1 : 0);
  const fromD = addCalendarDays(s, startOffset);
  const toD = addCalendarDays(s, startOffset + Math.max(0, lenI - 1));
  return { from: fromD, to: toD };
}

function teacherSlotOverlapKey(teacherId, dayOfWeek, timeSlotId) {
  return `${teacherId}\t${dayOfWeek}\t${timeSlotId}`;
}

const TIMETABLE_EXCLUSION_CONSTRAINTS = new Set([
  'uq_timetable_teacher_no_overlap',
  'uq_timetable_section_no_overlap',
  'uq_timetable_room_no_overlap',
]);

/** Mon..Sun labels for weekday 1..7 */
const DOW_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function timetableDowShort(dow) {
  const n = Number(dow);
  return DOW_SHORT[n] || `day ${n}`;
}

function timetableRangeLabel(validFrom, validTo) {
  const a = validFrom ? String(validFrom).slice(0, 10) : '?';
  if (validTo == null || String(validTo).trim() === '') return `${a} → (no end date)`;
  return `${a} → ${String(validTo).slice(0, 10)}`;
}

function isPgTimetableExclusionViolation(pgErr) {
  return !!(pgErr && pgErr.code === '23P01' && TIMETABLE_EXCLUSION_CONSTRAINTS.has(String(pgErr.constraint || '')));
}

const OVERLAP_TAIL = `
  AND daterange(cs.valid_from, COALESCE(cs.valid_to, 'infinity'::date))
      && daterange($VF::date, COALESCE($VT::date, 'infinity'::date))
  AND cs.day_of_week = $DOW
  AND cs.time_slot_id = $SLOT`;

/** Conflicting timetable rows matching the exclusion constraint keys + overlapping date ranges. */
async function selectOverlappingClassSchedules(
  client,
  { scopedAcademicYearId, teacherId, classSectionId, classRoomId, dayOfWeek, timeSlotId, validFromStr, validToStr }
) {
  const vf = validFromStr;
  const vt = validToStr === '' || validToStr == null ? null : validToStr;
  const dow = dayOfWeek;
  const sid = timeSlotId;

  const BASE_SELECT = `
    SELECT cs.id,
           cs.academic_year_id,
           ay.year_name,
           ay.end_date::text AS academic_year_end_date,
           cs.teacher_id,
           cs.day_of_week,
           cs.time_slot_id,
           ts.slot_name AS slot_label,
           cs.valid_from::text AS valid_from,
           cs.valid_to::text AS valid_to,
           cs.class_section_id,
           cs.class_room_id
    FROM class_schedules cs
    LEFT JOIN academic_years ay ON ay.id = cs.academic_year_id
    LEFT JOIN timetable_time_slots ts ON ts.id = cs.time_slot_id
    WHERE `;

  if (teacherId) {
    const tail = OVERLAP_TAIL.replace('$VF', '$3').replace('$VT', '$4').replace('$DOW', '$5').replace('$SLOT', '$6');
    const r1 = await client.query(
      `${BASE_SELECT} cs.academic_year_id = $1
         AND cs.teacher_id = $2
         ${tail}
       ORDER BY cs.valid_from NULLS LAST, cs.id ASC
       LIMIT 15`,
      [scopedAcademicYearId, teacherId, vf, vt, dow, sid]
    );
    if (r1.rows.length) return { rows: r1.rows, usedGlobalScope: false };
    const tailG = OVERLAP_TAIL.replace('$VF', '$2').replace('$VT', '$3').replace('$DOW', '$4').replace('$SLOT', '$5');
    const r2 = await client.query(
      `${BASE_SELECT} cs.teacher_id = $1
         ${tailG}
       ORDER BY cs.academic_year_id, cs.valid_from NULLS LAST, cs.id ASC
       LIMIT 15`,
      [teacherId, vf, vt, dow, sid]
    );
    return { rows: r2.rows, usedGlobalScope: true };
  }

  if (classSectionId) {
    const tail = OVERLAP_TAIL.replace('$VF', '$3').replace('$VT', '$4').replace('$DOW', '$5').replace('$SLOT', '$6');
    const r1 = await client.query(
      `${BASE_SELECT} cs.academic_year_id = $1
         AND cs.class_section_id = $2
         ${tail}
       ORDER BY cs.valid_from NULLS LAST, cs.id ASC
       LIMIT 15`,
      [scopedAcademicYearId, classSectionId, vf, vt, dow, sid]
    );
    if (r1.rows.length) return { rows: r1.rows, usedGlobalScope: false };
    const tailG = OVERLAP_TAIL.replace('$VF', '$2').replace('$VT', '$3').replace('$DOW', '$4').replace('$SLOT', '$5');
    const r2 = await client.query(
      `${BASE_SELECT} cs.class_section_id = $1
         ${tailG}
       ORDER BY cs.academic_year_id, cs.valid_from NULLS LAST, cs.id ASC
       LIMIT 15`,
      [classSectionId, vf, vt, dow, sid]
    );
    return { rows: r2.rows, usedGlobalScope: true };
  }

  if (classRoomId) {
    const tail = OVERLAP_TAIL.replace('$VF', '$3').replace('$VT', '$4').replace('$DOW', '$5').replace('$SLOT', '$6');
    const r1 = await client.query(
      `${BASE_SELECT} cs.academic_year_id = $1
         AND cs.class_room_id = $2
         ${tail}
       ORDER BY cs.valid_from NULLS LAST, cs.id ASC
       LIMIT 15`,
      [scopedAcademicYearId, classRoomId, vf, vt, dow, sid]
    );
    if (r1.rows.length) return { rows: r1.rows, usedGlobalScope: false };
    const tailG = OVERLAP_TAIL.replace('$VF', '$2').replace('$VT', '$3').replace('$DOW', '$4').replace('$SLOT', '$5');
    const r2 = await client.query(
      `${BASE_SELECT} cs.class_room_id = $1
         ${tailG}
       ORDER BY cs.academic_year_id, cs.valid_from NULLS LAST, cs.id ASC
       LIMIT 15`,
      [classRoomId, vf, vt, dow, sid]
    );
    return { rows: r2.rows, usedGlobalScope: true };
  }

  return { rows: [], usedGlobalScope: false };
}

/**
 * older rows with valid_to NULL → daterange upper bound "infinity", which blocks later years when the DB
 * enforces teacher/section/room overlap without academic_year_id in the constraint.
 * Closes those rows using their academic year's end_date (or the source session end / day before the new row)
 * — data-only, no DDL.
 */
async function closeOpenEndedOverlapsOutsideTargetYear(
  client,
  overlapArgs,
  { targetYearId, sourceYearId, sourceYearEndDateStr }
) {
  const bundle = await selectOverlappingClassSchedules(client, overlapArgs);
  let closed = 0;
  const patchedIds = [];
  for (const r of bundle.rows) {
    if (Number(r.academic_year_id) === Number(targetYearId)) continue;
    if (r.valid_to != null && String(r.valid_to).trim() !== '') continue;

    let endStr = r.academic_year_end_date ? String(r.academic_year_end_date).slice(0, 10) : null;
    if (!endStr || !/^\d{4}-\d{2}-\d{2}$/.test(endStr)) {
      if (sourceYearEndDateStr && Number(r.academic_year_id) === Number(sourceYearId)) {
        endStr = sourceYearEndDateStr;
      }
    }
    if (!endStr || !/^\d{4}-\d{2}-\d{2}$/.test(endStr)) {
      if (Number(r.academic_year_id) === Number(sourceYearId) && overlapArgs.validFromStr) {
        const inc = parseLocalDateOnly(overlapArgs.validFromStr);
        const dayBefore = inc ? addCalendarDays(inc, -1) : null;
        endStr = dayBefore ? formatLocalDateOnly(dayBefore) : null;
      }
    }
    if (!endStr || !/^\d{4}-\d{2}-\d{2}$/.test(endStr)) continue;

    const vf = r.valid_from ? String(r.valid_from).slice(0, 10) : null;
    if (vf && endStr <= vf) continue;

    const up = await client.query(
      `UPDATE class_schedules
       SET valid_to = $2::date, updated_at = NOW()
       WHERE id = $1 AND valid_to IS NULL`,
      [r.id, endStr]
    );
    const n = up.rowCount != null ? up.rowCount : 0;
    if (n > 0) {
      closed += n;
      patchedIds.push(Number(r.id));
    }
  }
  return { closed, patchedIds };
}

async function reconcileTimetableOverlapsBeforeTripleKeyInsert(client, opts) {
  const {
    targetYearId,
    sourceYearId,
    sourceYearEndDateStr,
    teacherId,
    classSectionId,
    classRoomId,
    dow,
    slotId,
    validFromSql,
    validToSql,
  } = opts;
  const base = {
    scopedAcademicYearId: targetYearId,
    dayOfWeek: dow,
    timeSlotId: slotId,
    validFromStr: validFromSql,
    validToStr: validToSql,
  };
  const meta = { targetYearId, sourceYearId, sourceYearEndDateStr };
  const a = await closeOpenEndedOverlapsOutsideTargetYear(
    client,
    { ...base, teacherId, classSectionId: null, classRoomId: null },
    meta
  );
  const b = await closeOpenEndedOverlapsOutsideTargetYear(
    client,
    { ...base, teacherId: null, classSectionId, classRoomId: null },
    meta
  );
  const c = await closeOpenEndedOverlapsOutsideTargetYear(
    client,
    { ...base, teacherId: null, classSectionId: null, classRoomId },
    meta
  );
  return a.closed + b.closed + c.closed;
}

async function timetableExclusionToCloneError(client, pgErr, attempted) {
  const cname = String(pgErr.constraint || '');
  let kind = 'timetable';
  let cloneCode = 'ACADEMIC_YEAR_CLONE_TIMETABLE_OVERLAP';

  let slotLabel = attempted.slot_label;
  if (!slotLabel && toPositiveInt(attempted.time_slot_id)) {
    try {
      const sn = await client.query('SELECT slot_name FROM timetable_time_slots WHERE id = $1 LIMIT 1', [
        attempted.time_slot_id,
      ]);
      slotLabel = sn.rows[0]?.slot_name || null;
    } catch (_) {
      slotLabel = null;
    }
  }

  let teacherId;
  let classSectionId;
  let classRoomId;

  if (cname === 'uq_timetable_teacher_no_overlap') {
    kind = 'teacher';
    cloneCode = 'ACADEMIC_YEAR_CLONE_TIMETABLE_TEACHER_OVERLAP';
    teacherId = attempted.teacher_id;
  } else if (cname === 'uq_timetable_section_no_overlap') {
    kind = 'section';
    cloneCode = 'ACADEMIC_YEAR_CLONE_TIMETABLE_SECTION_OVERLAP';
    classSectionId = attempted.class_section_id;
  } else if (cname === 'uq_timetable_room_no_overlap') {
    kind = 'room';
    cloneCode = 'ACADEMIC_YEAR_CLONE_TIMETABLE_ROOM_OVERLAP';
    classRoomId = attempted.class_room_id;
  }

  let conflicts = [];
  let usedGlobalScope = false;

  try {
    const bundle = await selectOverlappingClassSchedules(client, {
      scopedAcademicYearId: attempted.academic_year_id,
      teacherId,
      classSectionId,
      classRoomId,
      dayOfWeek: attempted.day_of_week,
      timeSlotId: attempted.time_slot_id,
      validFromStr: attempted.valid_from,
      validToStr: attempted.valid_to,
    });
    conflicts = bundle.rows || [];
    usedGlobalScope = bundle.usedGlobalScope;
  } catch (diagErr) {
    console.warn('Timetable overlap diagnosis query failed:', diagErr?.message);
  }

  const attemptLine = `Source timetable row #${
    attempted.source_class_schedule_id
  }: ${timetableDowShort(attempted.day_of_week)}, period "${slotLabel || `#${attempted.time_slot_id}`}", dates ${timetableRangeLabel(
    attempted.valid_from,
    attempted.valid_to
  )}.`;

  const conflictLines =
    conflicts.length > 0
      ? conflicts.map((row, idx) => {
          const yr = row.year_name || `(academic_year_id ${row.academic_year_id})`;
          const sl = row.slot_label || `slot ${row.time_slot_id}`;
          return `${idx + 1}. ${yr} — ${timetableDowShort(row.day_of_week)} ${sl}, ${timetableRangeLabel(row.valid_from, row.valid_to)} (timetable id ${row.id})`;
        })
      : [];

  let headline =
    kind === 'teacher'
      ? 'This teacher already has another class in the same period while those date ranges overlap.'
      : kind === 'section'
        ? 'This class section already has another subject in the same period while those date ranges overlap.'
        : 'This room already has another class in the same period while those date ranges overlap.';

  if (kind === 'timetable') {
    headline = 'Another timetable row uses the same slot and overlapping dates.';
  }

  const detailStr = typeof pgErr?.detail === 'string' ? pgErr.detail.trim() : '';
  const legacyGlobalOverlapKeyDetails = detailStr.length > 0 && !/\bacademic_year_id\b/i.test(detailStr);
  const conflictingOpenEndedRow = conflicts.some((c) => c.valid_to == null || String(c.valid_to).trim() === '');
  const infinityOverlap = conflictingOpenEndedRow || /\binfinity\b/i.test(detailStr);

  let explainParts = [];
  if (infinityOverlap || conflictingOpenEndedRow) {
    explainParts.push(
      `Why PostgreSQL rejects this is not vague: overlapping entries must not share the same teacher, SAME weekday (${timetableDowShort(
        attempted.day_of_week
      )}), SAME period (${slotLabel || `#${attempted.time_slot_id}`}), and overlapping calendar ranges.`
    );
    if (infinityOverlap) {
      explainParts.push(
        `The conflicting row ends with "(no end date)". In Postgres that becomes "...infinity)" — so chronologically it never stops covering later years. Your new cloned row (${timetableRangeLabel(
          attempted.valid_from,
          attempted.valid_to
        )}) still falls inside that open-ended timeline, hence the exclusion violation — not random corruption.`
      );
    }
  }
  if (legacyGlobalOverlapKeyDetails || usedGlobalScope) {
    explainParts.push(
      'The violation message lists only teacher, weekday, slot, and dateranges (no academic year in that key tuple). Overlap is enforced across ALL academic sessions — so leftover open-ended rows from an older session can block cloning the next one.'
    );
  }

  const crossYearHint =
    usedGlobalScope &&
    conflicts.some((r) => Number(r.academic_year_id) !== Number(attempted.academic_year_id))
      ? ' Rows from older academic sessions appear in this conflict; open-ended validity ranges can block clones across sessions until end dates are set.'
      : '';
  const hasCrossYearHint = crossYearHint.length > 0;

  const unresolvedOpenIds = conflicts
    .filter((c) => c.valid_to == null || String(c.valid_to).trim() === '')
    .map((c) => c.id);

  let manualRemediation = '';
  if (unresolvedOpenIds.length) {
    manualRemediation += `\n\nWhat you can change in data (constraints unchanged): set a validity end date on timetable id(s) ${unresolvedOpenIds.join(
      ', '
    )}, and/or fill the END date on their academic_year record so clones can clamp old schedules automatically.`;
  }

  const postgresDetail =
    pgErr && typeof pgErr.detail === 'string' && pgErr.detail.trim() !== '' ? `\n(Raw PostgreSQL detail: ${pgErr.detail.trim()})` : '';

  const explainBlock =
    explainParts.length > 0
      ? `\n\n${explainParts.join('\n\n')}`
      : '';

  const summary =
    `Timetable copy failed (${cname}). ${headline} ${attemptLine}${explainBlock}${
      conflictLines.length ? `\n\nOverlapping rows already in the database:\n${conflictLines.join('\n')}` : ''
    }${pgErr && !conflictLines.length ? postgresDetail : ''}${manualRemediation}${crossYearHint}`;

  return makeCloneError(409, cloneCode, summary, {
    constraint: cname,
    kind,
    infinity_open_ended_overlap: infinityOverlap,
    legacy_global_overlap_key_in_detail: legacyGlobalOverlapKeyDetails,
    postgres_detail: pgErr?.detail ?? null,
    source_class_schedule_id: attempted.source_class_schedule_id ?? null,
    attempted: {
      academic_year_id: attempted.academic_year_id,
      teacher_id: attempted.teacher_id,
      class_section_id: attempted.class_section_id,
      class_room_id: attempted.class_room_id,
      day_of_week: attempted.day_of_week,
      time_slot_id: attempted.time_slot_id,
      valid_from: attempted.valid_from,
      valid_to: attempted.valid_to,
    },
    conflicts,
    scoped_query_used_global_fallback: usedGlobalScope,
    cross_year_hint: hasCrossYearHint,
  });
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
        department_name, department_code, head_of_department, description, is_active, created_by, updated_at, academic_year_id
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

async function cloneDesignations(client, departmentMap, createdByStaffId, _targetYearId) {
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
        designation_name, department_id, salary_range_min, salary_range_max, description, is_active, created_by, updated_at, academic_year_id
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
        createdByStaffId || null,
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

    const slotExists = await client.query('SELECT id FROM timetable_time_slots WHERE id = $1 LIMIT 1', [timeSlotId]);
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
        room_number, teacher_id, class_room_id, is_active, created_by, updated_at
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
      `INSERT INTO teacher_routines (teacher_id, class_schedule_id, academic_year_id, is_active, created_at, created_by, updated_at)
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

async function isTripleKeyTenantLayout(client) {
  if (await columnExists(client, 'classes', 'academic_year_id')) return false;
  if (!(await tableExists(client, 'class_sections'))) return false;
  if (!(await columnExists(client, 'class_sections', 'academic_year_id'))) return false;
  return true;
}

function tenantSoftDeleteCs(client) {
  return columnExists(client, 'class_sections', 'deleted_at');
}

function tenantSoftDeleteCsub(client) {
  return columnExists(client, 'class_subjects', 'deleted_at');
}

function tenantSoftDeleteSta(client) {
  return columnExists(client, 'subject_teacher_assignments', 'deleted_at');
}

async function validatePreconditionsTenant(client, sourceYearId, targetYearId, options) {
  const sourceYear = await client.query('SELECT id FROM academic_years WHERE id = $1 LIMIT 1', [sourceYearId]);
  if (!sourceYear.rows.length) {
    throw makeCloneError(404, 'ACADEMIC_YEAR_COPY_SOURCE_NOT_FOUND', 'Source academic year not found for cloning');
  }
  const targetYear = await client.query('SELECT id FROM academic_years WHERE id = $1 LIMIT 1', [targetYearId]);
  if (!targetYear.rows.length) {
    throw makeCloneError(404, 'ACADEMIC_YEAR_COPY_TARGET_NOT_FOUND', 'Target academic year not found for cloning');
  }

  const csAlive = (await tenantSoftDeleteCs(client)) ? ' AND deleted_at IS NULL' : '';

  if (options.classes || options.sections) {
    const c = await client.query(
      `SELECT COUNT(*)::int AS count FROM class_sections WHERE academic_year_id = $1 ${csAlive}`,
      [targetYearId]
    );
    if ((c.rows[0]?.count || 0) > 0) {
      throw makeCloneError(
        409,
        'ACADEMIC_YEAR_CLONE_TARGET_HAS_CLASS_SECTIONS',
        'Target academic year already has class/section placements. Strict clone requires an empty target year for selected modules.'
      );
    }
  }
  if (options.subjects) {
    const csubAlive = (await tenantSoftDeleteCsub(client)) ? ' AND deleted_at IS NULL' : '';
    const c = await client.query(
      `SELECT COUNT(*)::int AS count FROM class_subjects WHERE academic_year_id = $1 ${csubAlive}`,
      [targetYearId]
    );
    if ((c.rows[0]?.count || 0) > 0) {
      throw makeCloneError(
        409,
        'ACADEMIC_YEAR_CLONE_TARGET_HAS_CLASS_SUBJECTS',
        'Target academic year already has class subjects.'
      );
    }
  }
  if (options.teacherAssignments) {
    if (!(await tableExists(client, 'subject_teacher_assignments'))) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_TENANT_MISSING_STA',
        'This database does not have subject_teacher_assignments — teacher assignment copy is unsupported.'
      );
    }
    const staAlive = (await tenantSoftDeleteSta(client)) ? ' AND deleted_at IS NULL' : '';
    const c = await client.query(
      `SELECT COUNT(*)::int AS count FROM subject_teacher_assignments WHERE academic_year_id = $1 ${staAlive}`,
      [targetYearId]
    );
    if ((c.rows[0]?.count || 0) > 0) {
      throw makeCloneError(409, 'ACADEMIC_YEAR_CLONE_TARGET_HAS_ASSIGNMENTS', 'Target academic year already has assignment rows.');
    }
  }
  if (options.timetable) {
    const c = await client.query('SELECT COUNT(*)::int AS count FROM class_schedules WHERE academic_year_id = $1', [targetYearId]);
    if ((c.rows[0]?.count || 0) > 0) {
      throw makeCloneError(409, 'ACADEMIC_YEAR_CLONE_TARGET_HAS_TIMETABLE', 'Target academic year already has timetable entries.');
    }
  }
}

async function collectExpectedCountsTenant(client, sourceYearId, options) {
  const counts = {};
  const csAlive = (await tenantSoftDeleteCs(client)) ? ' AND deleted_at IS NULL' : '';
  const csubAlive = (await tenantSoftDeleteCsub(client)) ? ' AND deleted_at IS NULL' : '';
  const staAlive = (await tenantSoftDeleteSta(client)) ? ' AND deleted_at IS NULL' : '';

  if (options.classes) {
    const r = await client.query(
      `SELECT COUNT(DISTINCT class_id)::int AS count FROM class_sections WHERE academic_year_id = $1 ${csAlive}`,
      [sourceYearId]
    );
    counts.classes_expected = r.rows[0]?.count || 0;
  }
  if (options.sections) {
    const r = await client.query(
      `SELECT COUNT(*)::int AS count FROM class_sections WHERE academic_year_id = $1 ${csAlive}`,
      [sourceYearId]
    );
    counts.sections_expected = r.rows[0]?.count || 0;
  }
  if (options.subjects) {
    const r = await client.query(
      `SELECT COUNT(*)::int AS count FROM class_subjects WHERE academic_year_id = $1 ${csubAlive}`,
      [sourceYearId]
    );
    counts.subjects_expected = r.rows[0]?.count || 0;
  }
  if (options.teacherAssignments) {
    const staRes = await client.query(
      `SELECT COUNT(*)::int AS count FROM subject_teacher_assignments WHERE academic_year_id = $1 ${staAlive}`,
      [sourceYearId]
    );
    const ctAlive = (await tableExists(client, 'class_teachers')) && (await columnExists(client, 'class_teachers', 'deleted_at'))
      ? ' AND deleted_at IS NULL'
      : '';
    const ctRes = (await tableExists(client, 'class_teachers'))
      ? await client.query(
          `SELECT COUNT(*)::int AS count FROM class_teachers WHERE academic_year_id = $1 ${ctAlive}`,
          [sourceYearId]
        )
      : { rows: [{ count: 0 }] };

    counts.teacher_assignments_expected = (staRes.rows[0]?.count || 0) + (ctRes.rows[0]?.count || 0);
  }
  if (options.timetable) {
    const r = await client.query(
      'SELECT COUNT(*)::int AS count FROM class_schedules WHERE academic_year_id = $1',
      [sourceYearId]
    );
    counts.timetable_expected = r.rows[0]?.count || 0;
  }
  return counts;
}

async function validateSourceDataConsistencyTenant(client, sourceYearId, options) {
  if (options.teacherAssignments && (await tableExists(client, 'subject_teacher_assignments'))) {
    const staAlive = (await tenantSoftDeleteSta(client)) ? ' AND sta.deleted_at IS NULL' : '';
    const missingStaff = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM subject_teacher_assignments sta
       LEFT JOIN staff st ON st.id = sta.staff_id
       WHERE sta.academic_year_id = $1 ${staAlive} AND st.id IS NULL`,
      [sourceYearId]
    );
    if ((missingStaff.rows[0]?.count || 0) > 0) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_ASSIGNMENT_SOURCE_STAFF_MISSING',
        'Cannot copy assignments because the source year references missing staff.'
      );
    }
  }

  if (options.timetable) {
    const slotJoin = 'timetable_time_slots';
    const missingSlots = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM class_schedules cs
       LEFT JOIN ${slotJoin} ts ON ts.id = cs.time_slot_id
       WHERE cs.academic_year_id = $1 AND ts.id IS NULL`,
      [sourceYearId]
    );
    if ((missingSlots.rows[0]?.count || 0) > 0) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_TIMETABLE_SOURCE_SLOT_MISSING',
        'Cannot clone timetable because the source year has rows with missing time slots.'
      );
    }
  }
}

async function validateStrictIntegrityTenant(client, summary) {
  if (summary.skipped !== 0 || (summary.errors && summary.errors.length > 0)) {
    throw makeCloneError(
      500,
      'ACADEMIC_YEAR_CLONE_STRICT_SUMMARY_INVALID',
      'Clone summary indicates skipped records or unresolved errors.'
    );
  }
}

async function cloneClassesTenant(client, sourceYearId) {
  const csAlive = (await tenantSoftDeleteCs(client)) ? ' AND deleted_at IS NULL' : '';
  const r = await client.query(
    `SELECT DISTINCT class_id FROM class_sections WHERE academic_year_id = $1 ${csAlive} ORDER BY class_id ASC`,
    [sourceYearId]
  );
  const map = new Map();
  for (const row of r.rows) {
    const cid = Number(row.class_id);
    if (cid) map.set(cid, cid);
  }
  return { map, inserted: map.size };
}

async function cloneClassSectionsTenant(client, sourceYearId, targetYearId, createdByStaffId) {
  const csAlive = (await tenantSoftDeleteCs(client)) ? ' AND deleted_at IS NULL' : '';
  const rowsRes = await client.query(
    `SELECT id, class_id, section_id, max_students, room_number, is_active
     FROM class_sections
     WHERE academic_year_id = $1 ${csAlive}
     ORDER BY id ASC`,
    [sourceYearId]
  );
  const classSectionMap = new Map();
  let insertedCount = 0;
  const createdBy = createdByStaffId || null;
  for (const row of rowsRes.rows) {
    const ins = await client.query(
      `INSERT INTO class_sections (
        class_id, section_id, academic_year_id, max_students, room_number, is_active, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id`,
      [
        row.class_id,
        row.section_id,
        targetYearId,
        row.max_students ?? 30,
        row.room_number || null,
        normalizeBool(row.is_active, true),
        createdBy,
      ]
    );
    classSectionMap.set(Number(row.id), Number(ins.rows[0].id));
    insertedCount += 1;
  }
  return { map: classSectionMap, inserted: insertedCount };
}

async function cloneClassSubjectsTenant(client, sourceYearId, targetYearId, createdByStaffId) {
  const csubAlive = (await tenantSoftDeleteCsub(client)) ? ' AND deleted_at IS NULL' : '';
  const rowsRes = await client.query(
    `SELECT id, class_id, subject_id, is_elective, theory_hours, practical_hours, total_marks, passing_marks
     FROM class_subjects
     WHERE academic_year_id = $1 ${csubAlive}
     ORDER BY id ASC`,
    [sourceYearId]
  );
  const classSubjectMap = new Map();
  let insertedCount = 0;
  const createdBy = createdByStaffId || null;
  const electiveSql = await columnExists(client, 'class_subjects', 'is_elective');
  for (const row of rowsRes.rows) {
    const ins = electiveSql
      ? await client.query(
          `INSERT INTO class_subjects (
            class_id, subject_id, academic_year_id, is_elective, theory_hours, practical_hours,
            total_marks, passing_marks, created_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING id`,
          [
            row.class_id,
            row.subject_id,
            targetYearId,
            normalizeBool(row.is_elective, false),
            row.theory_hours ?? 0,
            row.practical_hours ?? 0,
            row.total_marks ?? 100,
            row.passing_marks ?? 35,
            createdBy,
          ]
        )
      : await client.query(
          `INSERT INTO class_subjects (
            class_id, subject_id, academic_year_id, theory_hours, practical_hours,
            total_marks, passing_marks, created_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          RETURNING id`,
          [
            row.class_id,
            row.subject_id,
            targetYearId,
            row.theory_hours ?? 0,
            row.practical_hours ?? 0,
            row.total_marks ?? 100,
            row.passing_marks ?? 35,
            createdBy,
          ]
        );
    classSubjectMap.set(Number(row.id), Number(ins.rows[0].id));
    insertedCount += 1;
  }
  return { map: classSubjectMap, inserted: insertedCount };
}

async function cloneTeacherAssignmentsTenant(
  client,
  sourceYearId,
  targetYearId,
  classSectionMap,
  classSubjectMap,
  createdByStaffId
) {
  let inserted = 0;
  const createdBy = createdByStaffId || null;

  // 1. Subject Teacher Assignments
  if (await tableExists(client, 'subject_teacher_assignments')) {
    const staAlive = (await tenantSoftDeleteSta(client)) ? ' AND deleted_at IS NULL' : '';
    const rowsRes = await client.query(
      `SELECT id, class_id, class_section_id, class_subject_id, staff_id, valid_period
       FROM subject_teacher_assignments
       WHERE academic_year_id = $1 ${staAlive}
       ORDER BY id ASC`,
      [sourceYearId]
    );
    for (const row of rowsRes.rows) {
      const oldCs = toPositiveInt(row.class_section_id);
      const newCs = oldCs ? classSectionMap.get(oldCs) ?? null : null;
      if (oldCs && newCs == null) {
        throw makeCloneError(
          400,
          'ACADEMIC_YEAR_CLONE_STA_SECTION_MAPPING_MISSING',
          `Cannot copy subject teacher assignment ${row.id}: class_section mapping is missing.`
        );
      }
      const oldCsub = toPositiveInt(row.class_subject_id);
      const newCsub = oldCsub ? classSubjectMap.get(oldCsub) ?? null : null;
      if (!newCsub) {
        throw makeCloneError(
          400,
          'ACADEMIC_YEAR_CLONE_STA_SUBJECT_MAPPING_MISSING',
          `Cannot copy subject teacher assignment ${row.id}: class_subject mapping is missing.`
        );
      }
      const staffId = toPositiveInt(row.staff_id);
      if (!staffId) {
        throw makeCloneError(400, 'ACADEMIC_YEAR_CLONE_STA_STAFF_INVALID', `Assignment ${row.id} has invalid staff_id.`);
      }
      await client.query(
        `INSERT INTO subject_teacher_assignments (
          class_id, class_section_id, class_subject_id, staff_id, academic_year_id, valid_period, created_by
        ) VALUES ($1,$2,$3,$4,$5, COALESCE($6::daterange, daterange(CURRENT_DATE, '9999-12-31'::date, '[]')), $7)`,
        [row.class_id, newCs, newCsub, staffId, targetYearId, row.valid_period ?? null, createdBy]
      );
      inserted += 1;
    }
  }

  // 2. Class Teacher Assignments
  if (await tableExists(client, 'class_teachers')) {
    const ctAlive = (await columnExists(client, 'class_teachers', 'deleted_at')) ? ' AND deleted_at IS NULL' : '';
    const rowsRes = await client.query(
      `SELECT id, class_id, class_section_id, staff_id, role, valid_period
       FROM class_teachers
       WHERE academic_year_id = $1 ${ctAlive}
       ORDER BY id ASC`,
      [sourceYearId]
    );
    for (const row of rowsRes.rows) {
      const oldCs = toPositiveInt(row.class_section_id);
      const newCs = oldCs ? classSectionMap.get(oldCs) ?? null : null;
      if (oldCs && newCs == null) {
        throw makeCloneError(
          400,
          'ACADEMIC_YEAR_CLONE_CT_SECTION_MAPPING_MISSING',
          `Cannot copy class teacher assignment ${row.id}: class_section mapping is missing.`
        );
      }
      const staffId = toPositiveInt(row.staff_id);
      if (!staffId) {
        throw makeCloneError(400, 'ACADEMIC_YEAR_CLONE_CT_STAFF_INVALID', `Class teacher assignment ${row.id} has invalid staff_id.`);
      }
      await client.query(
        `INSERT INTO class_teachers (
          class_id, class_section_id, staff_id, academic_year_id, role, valid_period, created_by
        ) VALUES ($1,$2,$3,$4,$5, COALESCE($6::daterange, daterange(CURRENT_DATE, '9999-12-31'::date, '[]')), $7)`,
        [row.class_id, newCs, staffId, targetYearId, row.role || 'primary', row.valid_period ?? null, createdBy]
      );
      inserted += 1;
    }
  }

  return inserted;
}

async function cloneTimetableTripleKey(client, sourceYearId, targetYearId, classSectionMap, classSubjectMap, createdByStaffId) {
  const tripleCols =
    (await columnExists(client, 'class_schedules', 'class_section_id')) &&
    (await columnExists(client, 'class_schedules', 'class_subject_id'));
  if (!tripleCols) {
    throw makeCloneError(
      400,
      'ACADEMIC_YEAR_CLONE_TIMETABLE_SCHEMA_UNSUPPORTED',
      'Timetable copy requires class_schedules.class_section_id and class_subject_id.'
    );
  }

  const srcAy = await client.query('SELECT start_date, end_date FROM academic_years WHERE id = $1 LIMIT 1', [sourceYearId]);
  const tgtAy = await client.query('SELECT start_date, end_date FROM academic_years WHERE id = $1 LIMIT 1', [targetYearId]);
  const sourceStart = srcAy.rows[0]?.start_date;
  const sourceEndRaw = srcAy.rows[0]?.end_date;
  const sourceYearEndDateStr =
    sourceEndRaw != null && String(sourceEndRaw).trim() !== '' ? String(sourceEndRaw).slice(0, 10) : null;
  const targetStart = tgtAy.rows[0]?.start_date;
  const targetEnd = tgtAy.rows[0]?.end_date;
  if (!sourceStart || !targetStart) {
    throw makeCloneError(
      400,
      'ACADEMIC_YEAR_DATES_REQUIRED',
      'Cannot copy timetable: source and target academic years must have start_date set.'
    );
  }
  const dayOffset = calendarDaysBetween(targetStart, sourceStart);

  const rowsRes = await client.query(
    `SELECT id, class_id, class_section_id, class_subject_id, teacher_id, class_room_id, time_slot_id, day_of_week,
            valid_from, valid_to, remarks
     FROM class_schedules
     WHERE academic_year_id = $1
     ORDER BY id ASC`,
    [sourceYearId]
  );

  const slotGroups = new Map();
  for (const r of rowsRes.rows) {
    const tid = toPositiveInt(r.teacher_id);
    const sid = toPositiveInt(r.time_slot_id);
    const d = toPositiveInt(r.day_of_week);
    if (!tid || !sid || !d) continue;
    const k = teacherSlotOverlapKey(tid, d, sid);
    if (!slotGroups.has(k)) slotGroups.set(k, []);
    slotGroups.get(k).push(r);
  }
  for (const g of slotGroups.values()) {
    g.sort((a, b) => Number(a.id) - Number(b.id));
  }
  const slotPartMeta = new Map();
  for (const g of slotGroups.values()) {
    const n = g.length;
    for (let i = 0; i < g.length; i += 1) {
      slotPartMeta.set(Number(g[i].id), { partIndex: i, partCount: n });
    }
  }

  const rangeStartDate = parseLocalDateOnly(targetStart);
  let rangeEndDate = parseLocalDateOnly(targetEnd);
  if (!rangeStartDate) {
    throw makeCloneError(400, 'ACADEMIC_YEAR_TARGET_START_INVALID', 'Target academic year start_date is invalid.');
  }
  if (!rangeEndDate) {
    rangeEndDate = addCalendarDays(rangeStartDate, 364);
  }
  if (rangeEndDate && rangeStartDate.getTime() > rangeEndDate.getTime()) {
    rangeEndDate = rangeStartDate;
  }

  let inserted = 0;
  const createdBy = createdByStaffId || null;
  const hasRoutine = await tableExists(client, 'teacher_routines');

  for (const row of rowsRes.rows) {
    const oldCsec = toPositiveInt(row.class_section_id);
    const newCsec = oldCsec ? classSectionMap.get(oldCsec) ?? null : null;
    if (!newCsec) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_TIMETABLE_SECTION_MAPPING_MISSING',
        `Cannot copy timetable row ${row.id}: class_section mapping missing.`
      );
    }
    const oldCsub = toPositiveInt(row.class_subject_id);
    const newCsub = oldCsub ? classSubjectMap.get(oldCsub) ?? null : null;
    if (!newCsub) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_TIMETABLE_SUBJECT_MAPPING_MISSING',
        `Cannot copy timetable row ${row.id}: class_subject mapping missing.`
      );
    }
    const teacherId = toPositiveInt(row.teacher_id);
    const roomId = toPositiveInt(row.class_room_id);
    const slotId = toPositiveInt(row.time_slot_id);
    const dow = toPositiveInt(row.day_of_week);
    if (!teacherId || !roomId || !slotId || !dow) {
      throw makeCloneError(400, 'ACADEMIC_YEAR_CLONE_TIMETABLE_REQUIRED_NULL', `Timetable row ${row.id} is incomplete.`);
    }

    // Exclusions: teacher|section|room + day + slot + overlapping validity (ranges can span DB-wide unless each row has proper end dates).
    // Shift windows into the target year; if several source rows share (teacher, day, slot), split the window into contiguous slices.
    const part = slotPartMeta.get(Number(row.id)) || { partIndex: 0, partCount: 1 };
    let validFromSql;
    let validToSql;
    if (part.partCount > 1) {
      const slice = partitionInclusiveRange(rangeStartDate, rangeEndDate, part.partIndex, part.partCount);
      validFromSql = formatLocalDateOnly(slice.from) || String(targetStart).slice(0, 10);
      validToSql = formatLocalDateOnly(slice.to);
    } else {
      let vfDate =
        row.valid_from != null ? addCalendarDays(row.valid_from, dayOffset) : parseLocalDateOnly(targetStart);
      if (!vfDate) vfDate = parseLocalDateOnly(targetStart);
      let vtDate = row.valid_to != null ? addCalendarDays(row.valid_to, dayOffset) : null;
      if (vtDate == null && targetEnd != null) {
        vtDate = parseLocalDateOnly(targetEnd);
      }
      if (vfDate && rangeStartDate && vfDate.getTime() < rangeStartDate.getTime()) vfDate = new Date(rangeStartDate);
      if (vtDate && rangeEndDate && vtDate.getTime() > rangeEndDate.getTime()) vtDate = new Date(rangeEndDate);
      if (vfDate && vtDate && vfDate.getTime() > vtDate.getTime()) {
        vtDate = vfDate;
      }
      validFromSql = formatLocalDateOnly(vfDate) || String(targetStart).slice(0, 10);
      validToSql = vtDate ? formatLocalDateOnly(vtDate) : null;
    }

    const tripleOverlapOpts = {
      targetYearId,
      sourceYearId,
      sourceYearEndDateStr,
      teacherId,
      classSectionId: newCsec,
      classRoomId: roomId,
      dow,
      slotId,
      validFromSql,
      validToSql,
    };

    await reconcileTimetableOverlapsBeforeTripleKeyInsert(client, tripleOverlapOpts);

    let ins;
    try {
      ins = await client.query(
        `INSERT INTO class_schedules (
        academic_year_id, class_id, class_section_id, class_subject_id, teacher_id, class_room_id, time_slot_id,
        day_of_week, valid_from, valid_to, remarks, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::date,$11,$12)
      RETURNING id, teacher_id`,
        [
          targetYearId,
          row.class_id,
          newCsec,
          newCsub,
          teacherId,
          roomId,
          slotId,
          dow,
          validFromSql,
          validToSql,
          row.remarks || null,
          createdBy,
        ]
      );
    } catch (insErr) {
      if (!isPgTimetableExclusionViolation(insErr)) throw insErr;
      const repaired = await reconcileTimetableOverlapsBeforeTripleKeyInsert(client, tripleOverlapOpts);
      if (repaired === 0) {
        throw await timetableExclusionToCloneError(client, insErr, {
          source_class_schedule_id: row.id,
          academic_year_id: targetYearId,
          teacher_id: teacherId,
          class_section_id: newCsec,
          class_room_id: roomId,
          day_of_week: dow,
          time_slot_id: slotId,
          valid_from: validFromSql,
          valid_to: validToSql,
          slot_label: null,
        });
      }
      try {
        ins = await client.query(
          `INSERT INTO class_schedules (
        academic_year_id, class_id, class_section_id, class_subject_id, teacher_id, class_room_id, time_slot_id,
        day_of_week, valid_from, valid_to, remarks, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::date,$11,$12)
      RETURNING id, teacher_id`,
          [
            targetYearId,
            row.class_id,
            newCsec,
            newCsub,
            teacherId,
            roomId,
            slotId,
            dow,
            validFromSql,
            validToSql,
            row.remarks || null,
            createdBy,
          ]
        );
      } catch (insErr2) {
        if (isPgTimetableExclusionViolation(insErr2)) {
          throw await timetableExclusionToCloneError(client, insErr2, {
            source_class_schedule_id: row.id,
            academic_year_id: targetYearId,
            teacher_id: teacherId,
            class_section_id: newCsec,
            class_room_id: roomId,
            day_of_week: dow,
            time_slot_id: slotId,
            valid_from: validFromSql,
            valid_to: validToSql,
            slot_label: null,
          });
        }
        throw insErr2;
      }
    }

    inserted += 1;

    const newSchedId = toPositiveInt(ins.rows[0]?.id);
    const trTeacher = toPositiveInt(ins.rows[0]?.teacher_id);
    if (!hasRoutine || !newSchedId || !trTeacher) continue;
    await client.query(
      `INSERT INTO teacher_routines (teacher_id, class_schedule_id, academic_year_id, is_active, created_at, modified_at)
       VALUES ($1, $2, $3, true, NOW(), NOW())`,
      [trTeacher, newSchedId, targetYearId]
    );
  }

  return inserted;
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
       LEFT JOIN timetable_time_slots ts ON ts.id = cs.time_slot_id
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
       LEFT JOIN timetable_time_slots ts ON ts.id = cs.time_slot_id
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

  const legacyClassesYearScoped = await columnExists(client, 'classes', 'academic_year_id');
  const tripleKeyTenantLayout = await isTripleKeyTenantLayout(client);
  const wantsStructuralClone =
    normalizedOptions.classes ||
    normalizedOptions.sections ||
    normalizedOptions.subjects ||
    normalizedOptions.teacherAssignments ||
    normalizedOptions.timetable;
  if (wantsStructuralClone && !legacyClassesYearScoped && !tripleKeyTenantLayout) {
    throw makeCloneError(
      409,
      'ACADEMIC_YEAR_CLONE_SCHEMA_UNSUPPORTED',
      'This database layout does not support copying academic structure (missing classes.academic_year_id and class_sections year anchors). Create the year without copy options or ask your administrator.'
    );
  }

  if (tripleKeyTenantLayout && wantsStructuralClone) {
    if (normalizedOptions.subjects && !(await tableExists(client, 'class_subjects'))) {
      throw makeCloneError(
        400,
        'ACADEMIC_YEAR_CLONE_TENANT_MISSING_CLASS_SUBJECTS',
        'Copying subjects requires a class_subjects table (triple-key schema).'
      );
    }

    await validatePreconditionsTenant(client, src, target, normalizedOptions);
    const expectedTenant = await collectExpectedCountsTenant(client, src, normalizedOptions);
    await validateSourceDataConsistencyTenant(client, src, normalizedOptions);

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
    let classSectionMap = new Map();
    let classSubjectMap = new Map();

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
      const classesResult = await cloneClassesTenant(client, src);
      classMap = classesResult.map;
      summary.classes_cloned = classesResult.inserted;
    }

    if (normalizedOptions.sections) {
      const sectionsResult = await cloneClassSectionsTenant(client, src, target, createdByStaffId);
      classSectionMap = sectionsResult.map;
      summary.sections_cloned = sectionsResult.inserted;
    }

    if (normalizedOptions.subjects) {
      const subjectsResult = await cloneClassSubjectsTenant(client, src, target, createdByStaffId);
      classSubjectMap = subjectsResult.map;
      summary.subjects_cloned = subjectsResult.inserted;
    }

    if (normalizedOptions.teacherAssignments) {
      summary.assignments_cloned = await cloneTeacherAssignmentsTenant(
        client,
        src,
        target,
        classSectionMap,
        classSubjectMap,
        createdByStaffId
      );
    }

    if (normalizedOptions.timetable) {
      summary.timetable_entries_cloned = await cloneTimetableTripleKey(
        client,
        src,
        target,
        classSectionMap,
        classSubjectMap,
        createdByStaffId
      );
    }

    if (normalizedOptions.transport) {
      const t = await cloneTransport(client, src, target);
      details.transport = t;
    }

    if (normalizedOptions.classes && summary.classes_cloned !== (expectedTenant.classes_expected || 0)) {
      throw makeCloneError(
        500,
        'ACADEMIC_YEAR_CLONE_COUNT_MISMATCH_CLASSES',
        `Classes cloned count mismatch. Expected ${expectedTenant.classes_expected || 0}, got ${summary.classes_cloned}.`
      );
    }
    if (normalizedOptions.sections && summary.sections_cloned !== (expectedTenant.sections_expected || 0)) {
      throw makeCloneError(
        500,
        'ACADEMIC_YEAR_CLONE_COUNT_MISMATCH_SECTIONS',
        `Sections cloned count mismatch. Expected ${expectedTenant.sections_expected || 0}, got ${summary.sections_cloned}.`
      );
    }
    if (normalizedOptions.subjects && summary.subjects_cloned !== (expectedTenant.subjects_expected || 0)) {
      throw makeCloneError(
        500,
        'ACADEMIC_YEAR_CLONE_COUNT_MISMATCH_SUBJECTS',
        `Subjects cloned count mismatch. Expected ${expectedTenant.subjects_expected || 0}, got ${summary.subjects_cloned}.`
      );
    }
    if (
      normalizedOptions.teacherAssignments &&
      summary.assignments_cloned !== (expectedTenant.teacher_assignments_expected || 0)
    ) {
      throw makeCloneError(
        500,
        'ACADEMIC_YEAR_CLONE_COUNT_MISMATCH_ASSIGNMENTS',
        `Teacher assignments cloned count mismatch. Expected ${expectedTenant.teacher_assignments_expected || 0}, got ${summary.assignments_cloned}.`
      );
    }
    if (normalizedOptions.timetable && summary.timetable_entries_cloned !== (expectedTenant.timetable_expected || 0)) {
      throw makeCloneError(
        500,
        'ACADEMIC_YEAR_CLONE_COUNT_MISMATCH_TIMETABLE',
        `Timetable cloned count mismatch. Expected ${expectedTenant.timetable_expected || 0}, got ${summary.timetable_entries_cloned}.`
      );
    }

    await validateStrictIntegrityTenant(client, summary);
    return {
      options: normalizedOptions,
      summary,
      details,
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

