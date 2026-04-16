const sanitizeHtml = require('sanitize-html');
const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

const stripHtml = (value, maxLen) =>
  sanitizeHtml(String(value || ''), { allowedTags: [], allowedAttributes: {} }).trim().slice(0, maxLen);

const normalizeStatus = (value) => {
  const normalized = stripHtml(value || 'open', 20).toLowerCase();
  if (normalized === 'in_progress' || normalized === 'closed') return normalized;
  return 'open';
};

const readableCreatorName = (row) => {
  const first = String(row?.creator_first_name || '').trim();
  const last = String(row?.creator_last_name || '').trim();
  const full = `${first} ${last}`.trim();
  return full || String(row?.creator_username || '').trim() || `User ${row?.created_by || ''}`.trim();
};

const serializeEnquiry = (row) => ({
  id: row.id,
  enquiry_date: row.enquiry_date,
  name: row.name,
  mobile_number: row.mobile_number,
  address: row.address || null,
  enquiry_about: row.enquiry_about,
  description: row.description || null,
  email: row.email || null,
  status: row.status,
  academic_year_id: row.academic_year_id,
  created_by: row.created_by,
  created_by_name: readableCreatorName(row),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const listEnquiries = async (req, res) => {
  try {
    const { academic_year_id, status, search, enquiry_date, from_date, to_date, month, added_by } = req.query || {};
    const params = [];
    const where = [];

    if (academic_year_id) {
      params.push(Number(academic_year_id));
      where.push(`e.academic_year_id = $${params.length}`);
    }
    if (status) {
      params.push(String(status).trim().toLowerCase());
      where.push(`e.status = $${params.length}`);
    }
    if (search && String(search).trim() !== '') {
      params.push(`%${String(search).trim()}%`);
      where.push(`(
        e.name ILIKE $${params.length}
        OR e.mobile_number ILIKE $${params.length}
        OR e.enquiry_about ILIKE $${params.length}
      )`);
    }
    if (enquiry_date) {
      params.push(String(enquiry_date).trim());
      where.push(`e.enquiry_date = $${params.length}::date`);
    }
    if (from_date) {
      params.push(String(from_date).trim());
      where.push(`e.enquiry_date >= $${params.length}::date`);
    }
    if (to_date) {
      params.push(String(to_date).trim());
      where.push(`e.enquiry_date <= $${params.length}::date`);
    }
    if (month) {
      params.push(`${String(month).trim()}-01`);
      where.push(`date_trunc('month', e.enquiry_date) = date_trunc('month', $${params.length}::date)`);
    }

    const addedByNormalized = String(added_by || 'all').trim().toLowerCase();
    if (addedByNormalized === 'me') {
      const currentUserId = Number(req.user?.id);
      if (Number.isFinite(currentUserId) && currentUserId > 0) {
        params.push(currentUserId);
        where.push(`e.created_by = $${params.length}`);
      }
    } else if (
      addedByNormalized === 'headmaster' ||
      addedByNormalized === 'administrative' ||
      addedByNormalized === 'teacher'
    ) {
      params.push(addedByNormalized);
      where.push(`LOWER(TRIM(COALESCE(ur.role_name, ''))) = $${params.length}`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const result = await query(
      `SELECT
         e.*,
         u.first_name AS creator_first_name,
         u.last_name AS creator_last_name,
         u.username AS creator_username,
         ur.role_name AS creator_role_name
       FROM enquiries e
       INNER JOIN users u ON u.id = e.created_by
       LEFT JOIN user_roles ur ON ur.id = u.role_id
       ${whereClause}
       ORDER BY e.enquiry_date DESC, e.id DESC`,
      params
    );

    return success(
      res,
      200,
      'Enquiries fetched successfully',
      (result.rows || []).map(serializeEnquiry)
    );
  } catch (err) {
    console.error('listEnquiries error:', err);
    return errorResponse(res, 500, 'Failed to fetch enquiries', 'ENQUIRY_LIST_FAILED');
  }
};

const createEnquiry = async (req, res) => {
  try {
    const createdBy = Number(req.user?.id);
    if (!Number.isFinite(createdBy) || createdBy <= 0) {
      return errorResponse(res, 401, 'Not authenticated', 'UNAUTHORIZED');
    }

    const payload = {
      enquiry_date: stripHtml(req.body?.enquiry_date, 10),
      name: stripHtml(req.body?.name, 160),
      mobile_number: stripHtml(req.body?.mobile_number, 20),
      address: stripHtml(req.body?.address, 500) || null,
      enquiry_about: stripHtml(req.body?.enquiry_about, 200),
      description: stripHtml(req.body?.description, 2000) || null,
      email: stripHtml(req.body?.email, 254).toLowerCase() || null,
      status: normalizeStatus(req.body?.status),
      academic_year_id: Number(req.body?.academic_year_id),
    };

    const inserted = await query(
      `INSERT INTO enquiries (
         enquiry_date, name, mobile_number, address, enquiry_about, description,
         email, status, academic_year_id, created_by, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        payload.enquiry_date,
        payload.name,
        payload.mobile_number,
        payload.address,
        payload.enquiry_about,
        payload.description,
        payload.email,
        payload.status,
        payload.academic_year_id,
        createdBy,
      ]
    );

    const row = inserted.rows[0];
    const withCreator = await query(
      `SELECT
         e.*,
         u.first_name AS creator_first_name,
         u.last_name AS creator_last_name,
         u.username AS creator_username
       FROM enquiries e
       INNER JOIN users u ON u.id = e.created_by
       WHERE e.id = $1
       LIMIT 1`,
      [row.id]
    );

    return success(res, 201, 'Enquiry created successfully', serializeEnquiry(withCreator.rows[0]));
  } catch (err) {
    console.error('createEnquiry error:', err);
    if (String(err?.code) === '23503') {
      return errorResponse(res, 400, 'Invalid academic year selected', 'INVALID_ACADEMIC_YEAR');
    }
    return errorResponse(res, 500, 'Failed to create enquiry', 'ENQUIRY_CREATE_FAILED');
  }
};

module.exports = {
  listEnquiries,
  createEnquiry,
};
