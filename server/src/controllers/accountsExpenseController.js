const { query, executeTransaction } = require('../config/database');
const { resolveAcademicYearIdFromQuery } = require('../utils/libraryAcademicYear');
const { parsePagination, listMeta, buildOrderClause } = require('../utils/accountsPagination');
const {
  sliceYmd,
  resolveRequiredAcademicYearId,
  assertCategoryUsable,
  mapLedgerToExpense,
  LEDGER_FROM,
} = require('../utils/accountsFinancialLedger');

const TX_TYPE = 'Expense';

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
    let where = `WHERE fl.deleted_at IS NULL AND fl.transaction_type = '${TX_TYPE}'`;
    if (yearId != null) {
      params.push(yearId);
      where += ` AND fl.academic_year_id = $${params.length}`;
    }
    if (Number.isFinite(categoryId)) {
      params.push(categoryId);
      where += ` AND fl.category_id = $${params.length}`;
    }
    if (status && ['Completed', 'Pending'].includes(status)) {
      params.push(status);
      where += ` AND fl.status = $${params.length}`;
    }
    if (search) {
      const p = `%${search}%`;
      params.push(p);
      const n = params.length;
      where += ` AND (
        fl.title ILIKE $${n}
        OR COALESCE(fl.description, '') ILIKE $${n}
        OR COALESCE(fl.invoice_no, '') ILIKE $${n}
        OR COALESCE(cat.category_name, '') ILIKE $${n}
      )`;
    }
    if (dateFrom) {
      params.push(dateFrom);
      where += ` AND fl.transaction_date >= $${params.length}::date`;
    }
    if (dateTo) {
      params.push(dateTo);
      where += ` AND fl.transaction_date <= $${params.length}::date`;
    }

    const orderSql = buildOrderClause(
      req.query,
      {
        expense_date: 'fl.transaction_date',
        amount: 'fl.amount',
        expense_name: 'fl.title',
        invoice_no: 'fl.invoice_no',
        status: 'fl.status',
        category_name: 'cat.category_name',
        payment_method: 'fl.payment_mode',
        id: 'fl.id',
      },
      'expense_date',
      'fl.id DESC'
    );

    const countR = await query(`SELECT COUNT(*)::int AS c ${LEDGER_FROM} ${where}`, [...params]);
    const total = countR.rows[0].c;

    const dataParams = [...params, limit, offset];
    const limIdx = dataParams.length - 1;
    const offIdx = dataParams.length;
    const r = await query(
      `SELECT fl.*, cat.category_name
       ${LEDGER_FROM}
       ${where}
       ${orderSql}
       LIMIT $${limIdx} OFFSET $${offIdx}`,
      dataParams
    );
    const data = r.rows.map(mapLedgerToExpense);
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
      `SELECT fl.*, cat.category_name
       ${LEDGER_FROM}
       WHERE fl.id = $1 AND fl.deleted_at IS NULL AND fl.transaction_type = $2`,
      [id, TX_TYPE]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Expense not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: mapLedgerToExpense(r.rows[0]) });
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
    const yearId = await resolveRequiredAcademicYearId(req.body, await resolveAcademicYearIdFromQuery(req));
    if (!Number.isFinite(yearId)) {
      return res.status(400).json({ status: 'ERROR', message: 'academic_year_id is required' });
    }
    const expense_date = sliceYmd(req.body.expense_date);
    if (!expense_date) {
      return res.status(400).json({ status: 'ERROR', message: 'expense_date is required (YYYY-MM-DD)' });
    }

    const row = await executeTransaction(async (client) => {
      await assertCategoryUsable(client, category_id, yearId, 'Expense');

      const ins = await client.query(
        `INSERT INTO financial_ledger (
           academic_year_id, category_id, title, description, transaction_date,
           amount, transaction_type, payment_mode, invoice_no, status,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING *`,
        [
          yearId,
          category_id,
          String(req.body.expense_name).trim(),
          req.body.description != null ? String(req.body.description).trim() : null,
          expense_date,
          req.body.amount,
          TX_TYPE,
          req.body.payment_method != null ? String(req.body.payment_method).trim() : null,
          req.body.invoice_no != null ? String(req.body.invoice_no).trim() : null,
          req.body.status || 'Completed',
        ]
      );
      return ins.rows[0];
    });

    const cat = await query(
      `SELECT category_name FROM account_categories WHERE id = $1 AND deleted_at IS NULL`,
      [category_id]
    );
    res.status(201).json({
      status: 'SUCCESS',
      message: 'Expense created',
      data: mapLedgerToExpense({ ...row, category_name: cat.rows[0]?.category_name }),
    });
  } catch (e) {
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

    const existing = await query(
      `SELECT * FROM financial_ledger WHERE id = $1 AND deleted_at IS NULL AND transaction_type = $2`,
      [id, TX_TYPE]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Expense not found' });
    }
    const cur = existing.rows[0];

    const category_id =
      req.body.category_id != null ? parseInt(req.body.category_id, 10) : cur.category_id;
    if (!Number.isFinite(category_id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid category_id' });
    }

    const title = req.body.expense_name != null ? String(req.body.expense_name).trim() : cur.title;
    const description =
      req.body.description !== undefined
        ? req.body.description != null
          ? String(req.body.description).trim()
          : null
        : cur.description;
    const transaction_date =
      req.body.expense_date != null ? sliceYmd(req.body.expense_date) || cur.transaction_date : cur.transaction_date;
    const amount = req.body.amount != null ? req.body.amount : cur.amount;
    const invoice_no =
      req.body.invoice_no !== undefined
        ? req.body.invoice_no != null
          ? String(req.body.invoice_no).trim()
          : null
        : cur.invoice_no;
    const payment_mode =
      req.body.payment_method !== undefined
        ? req.body.payment_method != null
          ? String(req.body.payment_method).trim()
          : null
        : cur.payment_mode;
    const status = req.body.status != null ? req.body.status : cur.status;
    const academic_year_id =
      req.body.academic_year_id !== undefined
        ? req.body.academic_year_id != null && req.body.academic_year_id !== ''
          ? parseInt(req.body.academic_year_id, 10)
          : cur.academic_year_id
        : cur.academic_year_id;

    await executeTransaction(async (client) => {
      await assertCategoryUsable(client, category_id, academic_year_id, 'Expense');

      await client.query(
        `UPDATE financial_ledger SET
           academic_year_id = $1,
           category_id = $2,
           title = $3,
           description = $4,
           transaction_date = $5::date,
           amount = $6,
           payment_mode = $7,
           invoice_no = $8,
           status = $9,
           updated_at = NOW()
         WHERE id = $10 AND deleted_at IS NULL AND transaction_type = $11`,
        [
          academic_year_id,
          category_id,
          title,
          description,
          transaction_date,
          amount,
          payment_mode,
          invoice_no,
          status,
          id,
          TX_TYPE,
        ]
      );
    });

    const r = await query(
      `SELECT fl.*, cat.category_name
       ${LEDGER_FROM}
       WHERE fl.id = $1 AND fl.deleted_at IS NULL`,
      [id]
    );
    res.status(200).json({ status: 'SUCCESS', message: 'Expense updated', data: mapLedgerToExpense(r.rows[0]) });
  } catch (e) {
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
    const del = await query(
      `UPDATE financial_ledger
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL AND transaction_type = $2
       RETURNING id`,
      [id, TX_TYPE]
    );
    if (del.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Expense not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'Expense deleted', data: { id } });
  } catch (e) {
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
