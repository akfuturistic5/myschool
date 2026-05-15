const { query, executeTransaction } = require('../config/database');
const { ROLES } = require('../config/roles');
const { toYmd } = require('../utils/dateOnly');
const { resolveAcademicYearIdFromQuery, getDefaultAcademicYearId } = require('../utils/libraryAcademicYear');

async function getPersonScope(req) {
  const roleId = req.user?.role_id;
  if (roleId === ROLES.STUDENT) {
    const r = await query(
      `SELECT id FROM students WHERE user_id = $1 AND COALESCE(is_active, true) = true`,
      [req.user.id]
    );
    return { student_id: r.rows[0]?.id ?? null };
  }
  return {};
}

function normalizeDbStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'issued') return 'Issued';
  if (s === 'returned') return 'Returned';
  if (s === 'lost') return 'Lost';
  if (s === 'damaged') return 'Damaged';
  return raw;
}

function normalizeIssueDates(row) {
  if (!row) return row;
  return {
    ...row,
    issue_date: row.issue_date != null && row.issue_date !== '' ? toYmd(row.issue_date) : row.issue_date,
    due_date: row.due_date != null && row.due_date !== '' ? toYmd(row.due_date) : row.due_date,
    return_date: row.return_date != null && row.return_date !== '' ? toYmd(row.return_date) : row.return_date,
  };
}

function mapIssueRow(row) {
  const st = row.status || '';
  const issueTo =
    row.student_id != null
      ? row.student_name || ''
      : row.staff_id != null
        ? row.staff_name || ''
        : '';
  const cls =
    row.class_name && row.section_name
      ? `${row.class_name}, ${row.section_name}`
      : row.class_name || row.section_name || '';
  const titleParts = [row.book_title || ''].filter(Boolean);
  if (row.accession_number) titleParts.push(`(${row.accession_number})`);
  return {
    ...row,
    dateofIssue: row.issue_date ? toYmd(row.issue_date) : '',
    dueDate: row.due_date ? toYmd(row.due_date) : '',
    issueTo,
    booksIssued: titleParts.join(' '),
    bookReturned: st === 'Returned' ? 'Yes' : st === 'Issued' ? 'No' : String(st || '—'),
    issueRemarks: row.remarks || '',
    class: cls,
    img: row.borrower_photo || 'assets/img/profiles/avatar-01.jpg',
  };
}

async function resolveStudentLifecycleId(client, studentId, academicYearId) {
  if (studentId == null || academicYearId == null) return null;
  const r = await client.query(
    `SELECT id
     FROM student_lifecycle_ledger
     WHERE student_id = $1 AND to_academic_year_id = $2
     ORDER BY event_date DESC NULLS LAST, id DESC
     LIMIT 1`,
    [studentId, academicYearId]
  );
  if (r.rows.length === 0) {
    throw Object.assign(new Error('NO_LIFECYCLE'), { code: 'NO_LIFECYCLE' });
  }
  return r.rows[0].id;
}

const ISSUE_LIST_SELECT = `
  SELECT i.id,
         i.academic_year_id,
         i.book_copy_id,
         i.policy_id,
         i.student_id,
         i.staff_id,
         i.student_lifecycle_id,
         to_char(i.issue_date::date, 'YYYY-MM-DD') AS issue_date,
         to_char(i.due_date::date, 'YYYY-MM-DD') AS due_date,
         to_char(i.return_date::date, 'YYYY-MM-DD') AS return_date,
         COALESCE(i.condition_on_issue::text, 'Good') AS condition_on_issue,
         i.condition_on_return,
         COALESCE(i.renewal_count, 0)::int AS renewal_count,
         i.fine_amount,
         COALESCE(TRIM(i.status::text), 'Issued') AS status,
         i.remarks,
         i.issued_by,
         i.returned_to,
         i.created_at,
         bc.book_id,
         bc.accession_number,
         b.book_title,
         b.author,
         b.isbn,
         TRIM(CONCAT(COALESCE(su.first_name, ''), ' ', COALESCE(su.last_name, ''))) AS student_name,
         TRIM(CONCAT(COALESCE(stfu.first_name, ''), ' ', COALESCE(stfu.last_name, ''))) AS staff_name,
         c.class_name,
         sec.section_name,
         CASE WHEN i.student_id IS NOT NULL THEN NULLIF(TRIM(COALESCE(su.avatar::text, '')), '') ELSE st.photo_url END AS borrower_photo
`;

const ISSUE_LIST_JOINS = `
  FROM library_book_issues i
  INNER JOIN library_book_copies bc ON bc.id = i.book_copy_id AND bc.deleted_at IS NULL
  INNER JOIN library_books b ON b.id = bc.book_id AND b.deleted_at IS NULL
  LEFT JOIN students s ON s.id = i.student_id
  LEFT JOIN users su ON su.id = s.user_id
  LEFT JOIN student_lifecycle_ledger sl ON sl.id = i.student_lifecycle_id
  LEFT JOIN classes c ON c.id = sl.to_class_id
  LEFT JOIN sections sec ON sec.id = sl.to_section_id
  LEFT JOIN staff st ON st.id = i.staff_id
  LEFT JOIN users stfu ON stfu.id = st.user_id
`;

const listIssues = async (req, res) => {
  try {
    const includeAllYears =
      String(req.query.include_all_years || '').trim() === '1' ||
      String(req.query.include_all_years || '').trim().toLowerCase() === 'true';
    let yearId = includeAllYears ? null : await resolveAcademicYearIdFromQuery(req);
    const statusRaw = req.query.status ? String(req.query.status).trim() : '';
    const scope = await getPersonScope(req);

    const params = [];
    let where = 'WHERE i.deleted_at IS NULL';
    if (statusRaw) {
      const normalized = normalizeDbStatus(statusRaw);
      params.push(normalized);
      where += ` AND COALESCE(TRIM(i.status::text), 'Issued') = $${params.length}`;
    }

    if (scope.student_id != null) {
      const scopedStudentIds = [scope.student_id];
      if (yearId == null) {
        const sy = await query(`SELECT academic_year_id FROM students WHERE id = $1 LIMIT 1`, [scope.student_id]);
        const candidate = sy.rows[0]?.academic_year_id;
        if (candidate != null && Number.isFinite(Number(candidate))) yearId = Number(candidate);
      }
      params.push(scopedStudentIds);
      where += ` AND i.student_id = ANY($${params.length}::int[])`;
    } else if (req.query.member_id != null && String(req.query.member_id).trim() !== '') {
      const mid = parseInt(String(req.query.member_id), 10);
      if (Number.isFinite(mid)) {
        const mr = await query(
          `SELECT student_id, staff_id FROM library_members WHERE id = $1 AND LOWER(TRIM(COALESCE(status, 'active'))) = 'active'`,
          [mid]
        );
        const mrow = mr.rows[0];
        if (!mrow) {
          return res.status(200).json({ status: 'SUCCESS', message: 'Issues fetched', data: [], count: 0 });
        }
        if (mrow.student_id != null) {
          params.push(mrow.student_id);
          where += ` AND i.student_id = $${params.length}`;
        } else if (mrow.staff_id != null) {
          params.push(mrow.staff_id);
          where += ` AND i.staff_id = $${params.length}`;
        }
      }
    } else if (req.query.student_id != null && String(req.query.student_id).trim() !== '') {
      const requestedStudentId = parseInt(req.query.student_id, 10);
      const resolvedStudentIds = Number.isFinite(requestedStudentId) ? [requestedStudentId] : [];
      if (yearId == null && resolvedStudentIds.length > 0) {
        const sy = await query(
          `SELECT academic_year_id FROM students WHERE id = ANY($1::int[]) ORDER BY id LIMIT 1`,
          [resolvedStudentIds]
        );
        const candidate = sy.rows[0]?.academic_year_id;
        if (candidate != null && Number.isFinite(Number(candidate))) yearId = Number(candidate);
      }
      params.push(resolvedStudentIds.length > 0 ? resolvedStudentIds : [requestedStudentId]);
      where += ` AND i.student_id = ANY($${params.length}::int[])`;
    }

    if (yearId != null) {
      params.push(yearId);
      where += ` AND i.academic_year_id = $${params.length}`;
    }

    if (
      (req.query.member_id == null || String(req.query.member_id).trim() === '') &&
      req.query.staff_id != null &&
      String(req.query.staff_id).trim() !== ''
    ) {
      params.push(parseInt(req.query.staff_id, 10));
      where += ` AND i.staff_id = $${params.length}`;
    }

    if (req.query.book_id != null && String(req.query.book_id).trim() !== '') {
      params.push(parseInt(req.query.book_id, 10));
      where += ` AND bc.book_id = $${params.length}`;
    }

    const issueFrom = req.query.issue_date_from ? String(req.query.issue_date_from).trim().slice(0, 10) : '';
    const issueTo = req.query.issue_date_to ? String(req.query.issue_date_to).trim().slice(0, 10) : '';
    if (issueFrom) {
      params.push(issueFrom);
      where += ` AND i.issue_date::date >= $${params.length}::date`;
    }
    if (issueTo) {
      params.push(issueTo);
      where += ` AND i.issue_date::date <= $${params.length}::date`;
    }

    const search = req.query.search ? String(req.query.search).trim() : '';
    if (search) {
      const p = `%${search}%`;
      params.push(p);
      const i = params.length;
      where += ` AND (
        b.book_title ILIKE $${i}
        OR COALESCE(bc.accession_number::text, '') ILIKE $${i}
        OR TRIM(CONCAT(COALESCE(su.first_name, ''), ' ', COALESCE(su.last_name, ''))) ILIKE $${i}
        OR TRIM(CONCAT(COALESCE(stfu.first_name, ''), ' ', COALESCE(stfu.last_name, ''))) ILIKE $${i}
      )`;
    }

    const sql = `${ISSUE_LIST_SELECT} ${ISSUE_LIST_JOINS} ${where} ORDER BY i.issue_date DESC, i.id DESC`;
    const r = await query(sql, params);
    const data = r.rows.map(mapIssueRow);
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Issues fetched',
      data,
      count: data.length,
    });
  } catch (e) {
    console.error('library issues list', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to list issues' });
  }
};

const getIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = await getPersonScope(req);
    const r = await query(
      `${ISSUE_LIST_SELECT} ${ISSUE_LIST_JOINS} WHERE i.id = $1`,
      [id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Issue not found' });
    }
    const row = r.rows[0];
    if (scope.student_id != null && Number(row.student_id) !== Number(scope.student_id)) {
      return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: mapIssueRow(row) });
  } catch (e) {
    console.error('library issue get', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to get issue' });
  }
};

const createIssue = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const body = req.body || {};
    const {
      book_copy_id,
      book_id,
      library_member_id,
      due_date,
      remarks,
      policy_id,
      condition_on_issue,
      academic_year_id: bodyAy,
    } = body;

    const mid = parseInt(library_member_id, 10);
    if (!Number.isFinite(mid)) {
      return res.status(400).json({ status: 'ERROR', message: 'library_member_id is required' });
    }
    if (!due_date || !String(due_date).trim()) {
      return res.status(400).json({ status: 'ERROR', message: 'due_date is required' });
    }
    const due = String(due_date).trim().slice(0, 10);

    let copyId =
      book_copy_id != null && book_copy_id !== '' ? parseInt(String(book_copy_id), 10) : null;

    let issuedBy = null;
    const st = await query(`SELECT id FROM staff WHERE user_id = $1 LIMIT 1`, [userId]);
    if (st.rows.length > 0) issuedBy = st.rows[0].id;

    const conditionIssue =
      condition_on_issue != null && String(condition_on_issue).trim() !== ''
        ? String(condition_on_issue).trim()
        : 'Good';

    const row = await executeTransaction(async (client) => {
      const memR = await client.query(
        `SELECT id, student_id, staff_id, academic_year_id
         FROM library_members
         WHERE id = $1 AND LOWER(TRIM(COALESCE(status, 'active'))) = 'active'`,
        [mid]
      );
      if (memR.rows.length === 0) {
        throw Object.assign(new Error('INVALID_MEMBER'), { code: 'INVALID_MEMBER' });
      }
      const mem = memR.rows[0];

      let academicYearId =
        bodyAy != null && bodyAy !== '' ? parseInt(String(bodyAy), 10) : mem.academic_year_id;
      if (!Number.isFinite(academicYearId)) {
        academicYearId = await getDefaultAcademicYearId();
      }

      let studentLifecycleId = null;
      if (mem.student_id != null) {
        studentLifecycleId = await resolveStudentLifecycleId(client, mem.student_id, academicYearId);
      }

      if (!Number.isFinite(copyId)) {
        const bid = parseInt(String(book_id), 10);
        if (!Number.isFinite(bid)) {
          throw Object.assign(new Error('COPY_REQUIRED'), { code: 'COPY_REQUIRED' });
        }
        const pick = await client.query(
          `SELECT bc.id
           FROM library_book_copies bc
           WHERE bc.book_id = $1
             AND bc.deleted_at IS NULL
             AND NOT EXISTS (
               SELECT 1
               FROM library_book_issues i
               WHERE i.book_copy_id = bc.id
                 AND COALESCE(TRIM(i.status::text), 'Issued') = 'Issued'
                 AND i.deleted_at IS NULL
             )
           ORDER BY bc.id ASC
           LIMIT 1
           FOR UPDATE OF bc SKIP LOCKED`,
          [bid]
        );
        if (pick.rows.length === 0) {
          throw Object.assign(new Error('NO_COPY'), { code: 'NO_COPY' });
        }
        copyId = pick.rows[0].id;
      }

      const copyCheck = await client.query(
        `SELECT bc.id, bc.book_id
         FROM library_book_copies bc
         WHERE bc.id = $1 AND bc.deleted_at IS NULL FOR UPDATE`,
        [copyId]
      );
      if (copyCheck.rows.length === 0) {
        throw Object.assign(new Error('COPY_NOT_FOUND'), { code: 'COPY_NOT_FOUND' });
      }

      const conflict = await client.query(
        `SELECT 1
         FROM library_book_issues
         WHERE book_copy_id = $1
           AND COALESCE(TRIM(status::text), 'Issued') = 'Issued'
           AND deleted_at IS NULL
         LIMIT 1`,
        [copyId]
      );
      if (conflict.rows.length > 0) {
        throw Object.assign(new Error('COPY_IN_USE'), { code: 'COPY_IN_USE' });
      }

      let pid = policy_id != null && policy_id !== '' ? parseInt(String(policy_id), 10) : null;
      if (Number.isFinite(pid)) {
        const pr = await client.query(
          `SELECT id FROM library_policies WHERE id = $1 AND deleted_at IS NULL AND COALESCE(is_active, true) = true`,
          [pid]
        );
        if (pr.rows.length === 0) pid = null;
      } else {
        pid = null;
      }

      const ins = await client.query(
        `INSERT INTO library_book_issues (
           academic_year_id, book_copy_id, policy_id, student_id, staff_id, student_lifecycle_id,
           issue_date, due_date, condition_on_issue, renewal_count, fine_amount,
           status, issued_by, remarks, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           CURRENT_DATE, $7::date, $8::text, 0, 0.00,
           'Issued', $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         ) RETURNING *`,
        [
          academicYearId,
          copyId,
          pid,
          mem.student_id,
          mem.staff_id,
          studentLifecycleId,
          due,
          conditionIssue,
          issuedBy,
          remarks != null ? String(remarks).trim() : null,
        ]
      );
      return ins.rows[0];
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Book issued',
      data: normalizeIssueDates(row),
    });
  } catch (e) {
    if (e.code === 'INVALID_MEMBER') {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid or inactive library member' });
    }
    if (e.code === 'COPY_REQUIRED') {
      return res.status(400).json({ status: 'ERROR', message: 'book_copy_id or book_id is required' });
    }
    if (e.code === 'COPY_NOT_FOUND') {
      return res.status(404).json({ status: 'ERROR', message: 'Book copy not found' });
    }
    if (e.code === 'COPY_IN_USE') {
      return res.status(409).json({ status: 'ERROR', message: 'This copy already has an open issue' });
    }
    if (e.code === 'NO_COPY') {
      return res.status(409).json({ status: 'ERROR', message: 'No available copy to issue for this book' });
    }
    if (e.code === 'NO_LIFECYCLE') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Student has no enrollment ledger row for this academic year; promote/enrol first.',
      });
    }
    if (e.code === '23503') {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid reference data' });
    }
    console.error('library issue create', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to issue book' });
  }
};

const returnIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const { fine_amount, remarks, status: statusIn, condition_on_return } = req.body || {};
    let returnedTo = null;
    const st = await query(`SELECT id FROM staff WHERE user_id = $1 LIMIT 1`, [userId]);
    if (st.rows.length > 0) returnedTo = st.rows[0].id;

    const stFinal = normalizeDbStatus(statusIn || 'Returned');
    if (!['Returned', 'Lost', 'Damaged'].includes(stFinal)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'status must be Returned, Lost, or Damaged',
      });
    }

    const fine = fine_amount != null && fine_amount !== '' ? parseFloat(String(fine_amount)) : 0;
    const condReturn =
      condition_on_return != null && String(condition_on_return).trim() !== ''
        ? String(condition_on_return).trim()
        : null;

    await executeTransaction(async (client) => {
      const iss = await client.query(`SELECT * FROM library_book_issues WHERE id = $1 FOR UPDATE`, [id]);
      if (iss.rows.length === 0) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
      const issue = iss.rows[0];
      if (String(issue.status || '').trim() !== 'Issued') {
        throw Object.assign(new Error('NOT_OPEN'), { code: 'NOT_OPEN' });
      }

      await client.query(
        `UPDATE library_book_issues SET
           status = $2,
           return_date = CURRENT_DATE,
           fine_amount = COALESCE($3, 0),
           remarks = COALESCE($4, remarks),
           condition_on_return = $5,
           returned_to = $6,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [
          id,
          stFinal,
          Number.isFinite(fine) ? fine : 0,
          remarks != null ? String(remarks).trim() : null,
          condReturn,
          returnedTo,
        ]
      );

      if (stFinal === 'Lost' || stFinal === 'Damaged') {
        await client.query(
          `UPDATE library_book_copies SET condition = $2::text, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [issue.book_copy_id, stFinal]
        );
      }
    });

    const r = await query(
      `${ISSUE_LIST_SELECT} ${ISSUE_LIST_JOINS} WHERE i.id = $1`,
      [id]
    );
    const out = r.rows[0] ? mapIssueRow(r.rows[0]) : null;
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Return recorded',
      data: out ? normalizeIssueDates(out) : null,
    });
  } catch (e) {
    if (e.code === 'NOT_FOUND') {
      return res.status(404).json({ status: 'ERROR', message: 'Issue not found' });
    }
    if (e.code === 'NOT_OPEN') {
      return res.status(409).json({ status: 'ERROR', message: 'Issue is not open' });
    }
    console.error('library issue return', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to record return' });
  }
};

module.exports = {
  listIssues,
  getIssue,
  createIssue,
  returnIssue,
};
