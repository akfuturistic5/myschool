const { getDefaultAcademicYearId } = require('./libraryAcademicYear');

function padCode(prefix, id) {
  return `${prefix}${String(id).padStart(6, '0')}`;
}

function sliceYmd(s) {
  if (s == null || String(s).trim() === '') return null;
  return String(s).trim().slice(0, 10);
}

async function resolveRequiredAcademicYearId(body, queryYearId) {
  if (body?.academic_year_id != null && body.academic_year_id !== '') {
    const n = parseInt(body.academic_year_id, 10);
    if (Number.isFinite(n)) return n;
  }
  if (queryYearId != null && Number.isFinite(queryYearId)) return queryYearId;
  const def = await getDefaultAcademicYearId();
  if (def != null) return def;
  return null;
}

async function assertCategoryUsable(client, categoryId, yearId, expectedType) {
  if (categoryId == null) return;
  const r = await client.query(
    `SELECT id, academic_year_id, COALESCE(is_active, true) AS is_active, category_type
     FROM account_categories
     WHERE id = $1 AND deleted_at IS NULL AND category_type = $2`,
    [categoryId, expectedType]
  );
  if (r.rows.length === 0) {
    throw Object.assign(new Error('CATEGORY_NOT_FOUND'), { code: 'CATEGORY_NOT_FOUND' });
  }
  const c = r.rows[0];
  if (!c.is_active) {
    throw Object.assign(new Error('CATEGORY_INACTIVE'), { code: 'CATEGORY_INACTIVE' });
  }
  if (c.academic_year_id != null && yearId == null) {
    throw Object.assign(new Error('CATEGORY_YEAR_MISMATCH'), { code: 'CATEGORY_YEAR_MISMATCH' });
  }
  if (c.academic_year_id != null && yearId != null && c.academic_year_id !== yearId) {
    throw Object.assign(new Error('CATEGORY_YEAR_MISMATCH'), { code: 'CATEGORY_YEAR_MISMATCH' });
  }
}

function mapLedgerToExpense(row) {
  if (!row) return null;
  const id = row.id;
  return {
    id,
    expense_code: padCode('E', id),
    academic_year_id: row.academic_year_id,
    category_id: row.category_id,
    category_name: row.category_name ?? null,
    expense_name: row.title,
    description: row.description,
    expense_date: row.transaction_date,
    amount: row.amount != null ? Number(row.amount) : null,
    invoice_no: row.invoice_no,
    payment_method: row.payment_mode,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapLedgerToIncome(row) {
  if (!row) return null;
  const id = row.id;
  return {
    id,
    income_code: padCode('I', id),
    academic_year_id: row.academic_year_id,
    category_id: row.category_id,
    category_name: row.category_name ?? null,
    income_name: row.title,
    description: row.description,
    source: row.source_reference,
    income_date: row.transaction_date,
    amount: row.amount != null ? Number(row.amount) : null,
    invoice_no: row.invoice_no,
    payment_method: row.payment_mode,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapLedgerToTransaction(row) {
  if (!row) return null;
  const id = row.id;
  return {
    id,
    transaction_code: padCode('FT', id),
    description: row.title,
    transaction_date: row.transaction_date,
    amount: row.amount != null ? Number(row.amount) : null,
    payment_method: row.payment_mode,
    transaction_type: row.transaction_type,
    type: row.transaction_type,
    method: row.payment_mode,
    date: row.transaction_date,
    status: row.status,
    expense_category_id: row.transaction_type === 'Expense' ? row.category_id : null,
    category_id: row.category_id,
    category_name: row.category_name ?? null,
    academic_year_id: row.academic_year_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const LEDGER_FROM = `FROM financial_ledger fl
  LEFT JOIN account_categories cat ON cat.id = fl.category_id AND cat.deleted_at IS NULL`;

module.exports = {
  padCode,
  sliceYmd,
  resolveRequiredAcademicYearId,
  assertCategoryUsable,
  mapLedgerToExpense,
  mapLedgerToIncome,
  mapLedgerToTransaction,
  LEDGER_FROM,
};
