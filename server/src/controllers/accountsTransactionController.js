const { query } = require('../config/database');
const { resolveAcademicYearIdFromQuery } = require('../utils/libraryAcademicYear');
const { parsePagination, listMeta, buildOrderClause } = require('../utils/accountsPagination');
const { mapLedgerToTransaction, LEDGER_FROM } = require('../utils/accountsFinancialLedger');

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
    let where = 'WHERE fl.deleted_at IS NULL';
    if (yearId != null) {
      params.push(yearId);
      where += ` AND fl.academic_year_id = $${params.length}`;
    }
    if (txType && ['Income', 'Expense'].includes(txType)) {
      params.push(txType);
      where += ` AND fl.transaction_type = $${params.length}`;
    }
    if (status && ['Completed', 'Pending'].includes(status)) {
      params.push(status);
      where += ` AND fl.status = $${params.length}`;
    }
    if (Number.isFinite(categoryId)) {
      params.push(categoryId);
      where += ` AND fl.category_id = $${params.length}`;
    }
    if (search) {
      const p = `%${search}%`;
      params.push(p);
      const n = params.length;
      where += ` AND (
        fl.title ILIKE $${n}
        OR COALESCE(fl.description, '') ILIKE $${n}
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
        transaction_date: 'fl.transaction_date',
        amount: 'fl.amount',
        transaction_type: 'fl.transaction_type',
        status: 'fl.status',
        payment_method: 'fl.payment_mode',
        description: 'fl.title',
        category_name: 'cat.category_name',
        id: 'fl.id',
      },
      'transaction_date',
      'fl.id DESC'
    );

    const countR = await query(`SELECT COUNT(*)::int AS c ${LEDGER_FROM} ${where}`, [...params]);
    const total = countR.rows[0].c;

    const dataParams = [...params, limit, offset];
    const limIdx = dataParams.length - 1;
    const offIdx = dataParams.length;
    const r = await query(
      `SELECT fl.*, cat.category_name, fd.document_name, fd.file_path, fd.file_size, fd.file_type
       ${LEDGER_FROM}
       ${where}
       ${orderSql}
       LIMIT $${limIdx} OFFSET $${offIdx}`,
      dataParams
    );
    const data = r.rows.map(mapLedgerToTransaction);
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
      `SELECT fl.*, cat.category_name, fd.document_name, fd.file_path, fd.file_size, fd.file_type
       ${LEDGER_FROM}
       WHERE fl.id = $1 AND fl.deleted_at IS NULL`,
      [id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Transaction not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: mapLedgerToTransaction(r.rows[0]) });
  } catch (e) {
    console.error('accounts transactions get', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to get transaction' });
  }
};

module.exports = {
  listTransactions,
  getTransaction,
};
