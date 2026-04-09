const { query } = require('../config/database');
const { resolveAcademicYearIdFromQuery } = require('../utils/libraryAcademicYear');
const { parsePagination, listMeta, buildOrderClause } = require('../utils/accountsPagination');

function mapCategoryRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    academic_year_id: row.academic_year_id,
    category_name: row.category_name,
    description: row.description,
    is_active: row.is_active,
    created_at: row.created_at,
    modified_at: row.modified_at,
  };
}

const listCategories = async (req, res) => {
  try {
    const yearId = await resolveAcademicYearIdFromQuery(req);
    const search = req.query.search ? String(req.query.search).trim() : '';
    const activeOnly = String(req.query.is_active || '').toLowerCase() === 'true';
    const { page, pageSize, limit, offset } = parsePagination(req.query);

    const params = [];
    let where = 'WHERE 1=1';
    if (yearId != null) {
      params.push(yearId);
      where += ` AND (c.academic_year_id IS NULL OR c.academic_year_id = $${params.length})`;
    }
    if (activeOnly) {
      where += ` AND COALESCE(c.is_active, true) = true`;
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
        id: 'c.id',
      },
      'category_name',
      'c.id ASC',
      'asc'
    );

    const countR = await query(`SELECT COUNT(*)::int AS c FROM accounts_expense_categories c ${where}`, [...params]);
    const total = countR.rows[0].c;

    const dataParams = [...params, limit, offset];
    const limIdx = dataParams.length - 1;
    const offIdx = dataParams.length;
    const r = await query(
      `SELECT c.*
       FROM accounts_expense_categories c
       ${where}
       ${orderSql}
       LIMIT $${limIdx} OFFSET $${offIdx}`,
      dataParams
    );
    const data = r.rows.map(mapCategoryRow);
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Expense categories fetched',
      data,
      count: data.length,
      ...listMeta(total, page, pageSize),
    });
  } catch (e) {
    console.error('accounts expense categories list', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to list expense categories' });
  }
};

const getCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    const r = await query(`SELECT * FROM accounts_expense_categories WHERE id = $1`, [id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Category not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: mapCategoryRow(r.rows[0]) });
  } catch (e) {
    console.error('accounts expense categories get', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to get category' });
  }
};

const createCategory = async (req, res) => {
  try {
    const yearId =
      req.body.academic_year_id != null && req.body.academic_year_id !== ''
        ? parseInt(req.body.academic_year_id, 10)
        : null;

    const r = await query(
      `INSERT INTO accounts_expense_categories (
         academic_year_id, category_name, description, is_active, created_at, modified_at
       ) VALUES ($1, $2, $3, COALESCE($4, true), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        Number.isFinite(yearId) ? yearId : null,
        String(req.body.category_name).trim(),
        req.body.description != null ? String(req.body.description).trim() : null,
        req.body.is_active,
      ]
    );
    res.status(201).json({ status: 'SUCCESS', message: 'Category created', data: mapCategoryRow(r.rows[0]) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'A category with this name already exists for this academic year' });
    }
    console.error('accounts expense categories create', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to create category' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    const existing = await query(`SELECT * FROM accounts_expense_categories WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Category not found' });
    }
    const cur = existing.rows[0];
    const category_name =
      req.body.category_name != null ? String(req.body.category_name).trim() : cur.category_name;
    const description =
      req.body.description !== undefined
        ? req.body.description != null
          ? String(req.body.description).trim()
          : null
        : cur.description;
    const academic_year_id =
      req.body.academic_year_id !== undefined
        ? req.body.academic_year_id != null && req.body.academic_year_id !== ''
          ? parseInt(req.body.academic_year_id, 10)
          : null
        : cur.academic_year_id;
    const is_active = req.body.is_active !== undefined ? Boolean(req.body.is_active) : cur.is_active;

    const r = await query(
      `UPDATE accounts_expense_categories SET
         category_name = $1,
         description = $2,
         academic_year_id = $3,
         is_active = $4,
         modified_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [category_name, description, academic_year_id, is_active, id]
    );
    res.status(200).json({ status: 'SUCCESS', message: 'Category updated', data: mapCategoryRow(r.rows[0]) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'A category with this name already exists for this academic year' });
    }
    console.error('accounts expense categories update', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to update category' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid id' });
    }
    const use = await query(`SELECT COUNT(*)::int AS c FROM accounts_expenses WHERE category_id = $1`, [id]);
    if (use.rows[0].c > 0) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Cannot delete category while expenses reference it',
      });
    }
    const del = await query(`DELETE FROM accounts_expense_categories WHERE id = $1 RETURNING id`, [id]);
    if (del.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Category not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'Category deleted', data: { id } });
  } catch (e) {
    if (e.code === 'NOT_FOUND') {
      return res.status(404).json({ status: 'ERROR', message: 'Category not found' });
    }
    console.error('accounts expense categories delete', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to delete category' });
  }
};

module.exports = {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};
