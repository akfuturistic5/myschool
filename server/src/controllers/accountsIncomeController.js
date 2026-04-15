const { query, executeTransaction } = require('../config/database');
const { resolveAcademicYearIdFromQuery } = require('../utils/libraryAcademicYear');
const { parsePagination, listMeta, buildOrderClause } = require('../utils/accountsPagination');

function padCode(prefix, id) {
  return `${prefix}${String(id).padStart(6, '0')}`;
}

function sliceYmd(s) {
  if (s == null || String(s).trim() === '') return null;
  return String(s).trim().slice(0, 10);
}

function mapIncomeRow(row) {
  if (!row) return null;
  const id = row.id;
  return {
    id,
    income_code: padCode('I', id),
    income_name: row.income_name,
    description: row.description,
    source: row.source,
    income_date: row.income_date,
    amount: row.amount != null ? Number(row.amount) : null,
    invoice_no: row.invoice_no,
    payment_method: row.payment_method,
    academic_year_id: row.academic_year_id,
    created_at: row.created_at,
    modified_at: row.modified_at,
  };
}

const listIncome = async (req, res) => {
  try {
    const yearId = await resolveAcademicYearIdFromQuery(req);
    const search = req.query.search ? String(req.query.search).trim() : '';
    const dateFrom = req.query.date_from ? String(req.query.date_from).trim().slice(0, 10) : '';
    const dateTo = req.query.date_to ? String(req.query.date_to).trim().slice(0, 10) : '';
    const paymentMethod = req.query.payment_method ? String(req.query.payment_method).trim() : '';
    const { page, pageSize, limit, offset } = parsePagination(req.query);

    const params = [];
    let where = 'WHERE 1=1';
    if (yearId != null) {
      params.push(yearId);
      where += ` AND i.academic_year_id = $${params.length}`;
    }
    if (search) {
      const p = `%${search}%`;
      params.push(p);
      const n = params.length;
      where += ` AND (
        i.income_name ILIKE $${n}
        OR COALESCE(i.description, '') ILIKE $${n}
        OR COALESCE(i.source, '') ILIKE $${n}
        OR COALESCE(i.invoice_no, '') ILIKE $${n}
      )`;
    }
    if (dateFrom) {
      params.push(dateFrom);
      where += ` AND i.income_date >= $${params.length}::date`;
    }
    if (dateTo) {
      params.push(dateTo);
      where += ` AND i.income_date <= $${params.length}::date`;
    }
    if (paymentMethod) {
      params.push(paymentMethod);
      where += ` AND i.payment_method = $${params.length}`;
    }

    const countR = await query(`SELECT COUNT(*)::int AS c FROM accounts_income i ${where}`, [...params]);
    const total = countR.rows[0].c;

    const orderSql = buildOrderClause(
      req.query,
      {
        income_date: 'i.income_date',
        amount: 'i.amount',
        income_name: 'i.income_name',
        invoice_no: 'i.invoice_no',
        source: 'i.source',
        payment_method: 'i.payment_method',
        description: 'i.description',
        id: 'i.id',
      },
      'income_date',
      'i.id DESC'
    );
    const dataParams = [...params, limit, offset];
    const limIdx = dataParams.length - 1;
    const offIdx = dataParams.length;
    const r = await query(
      `SELECT i.*
       FROM accounts_income i
       ${where}
       ${orderSql}
       LIMIT $${limIdx} OFFSET $${offIdx}`,
      dataParams
    );
    const data = r.rows.map(mapIncomeRow);
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Income records fetched',
      data,
      count: data.length,
      ...listMeta(total, page, pageSize),
    });
  } catch (e) {
    console.error('accounts income list', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to list income records' });
  }
};

const getIncome = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    const r = await query(`SELECT * FROM accounts_income WHERE id = $1`, [id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Income record not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: mapIncomeRow(r.rows[0]) });
  } catch (e) {
    console.error('accounts income get', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to get income record' });
  }
};

const createIncome = async (req, res) => {
  try {
    const yearId =
      req.body.academic_year_id != null && req.body.academic_year_id !== ''
        ? parseInt(req.body.academic_year_id, 10)
        : await resolveAcademicYearIdFromQuery({ query: {} });
    const income_date = sliceYmd(req.body.income_date);
    if (!income_date) {
      return res.status(400).json({ status: 'ERROR', message: 'income_date is required' });
    }

    const row = await executeTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO accounts_income (
           academic_year_id, income_name, description, source, income_date,
           amount, invoice_no, payment_method, created_at, modified_at
         ) VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          Number.isFinite(yearId) ? yearId : null,
          String(req.body.income_name).trim(),
          req.body.description != null ? String(req.body.description).trim() : null,
          req.body.source != null ? String(req.body.source).trim() : null,
          income_date,
          req.body.amount,
          req.body.invoice_no != null ? String(req.body.invoice_no).trim() : null,
          req.body.payment_method != null ? String(req.body.payment_method).trim() : null,
        ]
      );
      const income = ins.rows[0];
      await client.query(
        `INSERT INTO accounts_transactions (
           academic_year_id, description, transaction_date, amount, payment_method,
           transaction_type, status, income_id, expense_id, created_at, modified_at
         ) VALUES ($1, $2, $3::date, $4, $5, 'Income', 'Completed', $6, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [income.academic_year_id, income.income_name, income.income_date, income.amount, income.payment_method, income.id]
      );
      return income;
    });

    res.status(201).json({ status: 'SUCCESS', message: 'Income created', data: mapIncomeRow(row) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Invoice number already exists for this academic year' });
    }
    console.error('accounts income create', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to create income record' });
  }
};

const updateIncome = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }

    const existing = await query(`SELECT * FROM accounts_income WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Income record not found' });
    }

    const cur = existing.rows[0];
    const income_name = req.body.income_name != null ? String(req.body.income_name).trim() : cur.income_name;
    const description =
      req.body.description !== undefined ? (req.body.description != null ? String(req.body.description).trim() : null) : cur.description;
    const source =
      req.body.source !== undefined ? (req.body.source != null ? String(req.body.source).trim() : null) : cur.source;
    const income_date =
      req.body.income_date != null ? sliceYmd(req.body.income_date) || cur.income_date : cur.income_date;
    const amount = req.body.amount != null ? req.body.amount : cur.amount;
    const invoice_no =
      req.body.invoice_no !== undefined
        ? req.body.invoice_no != null
          ? String(req.body.invoice_no).trim()
          : null
        : cur.invoice_no;
    const payment_method =
      req.body.payment_method !== undefined
        ? req.body.payment_method != null
          ? String(req.body.payment_method).trim()
          : null
        : cur.payment_method;
    const academic_year_id =
      req.body.academic_year_id !== undefined
        ? req.body.academic_year_id != null && req.body.academic_year_id !== ''
          ? parseInt(req.body.academic_year_id, 10)
          : null
        : cur.academic_year_id;

    await executeTransaction(async (client) => {
      await client.query(
        `UPDATE accounts_income SET
           income_name = $1,
           description = $2,
           source = $3,
           income_date = $4::date,
           amount = $5,
           invoice_no = $6,
           payment_method = $7,
           academic_year_id = $8,
           modified_at = CURRENT_TIMESTAMP
         WHERE id = $9`,
        [income_name, description, source, income_date, amount, invoice_no, payment_method, academic_year_id, id]
      );

      await client.query(
        `UPDATE accounts_transactions SET
           description = $1,
           transaction_date = $2::date,
           amount = $3,
           payment_method = $4,
           academic_year_id = $5,
           modified_at = CURRENT_TIMESTAMP
         WHERE income_id = $6`,
        [income_name, income_date, amount, payment_method, academic_year_id, id]
      );
    });

    const r = await query(`SELECT * FROM accounts_income WHERE id = $1`, [id]);
    res.status(200).json({ status: 'SUCCESS', message: 'Income updated', data: mapIncomeRow(r.rows[0]) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Invoice number already exists for this academic year' });
    }
    console.error('accounts income update', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to update income record' });
  }
};

const deleteIncome = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    await executeTransaction(async (client) => {
      const del = await client.query(`DELETE FROM accounts_income WHERE id = $1 RETURNING id`, [id]);
      if (del.rows.length === 0) {
        throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
      }
    });
    res.status(200).json({ status: 'SUCCESS', message: 'Income deleted', data: { id } });
  } catch (e) {
    if (e.code === 'NOT_FOUND') {
      return res.status(404).json({ status: 'ERROR', message: 'Income record not found' });
    }
    console.error('accounts income delete', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to delete income record' });
  }
};

module.exports = {
  listIncome,
  getIncome,
  createIncome,
  updateIncome,
  deleteIncome,
};
