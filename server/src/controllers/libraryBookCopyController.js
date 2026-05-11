const { query } = require('../config/database');

const listBookCopies = async (req, res) => {
  try {
    const bookId =
      req.query.book_id != null && String(req.query.book_id).trim() !== ''
        ? parseInt(req.query.book_id, 10)
        : null;
    const accession = req.query.accession_number ? String(req.query.accession_number).trim() : '';
    const condition = req.query.condition ? String(req.query.condition).trim() : '';

    const params = [];
    let where = 'WHERE bc.deleted_at IS NULL AND b.deleted_at IS NULL';

    if (Number.isFinite(bookId)) {
      params.push(bookId);
      where += ` AND bc.book_id = $${params.length}`;
    }
    if (accession) {
      params.push(`%${accession}%`);
      where += ` AND bc.accession_number ILIKE $${params.length}`;
    }
    if (condition) {
      params.push(condition);
      where += ` AND COALESCE(bc.condition, 'New') = $${params.length}`;
    }

    const r = await query(
      `SELECT
         bc.id,
         bc.book_id,
         b.book_title,
         b.author,
         b.isbn,
         bc.accession_number,
         bc.book_location,
         COALESCE(bc.condition, 'New') AS condition,
         bc.created_at,
         bc.updated_at,
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM library_book_issues i
             WHERE i.book_copy_id = bc.id
               AND COALESCE(i.status, 'Issued') = 'Issued'
               AND i.deleted_at IS NULL
           )
           THEN false
           ELSE true
         END AS is_available
       FROM library_book_copies bc
       INNER JOIN library_books b ON b.id = bc.book_id
       ${where}
       ORDER BY b.book_title ASC, bc.accession_number ASC`,
      params
    );

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Book copies fetched',
      data: r.rows,
      count: r.rows.length,
    });
  } catch (e) {
    console.error('library copies list', e);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to list book copies' });
  }
};

const getBookCopy = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await query(
      `SELECT
         bc.id,
         bc.book_id,
         b.book_title,
         b.author,
         b.isbn,
         bc.accession_number,
         bc.book_location,
         COALESCE(bc.condition, 'New') AS condition,
         bc.created_at,
         bc.updated_at
       FROM library_book_copies bc
       INNER JOIN library_books b ON b.id = bc.book_id
       WHERE bc.id = $1
         AND bc.deleted_at IS NULL
         AND b.deleted_at IS NULL`,
      [id]
    );
    if (!r.rows.length) {
      return res.status(404).json({ status: 'ERROR', message: 'Book copy not found' });
    }
    return res.status(200).json({ status: 'SUCCESS', message: 'OK', data: r.rows[0] });
  } catch (e) {
    console.error('library copy get', e);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to get book copy' });
  }
};

const createBookCopy = async (req, res) => {
  try {
    const body = req.body || {};
    const bookId = parseInt(body.book_id, 10);
    if (!Number.isFinite(bookId)) {
      return res.status(400).json({ status: 'ERROR', message: 'book_id is required' });
    }
    const accessionNumber = String(body.accession_number || '').trim();
    if (!accessionNumber) {
      return res.status(400).json({ status: 'ERROR', message: 'accession_number is required' });
    }
    const condition = body.condition != null && String(body.condition).trim() !== '' ? String(body.condition).trim() : 'New';
    const location = body.book_location != null ? String(body.book_location).trim() : null;

    const book = await query(`SELECT id FROM library_books WHERE id = $1 AND deleted_at IS NULL`, [bookId]);
    if (!book.rows.length) {
      return res.status(404).json({ status: 'ERROR', message: 'Book not found' });
    }

    const r = await query(
      `INSERT INTO library_book_copies (
         book_id, accession_number, book_location, condition, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [bookId, accessionNumber, location || null, condition]
    );
    return res.status(201).json({ status: 'SUCCESS', message: 'Book copy created', data: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Duplicate accession number' });
    }
    console.error('library copy create', e);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to create book copy' });
  }
};

const updateBookCopy = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const existing = await query(`SELECT * FROM library_book_copies WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (!existing.rows.length) {
      return res.status(404).json({ status: 'ERROR', message: 'Book copy not found' });
    }
    const ex = existing.rows[0];
    const nextBookId =
      body.book_id !== undefined && body.book_id !== null && body.book_id !== ''
        ? parseInt(body.book_id, 10)
        : ex.book_id;
    const nextAccession =
      body.accession_number !== undefined ? String(body.accession_number || '').trim() : ex.accession_number;
    const nextCondition =
      body.condition !== undefined && body.condition !== null && String(body.condition).trim() !== ''
        ? String(body.condition).trim()
        : ex.condition || 'New';
    const nextLocation =
      body.book_location !== undefined
        ? body.book_location == null
          ? null
          : String(body.book_location).trim()
        : ex.book_location;

    const r = await query(
      `UPDATE library_book_copies SET
         book_id = $2,
         accession_number = $3,
         book_location = $4,
         condition = $5,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, nextBookId, nextAccession, nextLocation, nextCondition]
    );
    return res.status(200).json({ status: 'SUCCESS', message: 'Book copy updated', data: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Duplicate accession number' });
    }
    console.error('library copy update', e);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to update book copy' });
  }
};

const deleteBookCopy = async (req, res) => {
  try {
    const { id } = req.params;
    const issued = await query(
      `SELECT 1
       FROM library_book_issues
       WHERE book_copy_id = $1
         AND COALESCE(status, 'Issued') = 'Issued'
         AND deleted_at IS NULL
       LIMIT 1`,
      [id]
    );
    if (issued.rows.length) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Book copy has active issue; return it before deleting',
      });
    }
    const r = await query(
      `UPDATE library_book_copies
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    if (!r.rows.length) {
      return res.status(404).json({ status: 'ERROR', message: 'Book copy not found' });
    }
    return res.status(200).json({ status: 'SUCCESS', message: 'Book copy deleted', data: { id: Number(id) } });
  } catch (e) {
    console.error('library copy delete', e);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to delete book copy' });
  }
};

module.exports = {
  listBookCopies,
  getBookCopy,
  createBookCopy,
  updateBookCopy,
  deleteBookCopy,
};
