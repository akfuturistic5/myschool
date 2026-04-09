const { query } = require('../config/database');
const { resolveAcademicYearIdFromQuery } = require('../utils/libraryAcademicYear');
const { parsePagination, listMeta, buildOrderClause } = require('../utils/accountsPagination');

function padFt(id) {
  return `FT${String(id).padStart(6, '0')}`;
}

function mapTxRow(row) {
  if (!row) return null;
  const id = row.id;
  return {
    id,
    transaction_code: padFt(id),
    description: row.description,
    transaction_date: row.transaction_date,
    amount: row.amount != null ? Number(row.amount) : null,
    payment_method: row.payment_method,
    transaction_type: row.transaction_type,
    type: row.transaction_type,
    method: row.payment_method,
    date: row.transaction_date,
    status: row.status,
    income_id: row.income_id,
    expense_id: row.expense_id,
    expense_category_id: row.expense_category_id,
    category_name: row.category_name,
    academic_year_id: row.academic_year_id,
    created_at: row.created_at,
    modified_at: row.modified_at,
  };
}

const listTransactions = async (req, res) => {
  try {
    const yearId = await resolveAcademicYearIdFromQuery(req);
    const search = req.query.search ? String(req.query.search).trim() : '';
    const txType = req.query.transaction_type ? String(req.query.transaction_type).trim() : '';
    const status = req.query.status ? String(req.query.status).trim() : '';
    const dateFrom = req.query.date_from ? String(req.query.date_from).trim().slice(0, 10) : '';
    const dateTo = req.query.date_to ? String(req.query.date_to).trim().slice(0, 10) : '';
    const categoryId =
      req.query.category_id != null && String(req.query.category_id).trim() !== ''
        ? parseInt(req.query.category_id, 10)
        : null;
    const { page, pageSize, limit, offset } = parsePagination(req.query);

    const params = [];
    let where = 'WHERE 1=1';
    if (yearId != null) {
      params.push(yearId);
      where += ` AND t.academic_year_id = $${params.length}`;
    }
    if (txType && ['Income', 'Expense'].includes(txType)) {
      params.push(txType);
      where += ` AND t.transaction_type = $${params.length}`;
    }
    if (status && ['Completed', 'Pending'].includes(status)) {
      params.push(status);
      where += ` AND t.status = $${params.length}`;
    }
    if (Number.isFinite(categoryId)) {
      params.push(categoryId);
      where += ` AND e.category_id = $${params.length}`;
    }
    if (search) {
      const p = `%${search}%`;
      params.push(p);
      const n = params.length;
      where += ` AND (
        t.description ILIKE $${n}
        OR COALESCE(cat.category_name, '') ILIKE $${n}
      )`;
    }
    if (dateFrom) {
      params.push(dateFrom);
      where += ` AND t.transaction_date >= $${params.length}::date`;
    }
    if (dateTo) {
      params.push(dateTo);
      where += ` AND t.transaction_date <= $${params.length}::date`;
    }

    const baseFrom = `FROM accounts_transactions t
      LEFT JOIN accounts_expenses e ON e.id = t.expense_id
      LEFT JOIN accounts_expense_categories cat ON cat.id = e.category_id
      ${where}`;

    const orderSql = buildOrderClause(
      req.query,
      {
        transaction_date: 't.transaction_date',
        amount: 't.amount',
        transaction_type: 't.transaction_type',
        status: 't.status',
        payment_method: 't.payment_method',
        description: 't.description',
        category_name: 'cat.category_name',
        id: 't.id',
      },
      'transaction_date',
      't.id DESC'
    );

    const countR = await query(`SELECT COUNT(*)::int AS c ${baseFrom}`, [...params]);
    const total = countR.rows[0].c;

    const dataParams = [...params, limit, offset];
    const limIdx = dataParams.length - 1;
    const offIdx = dataParams.length;
    const r = await query(
      `SELECT t.*, e.category_id AS expense_category_id, cat.category_name
       ${baseFrom}
       ${orderSql}
       LIMIT $${limIdx} OFFSET $${offIdx}`,
      dataParams
    );
    const data = r.rows.map(mapTxRow);
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Transactions fetched',
      data,
      count: data.length,
      ...listMeta(total, page, pageSize),
    });
  } catch (e) {
    console.error('accounts transactions list', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to list transactions' });
  }
};

const getTransaction = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    const r = await query(
      `SELECT t.*, e.category_id AS expense_category_id, cat.category_name
       FROM accounts_transactions t
       LEFT JOIN accounts_expenses e ON e.id = t.expense_id
       LEFT JOIN accounts_expense_categories cat ON cat.id = e.category_id
       WHERE t.id = $1`,
      [id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Transaction not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: mapTxRow(r.rows[0]) });
  } catch (e) {
    console.error('accounts transactions get', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to get transaction' });
  }
};

module.exports = {
  listTransactions,
  getTransaction,
};
