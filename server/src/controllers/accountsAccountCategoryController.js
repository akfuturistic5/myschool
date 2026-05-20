const { query } = require('../config/database');
const { resolveAcademicYearIdFromQuery, getDefaultAcademicYearId } = require('../utils/libraryAcademicYear');
const { parsePagination, listMeta, buildOrderClause } = require('../utils/accountsPagination');

const CATEGORY_TYPES = new Set(['Income', 'Expense']);

function normalizeCategoryType(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const v = String(raw).trim().toLowerCase();
  if (v === 'income') return 'Income';
  if (v === 'expense') return 'Expense';
  return null;
}

function mapCategoryRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    academic_year_id: row.academic_year_id,
    category_name: row.category_name,
    category_type: row.category_type,
    description: row.description,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

async function resolveAcademicYearIdForWrite(req) {
  const bodyRaw = req.body?.academic_year_id;
  if (bodyRaw != null && bodyRaw !== '') {
    const n = parseInt(bodyRaw, 10);
    if (Number.isFinite(n)) return n;
  }
  const queryRaw = req.query?.academic_year_id;
  if (queryRaw != null && String(queryRaw).trim() !== '') {
    const n = parseInt(String(queryRaw), 10);
    if (Number.isFinite(n)) return n;
  }
  return getDefaultAcademicYearId();
}

async function categoryInUse(id) {
  const ledger = await query(
    `SELECT COUNT(*)::int AS c FROM financial_ledger WHERE category_id = $1 AND deleted_at IS NULL`,
    [id]
  );
  if (ledger.rows[0].c > 0) return true;

  const hasLegacyExpenses = await query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'accounts_expenses'
     ) AS exists`
  );
  if (hasLegacyExpenses.rows[0]?.exists) {
    const legacy = await query(`SELECT COUNT(*)::int AS c FROM accounts_expenses WHERE category_id = $1`, [id]);
    if (legacy.rows[0].c > 0) return true;
  }
  return false;
}

function makeListCategories(forcedType = null) {
  return async (req, res) => {
    try {
      const yearId = await resolveAcademicYearIdFromQuery(req);
      const search = req.query.search ? String(req.query.search).trim() : '';
      const activeOnly = String(req.query.is_active || '').toLowerCase() === 'true';
      const typeFilter = forcedType || normalizeCategoryType(req.query.category_type);
      const { page, pageSize, limit, offset } = parsePagination(req.query);

      const params = [];
      let where = 'WHERE c.deleted_at IS NULL';
      if (yearId != null) {
        params.push(yearId);
        where += ` AND (c.academic_year_id IS NULL OR c.academic_year_id = $${params.length})`;
      }
      if (typeFilter && CATEGORY_TYPES.has(typeFilter)) {
        params.push(typeFilter);
        where += ` AND c.category_type = $${params.length}`;
      }
      if (activeOnly) {
        where += ' AND COALESCE(c.is_active, true) = true';
      }
      if (search) {
        const p = `%${search}%`;
        params.push(p);
        const n = params.length;
        where += ` AND (c.category_name ILIKE $${n} OR COALESCE(c.description, '') ILIKE $${n})`;
      }

      const orderSql = buildOrderClause(
        req.query,
        {
          category_name: 'c.category_name',
          category_type: 'c.category_type',
          id: 'c.id',
          created_at: 'c.created_at',
        },
        'category_name',
        'c.id ASC',
        'asc'
      );

      const countR = await query(`SELECT COUNT(*)::int AS c FROM account_categories c ${where}`, [...params]);
      const total = countR.rows[0].c;

      const dataParams = [...params, limit, offset];
      const limIdx = dataParams.length - 1;
      const offIdx = dataParams.length;
      const r = await query(
        `SELECT c.*
         FROM account_categories c
         ${where}
         ${orderSql}
         LIMIT $${limIdx} OFFSET $${offIdx}`,
        dataParams
      );
      const data = r.rows.map(mapCategoryRow);
      res.status(200).json({
        status: 'SUCCESS',
        message: 'Account categories fetched',
        data,
        count: data.length,
        ...listMeta(total, page, pageSize),
      });
    } catch (e) {
      console.error('account categories list', e);
      res.status(500).json({ status: 'ERROR', message: 'Failed to list account categories' });
    }
  };
}

const listCategories = makeListCategories(null);
const listExpenseCategories = makeListCategories('Expense');

const getCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    const r = await query(
      `SELECT * FROM account_categories WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Category not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: mapCategoryRow(r.rows[0]) });
  } catch (e) {
    console.error('account categories get', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to get category' });
  }
};

function makeCreateCategory(forcedType = null) {
  return async (req, res) => {
    try {
      const category_type = forcedType || normalizeCategoryType(req.body.category_type);
      if (!category_type || !CATEGORY_TYPES.has(category_type)) {
        return res.status(400).json({ status: 'ERROR', message: 'category_type must be Income or Expense' });
      }
      const yearId = await resolveAcademicYearIdForWrite(req);

      const r = await query(
        `INSERT INTO account_categories (
           academic_year_id, category_name, category_type, description, is_active, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, COALESCE($5, true), NOW(), NOW())
         RETURNING *`,
        [
          Number.isFinite(yearId) ? yearId : null,
          String(req.body.category_name).trim(),
          category_type,
          req.body.description != null ? String(req.body.description).trim() : null,
          req.body.is_active,
        ]
      );
      res.status(201).json({ status: 'SUCCESS', message: 'Category created', data: mapCategoryRow(r.rows[0]) });
    } catch (e) {
      if (e.code === '23505') {
        return res.status(409).json({
          status: 'ERROR',
          message: 'A category with this name and type already exists for this academic year',
        });
      }
      if (e.code === '23514') {
        return res.status(400).json({ status: 'ERROR', message: 'Invalid category type' });
      }
      console.error('account categories create', e);
      res.status(500).json({ status: 'ERROR', message: 'Failed to create category' });
    }
  };
}

const createCategory = makeCreateCategory(null);
const createExpenseCategory = makeCreateCategory('Expense');

const updateCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    const existing = await query(
      `SELECT * FROM account_categories WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Category not found' });
    }
    const cur = existing.rows[0];
    const category_name =
      req.body.category_name != null ? String(req.body.category_name).trim() : cur.category_name;
    const nextTypeRaw = req.body.category_type != null ? normalizeCategoryType(req.body.category_type) : cur.category_type;
    if (!nextTypeRaw || !CATEGORY_TYPES.has(nextTypeRaw)) {
      return res.status(400).json({ status: 'ERROR', message: 'category_type must be Income or Expense' });
    }
    const description =
      req.body.description !== undefined
        ? req.body.description != null
          ? String(req.body.description).trim()
          : null
        : cur.description;
    let academic_year_id = cur.academic_year_id;
    if (req.body.academic_year_id !== undefined) {
      if (req.body.academic_year_id != null && req.body.academic_year_id !== '') {
        academic_year_id = parseInt(req.body.academic_year_id, 10);
        if (!Number.isFinite(academic_year_id)) academic_year_id = null;
      } else {
        academic_year_id = null;
      }
    }
    const is_active = req.body.is_active !== undefined ? Boolean(req.body.is_active) : cur.is_active;

    const r = await query(
      `UPDATE account_categories SET
         category_name = $1,
         category_type = $2,
         description = $3,
         academic_year_id = $4,
         is_active = $5,
         updated_at = NOW()
       WHERE id = $6 AND deleted_at IS NULL
       RETURNING *`,
      [category_name, nextTypeRaw, description, academic_year_id, is_active, id]
    );
    res.status(200).json({ status: 'SUCCESS', message: 'Category updated', data: mapCategoryRow(r.rows[0]) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({
        status: 'ERROR',
        message: 'A category with this name and type already exists for this academic year',
      });
    }
    console.error('account categories update', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to update category' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    const existing = await query(
      `SELECT id FROM account_categories WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Category not found' });
    }
    if (await categoryInUse(id)) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Cannot delete category while transactions or expenses reference it',
      });
    }
    const del = await query(
      `UPDATE account_categories
       SET deleted_at = NOW(), updated_at = NOW(), is_active = false
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    res.status(200).json({ status: 'SUCCESS', message: 'Category deleted', data: { id: del.rows[0].id } });
  } catch (e) {
    console.error('account categories delete', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to delete category' });
  }
};

module.exports = {
  listCategories,
  listExpenseCategories,
  getCategory,
  createCategory,
  createExpenseCategory,
  updateCategory,
  deleteCategory,
};
