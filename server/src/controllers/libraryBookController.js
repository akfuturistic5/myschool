const { query } = require('../config/database');
const { toYmd } = require('../utils/dateOnly');

function normalizeIsbn(v) {
  if (v == null || String(v).trim() === '') return null;
  return String(v).trim().slice(0, 20);
}

const listBooks = async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : '';
    const categoryId =
      req.query.category_id != null && String(req.query.category_id).trim() !== ''
        ? parseInt(req.query.category_id, 10)
        : null;
    const bookCode = req.query.book_code ? String(req.query.book_code).trim() : '';
    const dateFrom = req.query.date_from ? String(req.query.date_from).trim().slice(0, 10) : '';
    const dateTo = req.query.date_to ? String(req.query.date_to).trim().slice(0, 10) : '';

    const params = [];
    let where = 'WHERE b.deleted_at IS NULL';
    if (search) {
      const p = `%${search}%`;
      params.push(p);
      const i = params.length;
      where += ` AND (
        b.book_title ILIKE $${i}
        OR b.author ILIKE $${i}
        OR COALESCE(b.isbn, '') ILIKE $${i}
        OR COALESCE(b.publisher, '') ILIKE $${i}
      )`;
    }
    if (Number.isFinite(categoryId)) {
      params.push(categoryId);
      where += ` AND b.category_id = $${params.length}`;
    }
    if (bookCode) {
      params.push(`%${bookCode}%`);
      const i = params.length;
      where += ` AND (
        COALESCE(b.isbn, '') ILIKE $${i}
        OR EXISTS (
          SELECT 1
          FROM library_book_copies bc
          WHERE bc.book_id = b.id
            AND bc.deleted_at IS NULL
            AND bc.accession_number ILIKE $${i}
        )
      )`;
    }
    if (dateFrom) {
      params.push(dateFrom);
      where += ` AND b.created_at::date >= $${params.length}::date`;
    }
    if (dateTo) {
      params.push(dateTo);
      where += ` AND b.created_at::date <= $${params.length}::date`;
    }
    const r = await query(
      `SELECT b.id, b.book_title, b.author, b.edition, b.language, b.isbn, b.publisher, b.publication_year,
              b.category_id, c.category_name,
              b.book_price, b.created_at, b.updated_at,
              COALESCE(cc.total_copies, 0) AS copies_count,
              COALESCE(cc.available_copies, 0) AS available_copies
       FROM library_books b
       LEFT JOIN library_categories c ON c.id = b.category_id
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS total_copies,
           COUNT(*) FILTER (
             WHERE NOT EXISTS (
               SELECT 1
               FROM library_book_issues i
               WHERE i.book_copy_id = bc.id
                 AND COALESCE(i.status, 'Issued') = 'Issued'
                 AND i.deleted_at IS NULL
             )
           )::int AS available_copies
         FROM library_book_copies bc
         WHERE bc.book_id = b.id
           AND bc.deleted_at IS NULL
       ) cc ON true
       ${where}
       ORDER BY b.book_title ASC`,
      params
    );
    const data = r.rows.map((row) => ({
      ...row,
      bookName: row.book_title,
      bookNo: row.isbn || '',
      subject: row.category_name || '',
      qty: row.copies_count != null ? String(row.copies_count) : '0',
      available: row.available_copies != null ? String(row.available_copies) : '0',
      price: row.book_price != null ? String(row.book_price) : '',
      postDate: row.created_at ? toYmd(row.created_at) : '',
    }));
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Books fetched',
      data,
      count: data.length,
    });
  } catch (e) {
    console.error('library books list', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to list books' });
  }
};

const getBook = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await query(
      `SELECT b.*, c.category_name,
              COALESCE(cc.total_copies, 0) AS copies_count,
              COALESCE(cc.available_copies, 0) AS available_copies
       FROM library_books b
       LEFT JOIN library_categories c ON c.id = b.category_id
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS total_copies,
           COUNT(*) FILTER (
             WHERE NOT EXISTS (
               SELECT 1
               FROM library_book_issues i
               WHERE i.book_copy_id = bc.id
                 AND COALESCE(i.status, 'Issued') = 'Issued'
                 AND i.deleted_at IS NULL
             )
           )::int AS available_copies
         FROM library_book_copies bc
         WHERE bc.book_id = b.id
           AND bc.deleted_at IS NULL
       ) cc ON true
       WHERE b.id = $1
         AND b.deleted_at IS NULL`,
      [id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Book not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: r.rows[0] });
  } catch (e) {
    console.error('library book get', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to get book' });
  }
};

const createBook = async (req, res) => {
  try {
    const {
      book_title,
      book_code,
      author,
      edition,
      language,
      isbn,
      publisher,
      publication_year,
      category_id,
      book_price,
    } = req.body;
    const isbnN = normalizeIsbn(isbn || book_code);

    const r = await query(
      `INSERT INTO library_books (
        book_title, author, edition, language, isbn, publisher, publication_year, category_id,
        book_price, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *`,
      [
        String(book_title).trim(),
        author != null ? String(author).trim() : null,
        edition != null ? String(edition).trim() : null,
        language != null && String(language).trim() !== '' ? String(language).trim() : 'English',
        isbnN,
        publisher != null ? String(publisher).trim() : null,
        publication_year != null ? parseInt(publication_year, 10) : null,
        category_id != null && category_id !== '' ? parseInt(category_id, 10) : null,
        book_price != null && book_price !== '' ? parseFloat(String(book_price)) : null,
      ]
    );
    res.status(201).json({ status: 'SUCCESS', message: 'Book created', data: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Duplicate ISBN',
      });
    }
    console.error('library book create', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to create book' });
  }
};

const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const existing = await query(`SELECT * FROM library_books WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Book not found' });
    }
    const ex = existing.rows[0];

    const book_title =
      body.book_title !== undefined ? String(body.book_title).trim() : ex.book_title;
    const author = body.author !== undefined ? (body.author == null ? null : String(body.author).trim()) : ex.author;
    const edition = body.edition !== undefined ? (body.edition == null ? null : String(body.edition).trim()) : ex.edition;
    const language =
      body.language !== undefined
        ? body.language == null || String(body.language).trim() === ''
          ? 'English'
          : String(body.language).trim()
        : ex.language;
    const isbn = body.isbn !== undefined ? normalizeIsbn(body.isbn || body.book_code) : ex.isbn;
    const publisher =
      body.publisher !== undefined ? (body.publisher == null ? null : String(body.publisher).trim()) : ex.publisher;
    const publication_year =
      body.publication_year !== undefined
        ? body.publication_year == null || body.publication_year === ''
          ? null
          : parseInt(body.publication_year, 10)
        : ex.publication_year;
    const category_id =
      body.category_id !== undefined
        ? body.category_id == null || body.category_id === ''
          ? null
          : parseInt(body.category_id, 10)
        : ex.category_id;

    const book_price =
      body.book_price !== undefined
        ? body.book_price == null || body.book_price === ''
          ? null
          : parseFloat(String(body.book_price))
        : ex.book_price;
    const r = await query(
      `UPDATE library_books SET
         book_title = $2,
         author = $3,
         edition = $4,
         language = $5,
         isbn = $6,
         publisher = $7,
         publication_year = $8,
         category_id = $9,
         book_price = $10,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND deleted_at IS NULL
       RETURNING *`,
      [
        id,
        book_title,
        author,
        edition,
        language,
        isbn,
        publisher,
        publication_year,
        category_id,
        book_price,
      ]
    );
    res.status(200).json({ status: 'SUCCESS', message: 'Book updated', data: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Duplicate ISBN' });
    }
    console.error('library book update', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to update book' });
  }
};

const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;
    const open = await query(
      `SELECT 1
       FROM library_book_issues i
       INNER JOIN library_book_copies bc ON bc.id = i.book_copy_id
       WHERE bc.book_id = $1
         AND i.deleted_at IS NULL
         AND COALESCE(i.status, 'Issued') = 'Issued'
       LIMIT 1`,
      [id]
    );
    if (open.rows.length > 0) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Book has active issues; return books before deleting',
      });
    }
    const r = await query(
      `UPDATE library_books
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Book not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'Book deleted', data: { id: Number(id) } });
  } catch (e) {
    console.error('library book delete', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to delete book' });
  }
};

/** category | category_id | category_name — must match an active library_categories row */
async function resolveCategoryFromRow(row) {
  if (row.category_id != null && row.category_id !== '') {
    const id = parseInt(String(row.category_id), 10);
    if (Number.isFinite(id)) {
      const c = await query(
        `SELECT id FROM library_categories WHERE id = $1 AND COALESCE(is_active, true) = true`,
        [id]
      );
      return c.rows[0]?.id ?? null;
    }
  }
  if (row.category_name != null && String(row.category_name).trim() !== '') {
    const cr = await query(
      `SELECT id FROM library_categories
       WHERE LOWER(TRIM(category_name)) = LOWER(TRIM($1)) AND COALESCE(is_active, true) = true
       LIMIT 1`,
      [String(row.category_name).trim()]
    );
    return cr.rows[0]?.id ?? null;
  }
  if (row.category != null && String(row.category).trim() !== '') {
    const raw = String(row.category).trim();
    if (/^\d+$/.test(raw)) {
      const id = parseInt(raw, 10);
      const c = await query(
        `SELECT id FROM library_categories WHERE id = $1 AND COALESCE(is_active, true) = true`,
        [id]
      );
      return c.rows[0]?.id ?? null;
    }
    const cr = await query(
      `SELECT id FROM library_categories
       WHERE LOWER(TRIM(category_name)) = LOWER(TRIM($1)) AND COALESCE(is_active, true) = true
       LIMIT 1`,
      [raw]
    );
    return cr.rows[0]?.id ?? null;
  }
  return null;
}

async function findImportDuplicate(bookTitle, isbnRaw) {
  const title = String(bookTitle).trim();
  const isbnCmp = normalizeIsbn(isbnRaw);
  const r = await query(
    `SELECT id FROM library_books
     WHERE deleted_at IS NULL
       AND LOWER(TRIM(book_title)) = LOWER(TRIM($1))
       AND LOWER(TRIM(COALESCE(isbn, ''))) = LOWER(TRIM(COALESCE($2, '')))
     LIMIT 1`,
    [title, isbnCmp]
  );
  return r.rows[0]?.id ?? null;
}

/** Batch create books (import). Partial success: returns per-row errors. */
const importBooks = async (req, res) => {
  try {
    const { books } = req.body || {};
    if (!Array.isArray(books) || books.length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'books array required' });
    }
    if (books.length > 500) {
      return res.status(400).json({ status: 'ERROR', message: 'Maximum 500 rows per import' });
    }
    const summary = { created: 0, failed: 0, errors: [] };
    for (let i = 0; i < books.length; i++) {
      const row = books[i] || {};
      try {
        const book_title = row.book_title != null ? String(row.book_title).trim() : '';
        if (!book_title) {
          summary.failed += 1;
          summary.errors.push({ index: i, message: 'book_title required' });
          continue;
        }
        const catId = await resolveCategoryFromRow(row);
        if (catId == null || !Number.isFinite(catId)) {
          summary.failed += 1;
          summary.errors.push({
            index: i,
            message: 'category must match an existing category (use category, category_id, or category_name)',
          });
          continue;
        }
        const dup = await findImportDuplicate(book_title, row.isbn || row.book_code);
        if (dup != null) {
          summary.failed += 1;
          summary.errors.push({
            index: i,
            message: 'Duplicate: same book_title and ISBN already exist',
          });
          continue;
        }
        const isbnN = normalizeIsbn(row.isbn);
        await query(
          `INSERT INTO library_books (
            book_title, author, edition, language, isbn, publisher, publication_year, category_id,
            book_price, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`,
          [
            book_title,
            row.author != null ? String(row.author).trim() : null,
            row.edition != null ? String(row.edition).trim() : null,
            row.language != null && String(row.language).trim() !== '' ? String(row.language).trim() : 'English',
            isbnN,
            row.publisher != null ? String(row.publisher).trim() : null,
            row.publication_year != null && row.publication_year !== ''
              ? parseInt(row.publication_year, 10)
              : null,
            catId,
            row.book_price != null && row.book_price !== '' ? parseFloat(String(row.book_price)) : null,
          ]
        );
        summary.created += 1;
      } catch (err) {
        summary.failed += 1;
        summary.errors.push({
          index: i,
          message: err.code === '23505' ? 'Duplicate ISBN' : err.message || 'insert failed',
        });
      }
    }
    res.status(201).json({
      status: 'SUCCESS',
      message: 'Import completed',
      data: summary,
    });
  } catch (e) {
    console.error('library book import', e);
    res.status(500).json({ status: 'ERROR', message: 'Import failed' });
  }
};

module.exports = {
  listBooks,
  getBook,
  createBook,
  updateBook,
  deleteBook,
  importBooks,
};
