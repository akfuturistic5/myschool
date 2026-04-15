const { query } = require('../config/database');
const { toYmd } = require('../utils/dateOnly');
const { resolveAcademicYearIdFromQuery, getDefaultAcademicYearId } = require('../utils/libraryAcademicYear');

function normalizeIsbn(v) {
  if (v == null || String(v).trim() === '') return null;
  return String(v).trim().slice(0, 20);
}

function normalizeBookCode(v) {
  if (v == null || String(v).trim() === '') return null;
  return String(v).trim().slice(0, 50);
}

const listBooks = async (req, res) => {
  try {
    const yearId = await resolveAcademicYearIdFromQuery(req);
    const search = req.query.search ? String(req.query.search).trim() : '';
    const categoryId =
      req.query.category_id != null && String(req.query.category_id).trim() !== ''
        ? parseInt(req.query.category_id, 10)
        : null;
    const bookCode = req.query.book_code ? String(req.query.book_code).trim() : '';
    const dateFrom = req.query.date_from ? String(req.query.date_from).trim().slice(0, 10) : '';
    const dateTo = req.query.date_to ? String(req.query.date_to).trim().slice(0, 10) : '';

    const params = [];
    let where = 'WHERE COALESCE(b.is_active, true) = true';
    if (yearId != null) {
      params.push(yearId);
      where += ` AND b.academic_year_id = $${params.length}`;
    }
    if (search) {
      const p = `%${search}%`;
      params.push(p);
      const i = params.length;
      where += ` AND (
        b.book_title ILIKE $${i}
        OR b.author ILIKE $${i}
        OR COALESCE(b.isbn, '') ILIKE $${i}
        OR COALESCE(b.book_code, '') ILIKE $${i}
      )`;
    }
    if (Number.isFinite(categoryId)) {
      params.push(categoryId);
      where += ` AND b.category_id = $${params.length}`;
    }
    if (bookCode) {
      params.push(`%${bookCode}%`);
      where += ` AND COALESCE(b.book_code, '') ILIKE $${params.length}`;
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
      `SELECT b.id, b.academic_year_id, b.book_title, b.book_code, b.author, b.isbn, b.publisher, b.publication_year,
              b.category_id, c.category_name,
              b.total_copies, b.available_copies, b.book_price, b.book_location, b.description,
              b.is_active, b.created_at, b.modified_at
       FROM library_books b
       LEFT JOIN library_categories c ON c.id = b.category_id
       ${where}
       ORDER BY b.book_title ASC`,
      params
    );
    const data = r.rows.map((row) => ({
      ...row,
      bookName: row.book_title,
      bookNo: row.book_code || row.isbn || '',
      rackNo: row.book_location || '',
      subject: row.category_name || '',
      qty: row.total_copies != null ? String(row.total_copies) : '0',
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
      `SELECT b.*, c.category_name
       FROM library_books b
       LEFT JOIN library_categories c ON c.id = b.category_id
       WHERE b.id = $1`,
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
    const userId = req.user?.id || null;
    const {
      book_title,
      book_code,
      author,
      isbn,
      publisher,
      publication_year,
      category_id,
      total_copies,
      available_copies,
      book_price,
      book_location,
      description,
      academic_year_id,
    } = req.body;

    let ay =
      academic_year_id != null && academic_year_id !== ''
        ? parseInt(academic_year_id, 10)
        : null;
    if (!Number.isFinite(ay)) {
      ay = await getDefaultAcademicYearId();
    }

    const tc = Math.max(1, parseInt(total_copies, 10) || 1);
    const ac = available_copies != null ? parseInt(available_copies, 10) : tc;
    const av = Math.min(Math.max(0, Number.isFinite(ac) ? ac : tc), tc);

    const isbnN = normalizeIsbn(isbn);
    const codeN = normalizeBookCode(book_code);

    const r = await query(
      `INSERT INTO library_books (
        book_title, book_code, author, isbn, publisher, publication_year, category_id,
        total_copies, available_copies, book_price, book_location, description,
        academic_year_id,
        is_active, created_by, created_at, modified_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13,
        true, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *`,
      [
        String(book_title).trim(),
        codeN,
        author != null ? String(author).trim() : null,
        isbnN,
        publisher != null ? String(publisher).trim() : null,
        publication_year != null ? parseInt(publication_year, 10) : null,
        category_id != null && category_id !== '' ? parseInt(category_id, 10) : null,
        tc,
        av,
        book_price != null && book_price !== '' ? parseFloat(String(book_price)) : null,
        book_location != null ? String(book_location).trim() : null,
        description != null ? String(description).trim() : null,
        ay,
        userId,
      ]
    );
    res.status(201).json({ status: 'SUCCESS', message: 'Book created', data: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Duplicate ISBN or book code',
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
    const book_code =
      body.book_code !== undefined ? normalizeBookCode(body.book_code) : ex.book_code;
    const author = body.author !== undefined ? (body.author == null ? null : String(body.author).trim()) : ex.author;
    const isbn = body.isbn !== undefined ? normalizeIsbn(body.isbn) : ex.isbn;
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

    const tcIn = body.total_copies != null ? parseInt(body.total_copies, 10) : ex.total_copies;
    const tc = Math.max(1, Number.isFinite(tcIn) ? tcIn : 1);
    let av = body.available_copies != null ? parseInt(body.available_copies, 10) : ex.available_copies;
    if (!Number.isFinite(av)) av = ex.available_copies;
    av = Math.min(Math.max(0, av), tc);

    const book_price =
      body.book_price !== undefined
        ? body.book_price == null || body.book_price === ''
          ? null
          : parseFloat(String(body.book_price))
        : ex.book_price;
    const book_location =
      body.book_location !== undefined
        ? body.book_location == null
          ? null
          : String(body.book_location).trim()
        : ex.book_location;
    const description =
      body.description !== undefined
        ? body.description == null
          ? null
          : String(body.description).trim()
        : ex.description;
    const is_active =
      typeof body.is_active === 'boolean' ? body.is_active : ex.is_active;

    let academic_year_id = ex.academic_year_id;
    if (body.academic_year_id !== undefined) {
      academic_year_id =
        body.academic_year_id == null || body.academic_year_id === ''
          ? null
          : parseInt(body.academic_year_id, 10);
      if (!Number.isFinite(academic_year_id)) academic_year_id = ex.academic_year_id;
    }

    const r = await query(
      `UPDATE library_books SET
         book_title = $2,
         book_code = $3,
         author = $4,
         isbn = $5,
         publisher = $6,
         publication_year = $7,
         category_id = $8,
         total_copies = $9,
         available_copies = $10,
         book_price = $11,
         book_location = $12,
         description = $13,
         is_active = $14,
         academic_year_id = $15,
         modified_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        book_title,
        book_code,
        author,
        isbn,
        publisher,
        publication_year,
        category_id,
        tc,
        av,
        book_price,
        book_location,
        description,
        is_active,
        academic_year_id,
      ]
    );
    res.status(200).json({ status: 'SUCCESS', message: 'Book updated', data: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Duplicate ISBN or book code' });
    }
    console.error('library book update', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to update book' });
  }
};

const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;
    const open = await query(
      `SELECT 1 FROM library_book_issues WHERE book_id = $1 AND status = 'issued' LIMIT 1`,
      [id]
    );
    if (open.rows.length > 0) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Book has active issues; return books before deleting',
      });
    }
    const r = await query(
      `UPDATE library_books SET is_active = false, modified_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`,
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

function normalizeBookCodeForDup(v) {
  const n = normalizeBookCode(v);
  return n == null ? '' : n.toLowerCase();
}

async function findImportDuplicate(academicYearId, bookTitle, bookCodeRaw) {
  const title = String(bookTitle).trim();
  const codeCmp = normalizeBookCodeForDup(bookCodeRaw);
  const r = await query(
    `SELECT id FROM library_books
     WHERE academic_year_id = $1
       AND COALESCE(is_active, true) = true
       AND LOWER(TRIM(book_title)) = LOWER(TRIM($2))
       AND LOWER(TRIM(COALESCE(book_code, ''))) = $3
     LIMIT 1`,
    [academicYearId, title, codeCmp]
  );
  return r.rows[0]?.id ?? null;
}

/** Batch create books (import). Partial success: returns per-row errors. */
const importBooks = async (req, res) => {
  try {
    const { books, academic_year_id: bodyYear } = req.body || {};
    if (!Array.isArray(books) || books.length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'books array required' });
    }
    if (books.length > 500) {
      return res.status(400).json({ status: 'ERROR', message: 'Maximum 500 rows per import' });
    }
    let ay =
      bodyYear != null && bodyYear !== '' ? parseInt(String(bodyYear), 10) : null;
    if (!Number.isFinite(ay)) {
      ay = await getDefaultAcademicYearId();
    }
    const userId = req.user?.id || null;
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
        if (row.total_copies == null || row.total_copies === '') {
          summary.failed += 1;
          summary.errors.push({ index: i, message: 'total_copies required' });
          continue;
        }
        const tc = parseInt(String(row.total_copies), 10);
        if (!Number.isFinite(tc) || tc < 1) {
          summary.failed += 1;
          summary.errors.push({ index: i, message: 'total_copies must be a positive integer' });
          continue;
        }
        let ac = row.available_copies != null ? parseInt(row.available_copies, 10) : tc;
        if (!Number.isFinite(ac)) ac = tc;
        ac = Math.min(Math.max(0, ac), tc);
        const catId = await resolveCategoryFromRow(row);
        if (catId == null || !Number.isFinite(catId)) {
          summary.failed += 1;
          summary.errors.push({
            index: i,
            message: 'category must match an existing category (use category, category_id, or category_name)',
          });
          continue;
        }
        const dup = await findImportDuplicate(ay, book_title, row.book_code);
        if (dup != null) {
          summary.failed += 1;
          summary.errors.push({
            index: i,
            message: 'Duplicate: same book_title and book_code already exist for this academic year',
          });
          continue;
        }
        const isbnN = normalizeIsbn(row.isbn);
        const codeN = normalizeBookCode(row.book_code);
        await query(
          `INSERT INTO library_books (
            book_title, book_code, author, isbn, publisher, publication_year, category_id,
            total_copies, available_copies, book_price, book_location, description,
            academic_year_id,
            is_active, created_by, created_at, modified_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13,
            true, $14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`,
          [
            book_title,
            codeN,
            row.author != null ? String(row.author).trim() : null,
            isbnN,
            row.publisher != null ? String(row.publisher).trim() : null,
            row.publication_year != null && row.publication_year !== ''
              ? parseInt(row.publication_year, 10)
              : null,
            catId,
            tc,
            ac,
            row.book_price != null && row.book_price !== '' ? parseFloat(String(row.book_price)) : null,
            row.book_location != null ? String(row.book_location).trim() : null,
            row.description != null ? String(row.description).trim() : null,
            ay,
            userId,
          ]
        );
        summary.created += 1;
      } catch (err) {
        summary.failed += 1;
        summary.errors.push({
          index: i,
          message: err.code === '23505' ? 'Duplicate book code for this academic year' : err.message || 'insert failed',
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
