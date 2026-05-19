const { query } = require('../config/database');

/** Next serial accession ACC-00001 … (based on existing ACC-nnnnn copies). */
const suggestNextAccessionNumber = async (req, res) => {
  try {
    const r = await query(
      `SELECT accession_number
       FROM library_book_copies
       WHERE deleted_at IS NULL
         AND accession_number ~* '^ACC-[0-9]+$'`
    );
    let maxSeq = 0;
    for (const row of r.rows) {
      const m = /^ACC-(\d+)$/i.exec(String(row.accession_number || '').trim());
      if (m) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n)) maxSeq = Math.max(maxSeq, n);
      }
    }
    const next = maxSeq + 1;
    const accession_number = `ACC-${String(next).padStart(5, '0')}`;
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: { accession_number } });
  } catch (e) {
    console.error('library next accession', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to suggest accession number' });
  }
};

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
         bc.copy_price,
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
         bc.copy_price,
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

    const book = await query(`SELECT id FROM library_books WHERE id = $1 AND deleted_at IS NULL`, [bookId]);
    if (!book.rows.length) {
      return res.status(404).json({ status: 'ERROR', message: 'Book not found' });
    }

    let copies = [];
    if (Array.isArray(body.copies)) {
      copies = body.copies;
    } else {
      const accessionNumber = String(body.accession_number || '').trim();
      if (!accessionNumber) {
        return res.status(400).json({ status: 'ERROR', message: 'accession_number is required' });
      }
      copies.push({
        accession_number: accessionNumber,
        condition: body.condition != null && String(body.condition).trim() !== '' ? String(body.condition).trim() : 'New',
        book_location: body.book_location != null ? String(body.book_location).trim() : null,
        copy_price: body.copy_price != null && body.copy_price !== '' ? parseFloat(String(body.copy_price)) : null
      });
    }

    if (copies.length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'No copies provided' });
    }
    if (copies.length > 100) {
      return res.status(400).json({ status: 'ERROR', message: 'Cannot create more than 100 copies at once' });
    }

    const accessionSet = new Set();
    for (const copy of copies) {
      const acc = String(copy.accession_number || '').trim();
      if (!acc) {
        return res.status(400).json({ status: 'ERROR', message: 'accession_number is required for all copies' });
      }
      if (accessionSet.has(acc)) {
        return res.status(400).json({ status: 'ERROR', message: `Duplicate accession number '${acc}' in submission.` });
      }
      accessionSet.add(acc);
    }

    for (const acc of accessionSet) {
      const dup = await query(
        `SELECT 1 FROM library_book_copies WHERE accession_number = $1 AND deleted_at IS NULL`,
        [acc]
      );
      if (dup.rows.length) {
        return res.status(409).json({
          status: 'ERROR',
          message: `Accession number '${acc}' is already in use.`
        });
      }
    }

    const createdRows = [];
    for (const copy of copies) {
      const acc = String(copy.accession_number || '').trim();
      const condition = copy.condition != null && String(copy.condition).trim() !== '' ? String(copy.condition).trim() : 'New';
      const location = copy.book_location != null ? String(copy.book_location).trim() : null;
      const copyPrice = copy.copy_price != null && copy.copy_price !== '' ? parseFloat(String(copy.copy_price)) : null;

      const r = await query(
        `INSERT INTO library_book_copies (
           book_id, accession_number, book_location, condition, copy_price, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [bookId, acc, location || null, condition, Number.isFinite(copyPrice) ? copyPrice : null]
      );
      createdRows.push(r.rows[0]);
    }

    return res.status(201).json({
      status: 'SUCCESS',
      message: `${createdRows.length} book copies created`,
      data: createdRows[0],
      all_created: createdRows
    });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Duplicate accession number' });
    }
    console.error('library copy create bulk', e);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to create book copies' });
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
    let nextCopyPrice = ex.copy_price != null ? parseFloat(String(ex.copy_price)) : null;
    if (body.copy_price !== undefined) {
      nextCopyPrice =
        body.copy_price == null || body.copy_price === ''
          ? null
          : parseFloat(String(body.copy_price));
    }
    if (nextCopyPrice != null && !Number.isFinite(nextCopyPrice)) nextCopyPrice = null;

    const r = await query(
      `UPDATE library_book_copies SET
         book_id = $2,
         accession_number = $3,
         book_location = $4,
         condition = $5,
         copy_price = $6,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, nextBookId, nextAccession, nextLocation, nextCondition, nextCopyPrice]
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
  suggestNextAccessionNumber,
  listBookCopies,
  getBookCopy,
  createBookCopy,
  updateBookCopy,
  deleteBookCopy,
};
