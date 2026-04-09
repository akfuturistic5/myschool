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

async function assertCategoryUsable(client, categoryId, expenseYearId) {
  const r = await client.query(
    `SELECT id, academic_year_id, COALESCE(is_active, true) AS is_active
     FROM accounts_expense_categories WHERE id = $1`,
    [categoryId]
  );
  if (r.rows.length === 0) {
    throw Object.assign(new Error('CATEGORY_NOT_FOUND'), { code: 'CATEGORY_NOT_FOUND' });
  }
  const c = r.rows[0];
  if (!c.is_active) {
    throw Object.assign(new Error('CATEGORY_INACTIVE'), { code: 'CATEGORY_INACTIVE' });
  }
  if (c.academic_year_id != null && expenseYearId == null) {
    throw Object.assign(new Error('CATEGORY_YEAR_MISMATCH'), { code: 'CATEGORY_YEAR_MISMATCH' });
  }
  if (c.academic_year_id != null && expenseYearId != null && c.academic_year_id !== expenseYearId) {
    throw Object.assign(new Error('CATEGORY_YEAR_MISMATCH'), { code: 'CATEGORY_YEAR_MISMATCH' });
  }
}

function mapExpenseRow(row) {
  if (!row) return null;
  const id = row.id;
  return {
    id,
    expense_code: padCode('E', id),
    academic_year_id: row.academic_year_id,
    category_id: row.category_id,
    category_name: row.category_name,
    expense_name: row.expense_name,
    description: row.description,
    expense_date: row.expense_date,
    amount: row.amount != null ? Number(row.amount) : null,
    invoice_no: row.invoice_no,
    payment_method: row.payment_method,
    status: row.status,
    created_at: row.created_at,
    modified_at: row.modified_at,
  };
}

const listExpenses = async (req, res) => {
  try {
    const yearId = await resolveAcademicYearIdFromQuery(req);
    const search = req.query.search ? String(req.query.search).trim() : '';
    const dateFrom = req.query.date_from ? String(req.query.date_from).trim().slice(0, 10) : '';
    const dateTo = req.query.date_to ? String(req.query.date_to).trim().slice(0, 10) : '';
    const categoryId =
      req.query.category_id != null && String(req.query.category_id).trim() !== ''
        ? parseInt(req.query.category_id, 10)
        : null;
    const status = req.query.status ? String(req.query.status).trim() : '';
    const { page, pageSize, limit, offset } = parsePagination(req.query);

    const params = [];
    let where = 'WHERE 1=1';
    if (yearId != null) {
      params.push(yearId);
      where += ` AND e.academic_year_id = $${params.length}`;
    }
    if (Number.isFinite(categoryId)) {
      params.push(categoryId);
      where += ` AND e.category_id = $${params.length}`;
    }
    if (status && ['Completed', 'Pending'].includes(status)) {
      params.push(status);
      where += ` AND e.status = $${params.length}`;
    }
    if (search) {
      const p = `%${search}%`;
      params.push(p);
      const n = params.length;
      where += ` AND (
        e.expense_name ILIKE $${n}
        OR COALESCE(e.description, '') ILIKE $${n}
        OR COALESCE(e.invoice_no, '') ILIKE $${n}
        OR COALESCE(cat.category_name, '') ILIKE $${n}
      )`;
    }
    if (dateFrom) {
      params.push(dateFrom);
      where += ` AND e.expense_date >= $${params.length}::date`;
    }
    if (dateTo) {
      params.push(dateTo);
      where += ` AND e.expense_date <= $${params.length}::date`;
    }

    const baseFrom = `FROM accounts_expenses e
      INNER JOIN accounts_expense_categories cat ON cat.id = e.category_id
      ${where}`;

    const orderSql = buildOrderClause(
      req.query,
      {
        expense_date: 'e.expense_date',
        amount: 'e.amount',
        expense_name: 'e.expense_name',
        invoice_no: 'e.invoice_no',
        status: 'e.status',
        category_name: 'cat.category_name',
        payment_method: 'e.payment_method',
        id: 'e.id',
      },
      'expense_date',
      'e.id DESC'
    );

    const countR = await query(`SELECT COUNT(*)::int AS c ${baseFrom}`, [...params]);
    const total = countR.rows[0].c;

    const dataParams = [...params, limit, offset];
    const limIdx = dataParams.length - 1;
    const offIdx = dataParams.length;
    const r = await query(
      `SELECT e.*, cat.category_name
       ${baseFrom}
       ${orderSql}
       LIMIT $${limIdx} OFFSET $${offIdx}`,
      dataParams
    );
    const data = r.rows.map(mapExpenseRow);
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Expenses fetched',
      data,
      count: data.length,
      ...listMeta(total, page, pageSize),
    });
  } catch (e) {
    console.error('accounts expenses list', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to list expenses' });
  }
};

const getExpense = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    const r = await query(
      `SELECT e.*, cat.category_name
       FROM accounts_expenses e
       INNER JOIN accounts_expense_categories cat ON cat.id = e.category_id
       WHERE e.id = $1`,
      [id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Expense not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: mapExpenseRow(r.rows[0]) });
  } catch (e) {
    console.error('accounts expenses get', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to get expense' });
  }
};

const createExpense = async (req, res) => {
  try {
    const category_id = parseInt(req.body.category_id, 10);
    if (!Number.isFinite(category_id)) {
      return res.status(400).json({ status: 'ERROR', message: 'category_id is required' });
    }
    const yearId =
      req.body.academic_year_id != null && req.body.academic_year_id !== ''
        ? parseInt(req.body.academic_year_id, 10)
        : await resolveAcademicYearIdFromQuery({ query: {} });
    const expense_date = sliceYmd(req.body.expense_date);
    if (!expense_date) {
      return res.status(400).json({ status: 'ERROR', message: 'expense_date is required (YYYY-MM-DD)' });
    }

    const row = await executeTransaction(async (client) => {
      await assertCategoryUsable(client, category_id, Number.isFinite(yearId) ? yearId : null);

      const ins = await client.query(
        `INSERT INTO accounts_expenses (
           academic_year_id, category_id, expense_name, description, expense_date,
           amount, invoice_no, payment_method, status, created_at, modified_at
         ) VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          Number.isFinite(yearId) ? yearId : null,
          category_id,
          String(req.body.expense_name).trim(),
          req.body.description != null ? String(req.body.description).trim() : null,
          expense_date,
          req.body.amount,
          req.body.invoice_no != null ? String(req.body.invoice_no).trim() : null,
          req.body.payment_method != null ? String(req.body.payment_method).trim() : null,
          req.body.status || 'Completed',
        ]
      );
      const exp = ins.rows[0];

      await client.query(
        `INSERT INTO accounts_transactions (
           academic_year_id, description, transaction_date, amount, payment_method,
           transaction_type, status, income_id, expense_id, created_at, modified_at
         ) VALUES ($1, $2, $3::date, $4, $5, 'Expense', $6, NULL, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          exp.academic_year_id,
          exp.expense_name,
          exp.expense_date,
          exp.amount,
          exp.payment_method,
          exp.status === 'Pending' ? 'Pending' : 'Completed',
          exp.id,
        ]
      );
      return exp;
    });

    const cat = await query(`SELECT category_name FROM accounts_expense_categories WHERE id = $1`, [category_id]);
    const merged = { ...row, category_name: cat.rows[0]?.category_name };
    res.status(201).json({ status: 'SUCCESS', message: 'Expense created', data: mapExpenseRow(merged) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Invoice number already exists for this academic year' });
    }
    if (e.code === 'CATEGORY_NOT_FOUND') {
      return res.status(400).json({ status: 'ERROR', message: 'Category does not exist' });
    }
    if (e.code === 'CATEGORY_INACTIVE') {
      return res.status(400).json({ status: 'ERROR', message: 'Category is inactive' });
    }
    if (e.code === 'CATEGORY_YEAR_MISMATCH') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Category does not belong to the selected academic year',
      });
    }
    console.error('accounts expenses create', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to create expense' });
  }
};

const updateExpense = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }

    const existing = await query(`SELECT * FROM accounts_expenses WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Expense not found' });
    }
    const cur = existing.rows[0];

    const category_id =
      req.body.category_id != null ? parseInt(req.body.category_id, 10) : cur.category_id;
    if (!Number.isFinite(category_id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid category_id' });
    }

    const expense_name =
      req.body.expense_name != null ? String(req.body.expense_name).trim() : cur.expense_name;
    const description =
      req.body.description !== undefined ? (req.body.description != null ? String(req.body.description).trim() : null) : cur.description;
    const expense_date =
      req.body.expense_date != null ? sliceYmd(req.body.expense_date) || cur.expense_date : cur.expense_date;
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
    const status = req.body.status != null ? req.body.status : cur.status;
    const academic_year_id =
      req.body.academic_year_id !== undefined
        ? req.body.academic_year_id != null && req.body.academic_year_id !== ''
          ? parseInt(req.body.academic_year_id, 10)
          : null
        : cur.academic_year_id;

    await executeTransaction(async (client) => {
      await assertCategoryUsable(client, category_id, Number.isFinite(academic_year_id) ? academic_year_id : null);

      await client.query(
        `UPDATE accounts_expenses SET
           academic_year_id = $1,
           category_id = $2,
           expense_name = $3,
           description = $4,
           expense_date = $5::date,
           amount = $6,
           invoice_no = $7,
           payment_method = $8,
           status = $9,
           modified_at = CURRENT_TIMESTAMP
         WHERE id = $10`,
        [
          academic_year_id,
          category_id,
          expense_name,
          description,
          expense_date,
          amount,
          invoice_no,
          payment_method,
          status,
          id,
        ]
      );

      const txStatus = status === 'Pending' ? 'Pending' : 'Completed';
      await client.query(
        `UPDATE accounts_transactions SET
           description = $1,
           transaction_date = $2::date,
           amount = $3,
           payment_method = $4,
           academic_year_id = $5,
           status = $6,
           modified_at = CURRENT_TIMESTAMP
         WHERE expense_id = $7`,
        [expense_name, expense_date, amount, payment_method, academic_year_id, txStatus, id]
      );
    });

    const r = await query(
      `SELECT e.*, cat.category_name
       FROM accounts_expenses e
       INNER JOIN accounts_expense_categories cat ON cat.id = e.category_id
       WHERE e.id = $1`,
      [id]
    );
    res.status(200).json({ status: 'SUCCESS', message: 'Expense updated', data: mapExpenseRow(r.rows[0]) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Invoice number already exists for this academic year' });
    }
    if (e.code === 'CATEGORY_NOT_FOUND') {
      return res.status(400).json({ status: 'ERROR', message: 'Category does not exist' });
    }
    if (e.code === 'CATEGORY_INACTIVE') {
      return res.status(400).json({ status: 'ERROR', message: 'Category is inactive' });
    }
    if (e.code === 'CATEGORY_YEAR_MISMATCH') {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Category does not belong to the selected academic year',
      });
    }
    console.error('accounts expenses update', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to update expense' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    await executeTransaction(async (client) => {
      const del = await client.query(`DELETE FROM accounts_expenses WHERE id = $1 RETURNING id`, [id]);
      if (del.rows.length === 0) {
        throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
      }
    });
    res.status(200).json({ status: 'SUCCESS', message: 'Expense deleted', data: { id } });
  } catch (e) {
    if (e.code === 'NOT_FOUND') {
      return res.status(404).json({ status: 'ERROR', message: 'Expense not found' });
    }
    console.error('accounts expenses delete', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to delete expense' });
  }
};

module.exports = {
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
};
