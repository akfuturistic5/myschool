const sanitizeHtml = require('sanitize-html');
const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

const stripHtml = (value, maxLen) =>
  sanitizeHtml(String(value || ''), { allowedTags: [], allowedAttributes: {} }).trim().slice(0, maxLen);

const normalizeStatus = (value) => {
  const normalized = stripHtml(value || '', 50);
  return normalized || 'Open';
};

const normalizeGender = (value) => {
  const normalized = stripHtml(value || '', 10).toLowerCase();
  if (!normalized) return null;
  if (normalized === 'male') return 'Male';
  if (normalized === 'female') return 'Female';
  return 'Other';
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
  enquiry_type: row.enquiry_type || null,
  student_name: row.student_name,
  gender: row.gender || null,
  date_of_birth: row.date_of_birth || null,
  parent_name: row.parent_name || null,
  mobile_number: row.mobile_number,
  email: row.email || null,
  address: row.address || null,
  previous_school: row.previous_school || null,
  target_class_id: row.target_class_id || null,
  target_class_name: row.target_class_name || null,
  source: row.source || null,
  status: row.status,
  description: row.description || null,
  academic_year_id: row.academic_year_id,
  created_by: row.created_by,
  created_by_name: readableCreatorName(row),
  created_at: row.created_at,
  updated_at: row.updated_at,
  // Backward-compatible aliases
  name: row.student_name,
  enquiry_about: row.enquiry_type || null,
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
      params.push(normalizeStatus(status));
      where.push(`e.status = $${params.length}`);
    }
    if (search && String(search).trim() !== '') {
      params.push(`%${String(search).trim()}%`);
      where.push(`(
        e.student_name ILIKE $${params.length}
        OR e.mobile_number ILIKE $${params.length}
        OR COALESCE(e.parent_name, '') ILIKE $${params.length}
        OR COALESCE(e.enquiry_type, '') ILIKE $${params.length}
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
         c.class_name AS target_class_name,
         u.first_name AS creator_first_name,
         u.last_name AS creator_last_name,
         u.username AS creator_username,
         ur.role_name AS creator_role_name
       FROM admission_enquiries e
       LEFT JOIN classes c ON c.id = e.target_class_id
       LEFT JOIN users u ON u.id = e.created_by
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
      enquiry_type: stripHtml(req.body?.enquiry_type, 30) || null,
      student_name: stripHtml(req.body?.student_name, 200),
      gender: normalizeGender(req.body?.gender),
      date_of_birth: stripHtml(req.body?.date_of_birth, 10) || null,
      parent_name: stripHtml(req.body?.parent_name, 200) || null,
      mobile_number: stripHtml(req.body?.mobile_number, 20),
      email: stripHtml(req.body?.email, 254).toLowerCase() || null,
      address: stripHtml(req.body?.address, 500) || null,
      previous_school: stripHtml(req.body?.previous_school, 200) || null,
      target_class_id: req.body?.target_class_id ? Number(req.body?.target_class_id) : null,
      source: stripHtml(req.body?.source, 50) || null,
      status: normalizeStatus(req.body?.status),
      description: stripHtml(req.body?.description, 2000) || null,
      academic_year_id: Number(req.body?.academic_year_id),
    };

    const inserted = await query(
      `INSERT INTO admission_enquiries (
         academic_year_id, enquiry_date, enquiry_type, student_name, gender, date_of_birth,
         parent_name, mobile_number, email, address, previous_school, target_class_id,
         source, status, description, created_by, updated_by, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        payload.academic_year_id,
        payload.enquiry_date,
        payload.enquiry_type,
        payload.student_name,
        payload.gender,
        payload.date_of_birth,
        payload.parent_name,
        payload.mobile_number,
        payload.email,
        payload.address,
        payload.previous_school,
        payload.target_class_id,
        payload.source,
        payload.status,
        payload.description,
        createdBy,
        createdBy,
      ]
    );

    const row = inserted.rows[0];
    const withCreator = await query(
      `SELECT
         e.*,
         c.class_name AS target_class_name,
         u.first_name AS creator_first_name,
         u.last_name AS creator_last_name,
         u.username AS creator_username
       FROM admission_enquiries e
       LEFT JOIN classes c ON c.id = e.target_class_id
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.id = $1
       LIMIT 1`,
      [row.id]
    );

    return success(res, 201, 'Enquiry created successfully', serializeEnquiry(withCreator.rows[0]));
  } catch (err) {
    console.error('createEnquiry error:', err);
    if (String(err?.code) === '23503') {
      return errorResponse(res, 400, 'Invalid class or academic year selected', 'INVALID_REFERENCE');
    }
    return errorResponse(res, 500, 'Failed to create enquiry', 'ENQUIRY_CREATE_FAILED');
  }
};

const updateEnquiry = async (req, res) => {
  try {
    const enquiryId = Number(req.params?.id);
    const updatedBy = Number(req.user?.id);
    if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
      return errorResponse(res, 400, 'Invalid enquiry id', 'INVALID_ENQUIRY_ID');
    }
    if (!Number.isFinite(updatedBy) || updatedBy <= 0) {
      return errorResponse(res, 401, 'Not authenticated', 'UNAUTHORIZED');
    }

    const payload = {
      enquiry_date: stripHtml(req.body?.enquiry_date, 10),
      enquiry_type: stripHtml(req.body?.enquiry_type, 30) || null,
      student_name: stripHtml(req.body?.student_name, 200),
      gender: normalizeGender(req.body?.gender),
      date_of_birth: stripHtml(req.body?.date_of_birth, 10) || null,
      parent_name: stripHtml(req.body?.parent_name, 200) || null,
      mobile_number: stripHtml(req.body?.mobile_number, 20),
      email: stripHtml(req.body?.email, 254).toLowerCase() || null,
      address: stripHtml(req.body?.address, 500) || null,
      previous_school: stripHtml(req.body?.previous_school, 200) || null,
      target_class_id: req.body?.target_class_id ? Number(req.body?.target_class_id) : null,
      source: stripHtml(req.body?.source, 50) || null,
      status: normalizeStatus(req.body?.status),
      description: stripHtml(req.body?.description, 2000) || null,
      academic_year_id: Number(req.body?.academic_year_id),
    };

    const updated = await query(
      `UPDATE admission_enquiries
       SET academic_year_id = $1,
           enquiry_date = $2,
           enquiry_type = $3,
           student_name = $4,
           gender = $5,
           date_of_birth = $6,
           parent_name = $7,
           mobile_number = $8,
           email = $9,
           address = $10,
           previous_school = $11,
           target_class_id = $12,
           source = $13,
           status = $14,
           description = $15,
           updated_by = $16,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $17
       RETURNING id`,
      [
        payload.academic_year_id,
        payload.enquiry_date,
        payload.enquiry_type,
        payload.student_name,
        payload.gender,
        payload.date_of_birth,
        payload.parent_name,
        payload.mobile_number,
        payload.email,
        payload.address,
        payload.previous_school,
        payload.target_class_id,
        payload.source,
        payload.status,
        payload.description,
        updatedBy,
        enquiryId,
      ]
    );
    if (!updated.rows.length) {
      return errorResponse(res, 404, 'Enquiry not found', 'ENQUIRY_NOT_FOUND');
    }

    const withCreator = await query(
      `SELECT
         e.*,
         c.class_name AS target_class_name,
         u.first_name AS creator_first_name,
         u.last_name AS creator_last_name,
         u.username AS creator_username
       FROM admission_enquiries e
       LEFT JOIN classes c ON c.id = e.target_class_id
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.id = $1
       LIMIT 1`,
      [enquiryId]
    );

    return success(res, 200, 'Enquiry updated successfully', serializeEnquiry(withCreator.rows[0]));
  } catch (err) {
    console.error('updateEnquiry error:', err);
    if (String(err?.code) === '23503') {
      return errorResponse(res, 400, 'Invalid class or academic year selected', 'INVALID_REFERENCE');
    }
    return errorResponse(res, 500, 'Failed to update enquiry', 'ENQUIRY_UPDATE_FAILED');
  }
};

const deleteEnquiry = async (req, res) => {
  try {
    const enquiryId = Number(req.params?.id);
    if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
      return errorResponse(res, 400, 'Invalid enquiry id', 'INVALID_ENQUIRY_ID');
    }

    const deleted = await query(
      `DELETE FROM admission_enquiries
       WHERE id = $1
       RETURNING id`,
      [enquiryId]
    );
    if (!deleted.rows.length) {
      return errorResponse(res, 404, 'Enquiry not found', 'ENQUIRY_NOT_FOUND');
    }

    return success(res, 200, 'Enquiry deleted successfully', { id: enquiryId });
  } catch (err) {
    console.error('deleteEnquiry error:', err);
    return errorResponse(res, 500, 'Failed to delete enquiry', 'ENQUIRY_DELETE_FAILED');
  }
};

module.exports = {
  listEnquiries,
  createEnquiry,
  updateEnquiry,
  deleteEnquiry,
};
