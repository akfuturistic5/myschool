const { query } = require('../config/database');

const listCategories = async (req, res) => {
  try {
    const r = await query(
      `SELECT id, category_name, description, is_active, created_at, modified_at
       FROM library_categories
       WHERE COALESCE(is_active, true) = true
       ORDER BY category_name ASC`
    );
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Categories fetched',
      data: r.rows,
      count: r.rows.length,
    });
  } catch (e) {
    console.error('library categories list', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to list categories' });
  }
};

const getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await query(
      `SELECT id, category_name, description, is_active, created_at, modified_at
       FROM library_categories WHERE id = $1`,
      [id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Category not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'OK', data: r.rows[0] });
  } catch (e) {
    console.error('library category get', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to get category' });
  }
};

const createCategory = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { category_name, description } = req.body;
    const r = await query(
      `INSERT INTO library_categories (category_name, description, is_active, created_by, created_at, modified_at)
       VALUES ($1, $2, true, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [String(category_name).trim(), description != null ? String(description).trim() : null, userId]
    );
    res.status(201).json({ status: 'SUCCESS', message: 'Category created', data: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Category name already exists' });
    }
    console.error('library category create', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to create category' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const existing = await query(`SELECT * FROM library_categories WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Category not found' });
    }
    const ex = existing.rows[0];
    const category_name =
      body.category_name !== undefined ? String(body.category_name).trim() : ex.category_name;
    const description =
      body.description !== undefined
        ? body.description == null
          ? null
          : String(body.description).trim()
        : ex.description;
    const is_active = typeof body.is_active === 'boolean' ? body.is_active : ex.is_active;

    const r = await query(
      `UPDATE library_categories SET
         category_name = $2,
         description = $3,
         is_active = $4,
         modified_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, category_name, description, is_active]
    );
    res.status(200).json({ status: 'SUCCESS', message: 'Category updated', data: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Category name already exists' });
    }
    console.error('library category update', e);
    res.status(500).json({ status: 'ERROR', message: 'Failed to update category' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const inUse = await query(
      `SELECT 1 FROM library_books WHERE category_id = $1 AND COALESCE(is_active, true) = true LIMIT 1`,
      [id]
    );
    if (inUse.rows.length > 0) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Category is assigned to books; reassign books before deleting',
      });
    }
    const r = await query(`DELETE FROM library_categories WHERE id = $1 RETURNING id`, [id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Category not found' });
    }
    res.status(200).json({ status: 'SUCCESS', message: 'Category deleted', data: { id: Number(id) } });
  } catch (e) {
    console.error('library category delete', e);
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
