const { query } = require('../config/database');

const listPolicies = async (_req, res) => {
  try {
    const r = await query(
      `SELECT id, policy_name, audience_type, max_books_allowed, issue_duration_days,
              max_renewals_allowed, per_day_fine, grace_period_days, max_fine_limit,
              COALESCE(is_active, true) AS is_active, created_at, updated_at
       FROM library_policies
       WHERE deleted_at IS NULL
       ORDER BY COALESCE(is_active, true) DESC, policy_name ASC`
    );
    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Policies fetched',
      data: r.rows,
      count: r.rows.length,
    });
  } catch (e) {
    console.error('library policies list', e);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to list policies' });
  }
};

const getPolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await query(
      `SELECT id, policy_name, audience_type, max_books_allowed, issue_duration_days,
              max_renewals_allowed, per_day_fine, grace_period_days, max_fine_limit,
              COALESCE(is_active, true) AS is_active, created_at, updated_at
       FROM library_policies
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Policy not found' });
    }
    return res.status(200).json({ status: 'SUCCESS', message: 'OK', data: r.rows[0] });
  } catch (e) {
    console.error('library policy get', e);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to get policy' });
  }
};

const createPolicy = async (req, res) => {
  try {
    const body = req.body || {};
    const r = await query(
      `INSERT INTO library_policies (
         policy_name, audience_type, max_books_allowed, issue_duration_days,
         max_renewals_allowed, per_day_fine, grace_period_days, max_fine_limit,
         is_active, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        String(body.policy_name).trim(),
        body.audience_type || 'ALL',
        body.max_books_allowed ?? null,
        body.issue_duration_days,
        body.max_renewals_allowed ?? null,
        body.per_day_fine ?? null,
        body.grace_period_days ?? null,
        body.max_fine_limit ?? null,
        typeof body.is_active === 'boolean' ? body.is_active : true,
      ]
    );
    return res.status(201).json({ status: 'SUCCESS', message: 'Policy created', data: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Policy already exists' });
    }
    console.error('library policy create', e);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to create policy' });
  }
};

const updatePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const existing = await query(
      `SELECT * FROM library_policies WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Policy not found' });
    }
    const ex = existing.rows[0];
    const r = await query(
      `UPDATE library_policies SET
         policy_name = $2,
         audience_type = $3,
         max_books_allowed = $4,
         issue_duration_days = $5,
         max_renewals_allowed = $6,
         per_day_fine = $7,
         grace_period_days = $8,
         max_fine_limit = $9,
         is_active = $10,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id,
        body.policy_name !== undefined ? String(body.policy_name).trim() : ex.policy_name,
        body.audience_type !== undefined ? body.audience_type : ex.audience_type,
        body.max_books_allowed !== undefined ? body.max_books_allowed : ex.max_books_allowed,
        body.issue_duration_days !== undefined ? body.issue_duration_days : ex.issue_duration_days,
        body.max_renewals_allowed !== undefined ? body.max_renewals_allowed : ex.max_renewals_allowed,
        body.per_day_fine !== undefined ? body.per_day_fine : ex.per_day_fine,
        body.grace_period_days !== undefined ? body.grace_period_days : ex.grace_period_days,
        body.max_fine_limit !== undefined ? body.max_fine_limit : ex.max_fine_limit,
        typeof body.is_active === 'boolean' ? body.is_active : ex.is_active,
      ]
    );
    return res.status(200).json({ status: 'SUCCESS', message: 'Policy updated', data: r.rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ status: 'ERROR', message: 'Policy already exists' });
    }
    console.error('library policy update', e);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to update policy' });
  }
};

const deletePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const inUse = await query(
      `SELECT 1 FROM library_book_issues
       WHERE policy_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [id]
    );
    if (inUse.rows.length > 0) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Policy is used in issued books; cannot delete',
      });
    }
    const r = await query(
      `UPDATE library_policies
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Policy not found' });
    }
    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Policy deleted',
      data: { id: Number(id) },
    });
  } catch (e) {
    console.error('library policy delete', e);
    return res.status(500).json({ status: 'ERROR', message: 'Failed to delete policy' });
  }
};

module.exports = {
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
};
