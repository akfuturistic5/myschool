const { query, executeTransaction } = require('../config/database');
const { resolveAcademicYearIdFromQuery } = require('../utils/libraryAcademicYear');
const { parsePagination, listMeta, buildOrderClause } = require('../utils/accountsPagination');

function sliceYmd(s) {
  if (s == null || String(s).trim() === '') return null;
  return String(s).trim().slice(0, 10);
}

function mapInvoiceRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    invoice_number: row.invoice_number,
    invoice_date: row.invoice_date,
    description: row.description,
    amount: row.amount != null ? Number(row.amount) : null,
    payment_method: row.payment_method,
    due_date: row.due_date,
    status: row.status,
    academic_year_id: row.academic_year_id,
    created_at: row.created_at,
    modified_at: row.modified_at,
  };
}

const listInvoices = async (req, res) => {
  try {
    const yearId = await resolveAcademicYearIdFromQuery(req);
    const search = req.query.search ? String(req.query.search).trim() : '';
    const status = req.query.status ? String(req.query.status).trim() : '';
    const dateFrom = req.query.date_from ? String(req.query.date_from).trim().slice(0, 10) : '';
    const dateTo = req.query.date_to ? String(req.query.date_to).trim().slice(0, 10) : '';
    const paymentMethod =
      req.query.payment_method != null && String(req.query.payment_method).trim() !== ''
        ? String(req.query.payment_method).trim()
        : '';
    const { page, pageSize, limit, offset } = parsePagination(req.query);

    const params = [];
    let where = 'WHERE 1=1';
    if (yearId != null) {
      params.push(yearId);
      where += ` AND v.academic_year_id = $${params.length}`;
    }
    if (status && ['Paid', 'Pending', 'Overdue'].includes(status)) {
      params.push(status);
      where += ` AND v.status = $${params.length}`;
    }
    if (search) {
      const p = `%${search}%`;
      params.push(p);
      const n = params.length;
      where += ` AND (
        v.invoice_number ILIKE $${n}
        OR COALESCE(v.description, '') ILIKE $${n}
      )`;
    }
    if (dateFrom) {
      params.push(dateFrom);
      where += ` AND v.invoice_date >= $${params.length}::date`;
    }
    if (dateTo) {
      params.push(dateTo);
      where += ` AND v.invoice_date <= $${params.length}::date`;
    }
    if (paymentMethod) {
      const p = `%${paymentMethod}%`;
      params.push(p);
      where += ` AND COALESCE(v.payment_method, '') ILIKE $${params.length}`;
    }

    const orderSql = buildOrderClause(
      req.query,
      {
        invoice_date: 'v.invoice_date',
        due_date: 'v.due_date',
        amount: 'v.amount',
        invoice_number: 'v.invoice_number',
        description: 'v.description',
        payment_method: 'v.payment_method',
        status: 'v.status',
        id: 'v.id',
      },
      'invoice_date',
      'v.id DESC'
    );

    const countR = await query(`SELECT COUNT(*)::int AS c FROM accounts_invoices v ${where}`, [...params]);
    const total = countR.rows[0].c;

    const dataParams = [...params, limit, offset];
    const limIdx = dataParams.length - 1;
    const offIdx = dataParams.length;
    const r = await query(
      `SELECT v.*
       FROM accounts_invoices v
       ${where}
       ${orderSql}
       LIMIT $${limIdx} OFFSET $${offIdx}`,
      dataParams
    );
    const data = r.rows.map(mapInvoiceRow);
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Invoices fetched',
      data,
      count: data.length,
      ...listMeta(total, page, pageSize),
    });
  } catch (e) {
    console.error('accounts invoices list', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to list invoices' });
  }
};

const getInvoice = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    const r = await query(`SELECT * FROM accounts_invoices WHERE id = $1`, [id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Invoice not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: mapInvoiceRow(r.rows[0]) });
  } catch (e) {
    console.error('accounts invoices get', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to get invoice' });
  }
};

const createInvoice = async (req, res) => {
  try {
    const yearId =
      req.body.academic_year_id != null && req.body.academic_year_id !== ''
        ? parseInt(req.body.academic_year_id, 10)
        : await resolveAcademicYearIdFromQuery({ query: {} });
    const invoice_date = sliceYmd(req.body.invoice_date);
    const due_date = sliceYmd(req.body.due_date);
    if (!invoice_date || !due_date) {
      return res.status(400).json({ status: 'ERROR', message: 'invoice_date and due_date are required' });
    }

    const row = await executeTransaction(async (client) => {
      const r = await client.query(
        `INSERT INTO accounts_invoices (
           academic_year_id, invoice_number, invoice_date, description, amount,
           payment_method, due_date, status, created_at, modified_at
         ) VALUES ($1, $2, $3::date, $4, $5, $6, $7::date, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          Number.isFinite(yearId) ? yearId : null,
          String(req.body.invoice_number).trim(),
          invoice_date,
          req.body.description != null ? String(req.body.description).trim() : null,
          req.body.amount,
          req.body.payment_method != null ? String(req.body.payment_method).trim() : null,
          due_date,
          req.body.status,
        ]
      );
      return r.rows[0];
    });

    res.status(201).json({ status: 'SUCCESS', message: 'Invoice created', data: mapInvoiceRow(row) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Invoice number already exists for this academic year' });
    }
    console.error('accounts invoices create', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to create invoice' });
  }
};

const updateInvoice = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    const existing = await query(`SELECT * FROM accounts_invoices WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Invoice not found' });
    }
    const cur = existing.rows[0];

    const invoice_number =
      req.body.invoice_number != null ? String(req.body.invoice_number).trim() : cur.invoice_number;
    const invoice_date =
      req.body.invoice_date != null ? sliceYmd(req.body.invoice_date) || cur.invoice_date : cur.invoice_date;
    const description =
      req.body.description !== undefined ? (req.body.description != null ? String(req.body.description).trim() : null) : cur.description;
    const amount = req.body.amount != null ? req.body.amount : cur.amount;
    const payment_method =
      req.body.payment_method !== undefined
        ? req.body.payment_method != null
          ? String(req.body.payment_method).trim()
          : null
        : cur.payment_method;
    const due_date = req.body.due_date != null ? sliceYmd(req.body.due_date) || cur.due_date : cur.due_date;
    const status = req.body.status != null ? req.body.status : cur.status;
    const academic_year_id =
      req.body.academic_year_id !== undefined
        ? req.body.academic_year_id != null && req.body.academic_year_id !== ''
          ? parseInt(req.body.academic_year_id, 10)
          : null
        : cur.academic_year_id;

    const updated = await executeTransaction(async (client) => {
      const u = await client.query(
        `UPDATE accounts_invoices SET
           invoice_number = $1,
           invoice_date = $2::date,
           description = $3,
           amount = $4,
           payment_method = $5,
           due_date = $6::date,
           status = $7,
           academic_year_id = $8,
           modified_at = CURRENT_TIMESTAMP
         WHERE id = $9
         RETURNING *`,
        [invoice_number, invoice_date, description, amount, payment_method, due_date, status, academic_year_id, id]
      );
      return u.rows[0];
    });
    res.status(200).json({ status: 'SUCCESS', message: 'Invoice updated', data: mapInvoiceRow(updated) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Invoice number already exists for this academic year' });
    }
    console.error('accounts invoices update', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to update invoice' });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    await executeTransaction(async (client) => {
      const del = await client.query(`DELETE FROM accounts_invoices WHERE id = $1 RETURNING id`, [id]);
      if (del.rows.length === 0) {
        throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
      }
    });
    res.status(200).json({ status: 'SUCCESS', message: 'Invoice deleted', data: { id } });
  } catch (e) {
    if (e.code === 'NOT_FOUND') {
      return res.status(404).json({ status: 'ERROR', message: 'Invoice not found' });
    }
    console.error('accounts invoices delete', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to delete invoice' });
  }
};

module.exports = {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
};
