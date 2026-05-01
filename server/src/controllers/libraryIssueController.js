const { query, executeTransaction } = require('../config/database');
const { ROLES } = require('../config/roles');
const { toYmd } = require('../utils/dateOnly');
const { resolveAcademicYearIdFromQuery } = require('../utils/libraryAcademicYear');

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
  return {
    ...row,
    dateofIssue: row.issue_date ? toYmd(row.issue_date) : '',
    dueDate: row.due_date ? toYmd(row.due_date) : '',
    issueTo,
    booksIssued: row.book_title || '',
    bookReturned: row.status === 'returned' ? 'Yes' : 'No',
    issueRemarks: row.remarks || '',
    class: cls,
    img: row.borrower_photo || 'assets/img/profiles/avatar-01.jpg',
  };
}

const listIssues = async (req, res) => {
  try {
    const includeAllYears =
      String(req.query.include_all_years || '').trim() === '1' ||
      String(req.query.include_all_years || '').trim().toLowerCase() === 'true';
    let yearId = includeAllYears ? null : await resolveAcademicYearIdFromQuery(req);
    const status = req.query.status ? String(req.query.status).toLowerCase() : '';
    const scope = await getPersonScope(req);

    const params = [];
    let where = 'WHERE COALESCE(i.is_active, true) = true';
    if (status === 'issued' || status === 'returned' || status === 'lost' || status === 'damaged') {
      params.push(status);
      where += ` AND i.status = $${params.length}`;
    }

    if (scope.student_id != null) {
      const scopedStudentIds = [scope.student_id];
      if (yearId == null) {
        const sy = await query(
          `SELECT academic_year_id FROM students WHERE id = $1 LIMIT 1`,
          [scope.student_id]
        );
        const candidate = sy.rows[0]?.academic_year_id;
        if (candidate != null && Number.isFinite(Number(candidate))) {
          yearId = Number(candidate);
        }
      }
      params.push(scopedStudentIds);
      where += ` AND i.student_id = ANY($${params.length}::int[])`;
    } else if (req.query.member_id != null && String(req.query.member_id).trim() !== '') {
      const mid = parseInt(String(req.query.member_id), 10);
      if (Number.isFinite(mid)) {
        const mr = await query(
          `SELECT student_id, staff_id FROM library_members WHERE id = $1 AND COALESCE(is_active, true) = true`,
          [mid]
        );
        const mrow = mr.rows[0];
        if (!mrow) {
          return res.status(200).json({
            status: 'SUCCESS',
            message: 'Issues fetched',
            data: [],
            count: 0,
          });
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
        if (candidate != null && Number.isFinite(Number(candidate))) {
          yearId = Number(candidate);
        }
      }
      params.push(resolvedStudentIds.length > 0 ? resolvedStudentIds : [requestedStudentId]);
      where += ` AND i.student_id = ANY($${params.length}::int[])`;
    }

    if (yearId != null) {
      params.push(yearId);
      where += ` AND b.academic_year_id = $${params.length}`;
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
      where += ` AND i.book_id = $${params.length}`;
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
        OR TRIM(CONCAT(s.first_name, ' ', s.last_name)) ILIKE $${i}
        OR TRIM(CONCAT(stf.first_name, ' ', stf.last_name)) ILIKE $${i}
      )`;
    }

    const r = await query(
      `SELECT i.id, i.book_id, i.student_id, i.staff_id,
              to_char(i.issue_date::date, 'YYYY-MM-DD') AS issue_date,
              to_char(i.due_date::date, 'YYYY-MM-DD') AS due_date,
              to_char(i.return_date::date, 'YYYY-MM-DD') AS return_date,
              i.fine_amount, i.status, i.remarks, i.created_at,
              b.book_title, b.book_code, b.isbn,
              TRIM(CONCAT(s.first_name, ' ', s.last_name)) AS student_name,
              TRIM(CONCAT(stf.first_name, ' ', stf.last_name)) AS staff_name,
              c.class_name, sec.section_name,
              CASE WHEN i.student_id IS NOT NULL THEN s.photo_url ELSE stf.photo_url END AS borrower_photo
       FROM library_book_issues i
       JOIN library_books b ON b.id = i.book_id
       LEFT JOIN students s ON s.id = i.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       LEFT JOIN staff stf ON stf.id = i.staff_id
       ${where}
       ORDER BY i.issue_date DESC, i.id DESC`,
      params
    );
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
      `SELECT i.id, i.book_id, i.student_id, i.staff_id,
              to_char(i.issue_date::date, 'YYYY-MM-DD') AS issue_date,
              to_char(i.due_date::date, 'YYYY-MM-DD') AS due_date,
              to_char(i.return_date::date, 'YYYY-MM-DD') AS return_date,
              i.fine_amount, i.status, i.remarks, i.created_at, i.issued_by, i.returned_to, i.is_active, i.created_by, i.modified_at,
              b.book_title, b.book_code, b.isbn, b.author,
              TRIM(CONCAT(s.first_name, ' ', s.last_name)) AS student_name,
              s.roll_number,
              TRIM(CONCAT(stf.first_name, ' ', stf.last_name)) AS staff_name,
              c.class_name, sec.section_name,
              CASE WHEN i.student_id IS NOT NULL THEN s.photo_url ELSE stf.photo_url END AS borrower_photo
       FROM library_book_issues i
       JOIN library_books b ON b.id = i.book_id
       LEFT JOIN students s ON s.id = i.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       LEFT JOIN staff stf ON stf.id = i.staff_id
       WHERE i.id = $1`,
      [id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Issue not found' });
    }
    const row = r.rows[0];
    if (scope.student_id != null && row.student_id !== scope.student_id) {
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
    const { book_id, library_member_id, due_date, remarks } = req.body;
    const bid = parseInt(book_id, 10);
    const mid = parseInt(library_member_id, 10);
    if (!Number.isFinite(bid)) {
      return res.status(400).json({ status: 'ERROR', message: 'book_id is required' });
    }
    if (!Number.isFinite(mid)) {
      return res.status(400).json({ status: 'ERROR', message: 'library_member_id is required' });
    }
    if (!due_date || !String(due_date).trim()) {
      return res.status(400).json({ status: 'ERROR', message: 'due_date is required' });
    }
    const due = String(due_date).trim().slice(0, 10);

    const memR = await query(
      `SELECT id, member_type, student_id, staff_id, academic_year_id
       FROM library_members
       WHERE id = $1 AND COALESCE(is_active, true) = true`,
      [mid]
    );
    if (memR.rows.length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid or inactive library member' });
    }
    const mem = memR.rows[0];
    const sid = mem.member_type === 'student' ? mem.student_id : null;
    const tid = mem.member_type === 'staff' ? mem.staff_id : null;

    let issuedBy = null;
    const st = await query(`SELECT id FROM staff WHERE user_id = $1 LIMIT 1`, [userId]);
    if (st.rows.length > 0) issuedBy = st.rows[0].id;

    const row = await executeTransaction(async (client) => {
      const book = await client.query(
        `SELECT id, available_copies, academic_year_id FROM library_books WHERE id = $1 AND COALESCE(is_active, true) = true FOR UPDATE`,
        [bid]
      );
      if (book.rows.length === 0) {
        throw Object.assign(new Error('BOOK_NOT_FOUND'), { code: 'BOOK_NOT_FOUND' });
      }
      const bRow = book.rows[0];
      const av = bRow.available_copies ?? 0;
      if (av < 1) {
        throw Object.assign(new Error('NO_COPIES'), { code: 'NO_COPIES' });
      }
      if (
        mem.academic_year_id != null &&
        bRow.academic_year_id != null &&
        mem.academic_year_id !== bRow.academic_year_id
      ) {
        throw Object.assign(new Error('YEAR_MISMATCH'), { code: 'YEAR_MISMATCH' });
      }

      const ins = await client.query(
        `INSERT INTO library_book_issues (
           book_id, student_id, staff_id, issue_date, due_date, status, remarks,
           issued_by, is_active, created_by, created_at, modified_at
         ) VALUES (
           $1, $2, $3, CURRENT_DATE, $4::date, 'issued', $5,
           $6, true, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         ) RETURNING *`,
        [bid, sid, tid, due, remarks != null ? String(remarks).trim() : null, issuedBy, userId]
      );

      await client.query(
        `UPDATE library_books SET available_copies = available_copies - 1, modified_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [bid]
      );

      return ins.rows[0];
    });

    res.status(201).json({ status: 'SUCCESS', message: 'Book issued', data: normalizeIssueDates(row) });
  } catch (e) {
    if (e.code === 'BOOK_NOT_FOUND') {
      return res.status(404).json({ status: 'ERROR', message: 'Book not found' });
    }
    if (e.code === 'NO_COPIES') {
      return res.status(409).json({ status: 'ERROR', message: 'No copies available to issue' });
    }
    if (e.code === 'YEAR_MISMATCH') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Member and book must belong to the same academic year',
      });
    }
    if (e.code === '23503') {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid student, staff, or book reference' });
    }
    console.error('library issue create', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to issue book' });
  }
};

const returnIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const { fine_amount, remarks, status } = req.body || {};
    let returnedTo = null;
    const st = await query(`SELECT id FROM staff WHERE user_id = $1 LIMIT 1`, [userId]);
    if (st.rows.length > 0) returnedTo = st.rows[0].id;

    const stFinal = ['returned', 'lost', 'damaged'].includes(String(status || '').toLowerCase())
      ? String(status).toLowerCase()
      : 'returned';
    const fine =
      fine_amount != null && fine_amount !== '' ? parseFloat(String(fine_amount)) : 0;

    await executeTransaction(async (client) => {
      const iss = await client.query(
        `SELECT * FROM library_book_issues WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (iss.rows.length === 0) {
        throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
      }
      const issue = iss.rows[0];
      if (issue.status !== 'issued') {
        throw Object.assign(new Error('NOT_OPEN'), { code: 'NOT_OPEN' });
      }

      await client.query(
        `UPDATE library_book_issues SET
           status = $2,
           return_date = CURRENT_DATE,
           fine_amount = COALESCE($3, 0),
           remarks = COALESCE($4, remarks),
           returned_to = $5,
           modified_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [
          id,
          stFinal,
          Number.isFinite(fine) ? fine : 0,
          remarks != null ? String(remarks).trim() : null,
          returnedTo,
        ]
      );

      if (stFinal === 'returned') {
        await client.query(
          `UPDATE library_books SET available_copies = available_copies + 1, modified_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [issue.book_id]
        );
      }
    });

    const r = await query(
      `SELECT id, book_id, student_id, staff_id,
              to_char(issue_date::date, 'YYYY-MM-DD') AS issue_date,
              to_char(due_date::date, 'YYYY-MM-DD') AS due_date,
              to_char(return_date::date, 'YYYY-MM-DD') AS return_date,
              fine_amount, status, issued_by, returned_to, remarks, is_active, created_at, created_by, modified_at
       FROM library_book_issues WHERE id = $1`,
      [id]
    );
    res.status(200).json({ status: 'SUCCESS', message: 'Return recorded', data: normalizeIssueDates(r.rows[0]) });
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
