const { query, executeTransaction } = require('../config/database');
const { toYmd } = require('../utils/dateOnly');
const { resolveAcademicYearIdFromQuery, getDefaultAcademicYearId } = require('../utils/libraryAcademicYear');
const { getLibraryPersonScope } = require('../utils/libraryPersonScope');

function normalizeReservationStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'pending') return 'Pending';
  if (s === 'fulfilled') return 'Fulfilled';
  if (s === 'cancelled') return 'Cancelled';
  if (s === 'expired') return 'Expired';
  return raw;
}

function mapReservationRow(row) {
  const cls =
    row.class_name && row.section_name
      ? `${row.class_name}, ${row.section_name}`
      : row.class_name || row.section_name || '';
  const requester =
    row.student_id != null
      ? row.student_name || ''
      : row.staff_id != null
        ? row.staff_name || ''
        : '';
  return {
    ...row,
    reservedAtFormatted: row.reserved_at ? toYmd(row.reserved_at) : '',
    expirationDateFormatted: row.expiration_date ? toYmd(row.expiration_date) : '',
    requesterLabel: requester,
    classLabel: cls,
    borrowerPhoto:
      row.borrower_photo ||
      row.img ||
      'assets/img/profiles/avatar-01.jpg',
    bookSummary: row.book_title || '',
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

const LIST_SELECT = `
  SELECT r.id,
         r.academic_year_id,
         r.book_id,
         r.student_id,
         r.staff_id,
         r.student_lifecycle_id,
         r.reserved_at,
         to_char(r.expiration_date::date, 'YYYY-MM-DD') AS expiration_date,
         COALESCE(TRIM(r.status::text), 'Pending') AS status,
         r.created_at,
         r.updated_at,
         b.book_title,
         b.author,
         b.isbn,
         TRIM(CONCAT(COALESCE(su.first_name, ''), ' ', COALESCE(su.last_name, ''))) AS student_name,
         TRIM(CONCAT(COALESCE(stfu.first_name, ''), ' ', COALESCE(stfu.last_name, ''))) AS staff_name,
         c.class_name,
         sec.section_name,
         CASE WHEN r.student_id IS NOT NULL THEN NULLIF(TRIM(COALESCE(su.avatar::text, '')), '') ELSE st.photo_url END AS borrower_photo
`;

const LIST_JOINS = `
  FROM library_book_reservations r
  INNER JOIN library_books b ON b.id = r.book_id AND b.deleted_at IS NULL
  LEFT JOIN students s ON s.id = r.student_id
  LEFT JOIN users su ON su.id = s.user_id
  LEFT JOIN student_lifecycle_ledger sl ON sl.id = r.student_lifecycle_id
  LEFT JOIN classes c ON c.id = sl.to_class_id
  LEFT JOIN sections sec ON sec.id = sl.to_section_id
  LEFT JOIN staff st ON st.id = r.staff_id
  LEFT JOIN users stfu ON stfu.id = st.user_id
`;

const listReservations = async (req, res) => {
  try {
    const scope = await getLibraryPersonScope(req);

    if (scope.restrict_to_self && scope.student_id == null) {
      return res.status(200).json({ status: 'SUCCESS', message: 'OK', data: [], count: 0 });
    }

    let yearId = await resolveAcademicYearIdFromQuery(req);
    if (yearId == null && scope.student_id != null) {
      const sy = await query(`SELECT academic_year_id FROM students WHERE id = $1 LIMIT 1`, [scope.student_id]);
      const candidate = sy.rows[0]?.academic_year_id;
      if (candidate != null && Number.isFinite(Number(candidate))) yearId = Number(candidate);
    }
    if (yearId == null) yearId = await getDefaultAcademicYearId();

    const params = [];
    let where = 'WHERE r.deleted_at IS NULL';
    const statusRaw = req.query.status ? String(req.query.status).trim() : '';
    if (statusRaw) {
      const normalized = normalizeReservationStatus(statusRaw);
      params.push(normalized);
      where += ` AND COALESCE(TRIM(r.status::text), 'Pending') = $${params.length}`;
    }

    if (yearId != null) {
      params.push(yearId);
      where += ` AND r.academic_year_id = $${params.length}`;
    }

    if (scope.student_id != null) {
      params.push(scope.student_id);
      where += ` AND r.student_id = $${params.length}`;
    } else if (req.query.member_id != null && String(req.query.member_id).trim() !== '') {
      const mid = parseInt(String(req.query.member_id), 10);
      if (Number.isFinite(mid)) {
        const mr = await query(
          `SELECT student_id, staff_id FROM library_members WHERE id = $1 AND LOWER(TRIM(COALESCE(status, 'active'))) = 'active'`,
          [mid]
        );
        const mrow = mr.rows[0];
        if (!mrow) {
          return res.status(200).json({ status: 'SUCCESS', message: 'OK', data: [], count: 0 });
        }
        if (mrow.student_id != null) {
          params.push(mrow.student_id);
          where += ` AND r.student_id = $${params.length}`;
        } else if (mrow.staff_id != null) {
          params.push(mrow.staff_id);
          where += ` AND r.staff_id = $${params.length}`;
        }
      }
    }

    if (req.query.book_id != null && String(req.query.book_id).trim() !== '') {
      params.push(parseInt(req.query.book_id, 10));
      where += ` AND r.book_id = $${params.length}`;
    }

    const search = req.query.search ? String(req.query.search).trim() : '';
    if (search) {
      const p = `%${search}%`;
      params.push(p);
      const i = params.length;
      where += ` AND (
        b.book_title ILIKE $${i}
        OR COALESCE(b.isbn::text, '') ILIKE $${i}
        OR TRIM(CONCAT(COALESCE(su.first_name, ''), ' ', COALESCE(su.last_name, ''))) ILIKE $${i}
        OR TRIM(CONCAT(COALESCE(stfu.first_name, ''), ' ', COALESCE(stfu.last_name, ''))) ILIKE $${i}
      )`;
    }

    const sql = `${LIST_SELECT} ${LIST_JOINS} ${where} ORDER BY r.reserved_at ASC, r.id ASC`;
    const r = await query(sql, params);
    const data = r.rows.map(mapReservationRow);
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Reservations fetched',
      data,
      count: data.length,
    });
  } catch (e) {
    console.error('library reservations list', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to list reservations' });
  }
};

const getReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = await getLibraryPersonScope(req);
    const r = await query(`${LIST_SELECT} ${LIST_JOINS} WHERE r.id = $1`, [id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Reservation not found' });
    }
    const row = r.rows[0];
    if (
      scope.restrict_to_self &&
      (scope.student_id == null || Number(row.student_id) !== Number(scope.student_id))
    ) {
      return res.status(403).json({ status: 'ERROR', message: 'Access denied' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: mapReservationRow(row) });
  } catch (e) {
    console.error('library reservation get', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to get reservation' });
  }
};

const createReservation = async (req, res) => {
  try {
    const body = req.body || {};
    const { library_member_id, book_id, expiration_date: expIn, academic_year_id: bodyAy } = body;
    const mid = parseInt(library_member_id, 10);
    const bid = parseInt(book_id, 10);
    if (!Number.isFinite(mid)) {
      return res.status(400).json({ status: 'ERROR', message: 'library_member_id is required' });
    }
    if (!Number.isFinite(bid)) {
      return res.status(400).json({ status: 'ERROR', message: 'book_id is required' });
    }

    let expSlice = '';
    if (expIn != null && String(expIn).trim()) {
      expSlice = String(expIn).trim().slice(0, 10);
    }

    const row = await executeTransaction(async (client) => {
      const memR = await client.query(
        `SELECT id, student_id, staff_id, academic_year_id
         FROM library_members
         WHERE id = $1 AND LOWER(TRIM(COALESCE(status, 'active'))) = 'active'`,
        [mid]
      );
      if (memR.rows.length === 0) throw Object.assign(new Error('INVALID_MEMBER'), { code: 'INVALID_MEMBER' });
      const mem = memR.rows[0];

      let academicYearId =
        bodyAy != null && bodyAy !== '' ? parseInt(String(bodyAy), 10) : mem.academic_year_id;
      if (!Number.isFinite(academicYearId)) academicYearId = await getDefaultAcademicYearId();

      const bk = await client.query(
        `SELECT id FROM library_books WHERE id = $1 AND deleted_at IS NULL`,
        [bid]
      );
      if (bk.rows.length === 0) throw Object.assign(new Error('BOOK_NOT_FOUND'), { code: 'BOOK_NOT_FOUND' });

      let studentLifecycleId = null;
      if (mem.student_id != null) {
        studentLifecycleId = await resolveStudentLifecycleId(client, mem.student_id, academicYearId);
      }

      const dup = await client.query(
        `SELECT 1 FROM library_book_reservations
         WHERE book_id = $1
           AND academic_year_id = $2
           AND status = 'Pending'
           AND deleted_at IS NULL
           AND student_id IS NOT DISTINCT FROM $3
           AND staff_id IS NOT DISTINCT FROM $4`,
        [bid, academicYearId, mem.student_id, mem.staff_id]
      );
      if (dup.rows.length > 0) {
        throw Object.assign(new Error('DUP_PENDING'), { code: 'DUP_PENDING' });
      }

      const ins = await client.query(
        `INSERT INTO library_book_reservations (
           academic_year_id, book_id, student_id, staff_id, student_lifecycle_id,
           reserved_at, expiration_date, status, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5,
           CURRENT_TIMESTAMP, $6::date, 'Pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         ) RETURNING *`,
        [
          academicYearId,
          bid,
          mem.student_id,
          mem.staff_id,
          studentLifecycleId,
          expSlice || null,
        ]
      );
      return ins.rows[0];
    });

    const full = await query(`${LIST_SELECT} ${LIST_JOINS} WHERE r.id = $1`, [row.id]);
    const out = full.rows[0] ? mapReservationRow(full.rows[0]) : row;
    res.status(201).json({ status: 'SUCCESS', message: 'Reservation created', data: out });
  } catch (e) {
    if (e.code === 'INVALID_MEMBER') {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid or inactive library member' });
    }
    if (e.code === 'BOOK_NOT_FOUND') {
      return res.status(404).json({ status: 'ERROR', message: 'Book not found' });
    }
    if (e.code === 'DUP_PENDING') {
      return res.status(409).json({
        status: 'ERROR',
        message: 'This member already has a pending reservation for this book in this academic year.',
      });
    }
    if (e.code === 'NO_LIFECYCLE') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Student has no enrollment ledger row for this academic year; promote/enrol first.',
      });
    }
    console.error('library reservation create', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to create reservation' });
  }
};

const updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const stIn = (req.body || {}).status;
    const stFinal = normalizeReservationStatus(stIn);
    if (!['Cancelled', 'Fulfilled', 'Expired'].includes(stFinal)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'status must be Cancelled, Fulfilled, or Expired',
      });
    }

    await executeTransaction(async (client) => {
      const ex = await client.query(
        `SELECT id, COALESCE(TRIM(status::text), 'Pending') AS status
         FROM library_book_reservations
         WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id]
      );
      if (ex.rows.length === 0) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
      if (ex.rows[0].status !== 'Pending') {
        throw Object.assign(new Error('NOT_PENDING'), { code: 'NOT_PENDING' });
      }
      await client.query(
        `UPDATE library_book_reservations SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id, stFinal]
      );
    });

    const full = await query(`${LIST_SELECT} ${LIST_JOINS} WHERE r.id = $1`, [id]);
    const out = full.rows[0] ? mapReservationRow(full.rows[0]) : null;
    res.status(200).json({ status: 'SUCCESS', message: 'Reservation updated', data: out });
  } catch (e) {
    if (e.code === 'NOT_FOUND') {
      return res.status(404).json({ status: 'ERROR', message: 'Reservation not found' });
    }
    if (e.code === 'NOT_PENDING') {
      return res.status(409).json({ status: 'ERROR', message: 'Only pending reservations can be updated' });
    }
    console.error('library reservation update', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to update reservation' });
  }
};

module.exports = {
  listReservations,
  getReservation,
  createReservation,
  updateReservationStatus,
};
