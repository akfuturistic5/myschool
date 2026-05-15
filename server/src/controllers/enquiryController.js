const sanitizeHtml = require('sanitize-html');
const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { ADMIN_ROLE_IDS } = require('../config/roles');

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

const parseRoleId = (value) => {
  const n = parseInt(value, 10);
  return Number.isInteger(n) ? n : null;
};

const parseRoleName = (value) => String(value || '').trim().toLowerCase();

/** Admin (1), Administrative (6), or JWT role_name headmaster/administrator — full enquiry follow-up access */
const isFollowUpPrivilegedUser = (req) => {
  const roleId = parseRoleId(req.user?.role_id);
  if (roleId != null && ADMIN_ROLE_IDS.includes(roleId)) return true;
  const name = parseRoleName(req.user?.role_name || req.user?.role);
  return name === 'headmaster' || name === 'administrator' || name === 'admin';
};

const canUserAccessEnquiryForFollowUps = (req, enquiryRow) => {
  if (!enquiryRow) return false;
  if (isFollowUpPrivilegedUser(req)) return true;
  const uid = Number(req.user?.id);
  const owner = Number(enquiryRow.created_by);
  return Number.isFinite(uid) && uid > 0 && Number.isFinite(owner) && owner > 0 && uid === owner;
};

const fetchEnquiryRow = async (enquiryId) => {
  const r = await query(
    `SELECT id, academic_year_id, student_name, mobile_number, created_by, status
     FROM admission_enquiries
     WHERE id = $1
     LIMIT 1`,
    [enquiryId]
  );
  return r.rows[0] || null;
};

const serializeFollowUpRow = (row) => ({
  id: row.id,
  enquiry_id: row.enquiry_id,
  follow_up_date: row.follow_up_date,
  remarks: row.remarks,
  next_follow_up_date: row.next_follow_up_date || null,
  counselor_id: row.counselor_id || null,
  counselor_name: row.counselor_name || null,
  created_by: row.created_by,
  created_by_name: readableCreatorName(row),
  updated_at: row.updated_at,
  created_at: row.created_at,
  enquiry_student_name: row.enquiry_student_name || null,
  enquiry_mobile_number: row.enquiry_mobile_number || null,
  enquiry_status: row.enquiry_status || null,
  enquiry_owner_user_id: row.enquiry_owner_user_id ?? null,
  enquiry_owner_name: row.enquiry_owner_name || null,
});

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

const ALLOWED_ENQUIRY_STATUSES = ['Open', 'In Progress', 'Converted', 'Lost'];

const normalizeEnquiryStatusStrict = (value) => {
  const raw = stripHtml(value || '', 50);
  const found = ALLOWED_ENQUIRY_STATUSES.find((s) => s.toLowerCase() === raw.toLowerCase());
  return found || null;
};

const updateEnquiryStatus = async (req, res) => {
  try {
    const enquiryId = Number(req.params?.id);
    const updatedBy = Number(req.user?.id);
    if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
      return errorResponse(res, 400, 'Invalid enquiry id', 'INVALID_ENQUIRY_ID');
    }
    if (!Number.isFinite(updatedBy) || updatedBy <= 0) {
      return errorResponse(res, 401, 'Not authenticated', 'UNAUTHORIZED');
    }

    const statusVal = normalizeEnquiryStatusStrict(req.body?.status);
    if (!statusVal) {
      return errorResponse(
        res,
        400,
        'Invalid status. Allowed: Open, In Progress, Converted, Lost.',
        'INVALID_ENQUIRY_STATUS'
      );
    }

    const enquiry = await fetchEnquiryRow(enquiryId);
    if (!enquiry) {
      return errorResponse(res, 404, 'Enquiry not found', 'ENQUIRY_NOT_FOUND');
    }
    if (!canUserAccessEnquiryForFollowUps(req, enquiry)) {
      return errorResponse(
        res,
        403,
        'Only the enquiry owner or headmaster/admin can change enquiry status.',
        'ENQUIRY_STATUS_FORBIDDEN'
      );
    }

    const updated = await query(
      `UPDATE admission_enquiries
       SET status = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id`,
      [statusVal, updatedBy, enquiryId]
    );
    if (!updated.rows.length) {
      return errorResponse(res, 404, 'Enquiry not found', 'ENQUIRY_NOT_FOUND');
    }

    return success(res, 200, 'Enquiry status updated successfully', { id: enquiryId, status: statusVal });
  } catch (err) {
    console.error('updateEnquiryStatus error:', err);
    if (String(err?.code) === '23514') {
      return errorResponse(res, 400, 'Invalid status value', 'INVALID_ENQUIRY_STATUS');
    }
    return errorResponse(res, 500, 'Failed to update enquiry status', 'ENQUIRY_STATUS_UPDATE_FAILED');
  }
};

const FOLLOW_UP_SELECT = `
  f.id,
  f.enquiry_id,
  f.follow_up_date,
  f.remarks,
  f.next_follow_up_date,
  f.counselor_id,
  f.created_by,
  f.created_at,
  f.updated_at,
  u.first_name AS creator_first_name,
  u.last_name AS creator_last_name,
  u.username AS creator_username,
  CONCAT_WS(' ', NULLIF(TRIM(cu.first_name), ''), NULLIF(TRIM(cu.last_name), '')) AS counselor_name,
  e.student_name AS enquiry_student_name,
  e.mobile_number AS enquiry_mobile_number,
  e.status AS enquiry_status,
  e.created_by AS enquiry_owner_user_id,
  ou.first_name AS enquiry_owner_first_name,
  ou.last_name AS enquiry_owner_last_name,
  ou.username AS enquiry_owner_username
`;

/** Active staff row — do not use s.is_active (generated column missing on some tenant DBs). */
const STAFF_ACTIVE_FOR_ENQUIRY_SQL =
  "s.deleted_at IS NULL AND LOWER(TRIM(COALESCE(s.status, 'Active'))) = 'active'";

const listFollowUpCounselorOptions = async (req, res) => {
  try {
    const uid = Number(req.user?.id);
    if (!Number.isFinite(uid) || uid <= 0) {
      return errorResponse(res, 401, 'Not authenticated', 'UNAUTHORIZED');
    }
    const result = await query(
      `SELECT s.id,
              s.employee_code,
              TRIM(CONCAT_WS(' ', NULLIF(TRIM(u.first_name), ''), NULLIF(TRIM(u.last_name), ''))) AS display_name,
              u.username,
              NULLIF(TRIM(COALESCE(d.designation_name, '')), '') AS designation_name
       FROM staff s
       INNER JOIN users u ON u.id = s.user_id
       LEFT JOIN designations d ON d.id = s.designation_id
       WHERE ${STAFF_ACTIVE_FOR_ENQUIRY_SQL}
       ORDER BY display_name NULLS LAST, s.id ASC`,
      []
    );
    return success(res, 200, 'Counselor options loaded', result.rows || []);
  } catch (err) {
    console.error('listFollowUpCounselorOptions error:', err);
    return errorResponse(res, 500, 'Failed to load counselor options', 'ENQUIRY_FOLLOW_UP_COUNSELORS_FAILED');
  }
};

const listFollowUpsByEnquiry = async (req, res) => {
  try {
    const enquiryId = Number(req.params?.id);
    if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
      return errorResponse(res, 400, 'Invalid enquiry id', 'INVALID_ENQUIRY_ID');
    }
    const enquiry = await fetchEnquiryRow(enquiryId);
    if (!enquiry) {
      return errorResponse(res, 404, 'Enquiry not found', 'ENQUIRY_NOT_FOUND');
    }
    if (!canUserAccessEnquiryForFollowUps(req, enquiry)) {
      return errorResponse(res, 403, 'You can only view follow-ups for enquiries you created', 'ENQUIRY_FOLLOW_UP_FORBIDDEN');
    }
    const result = await query(
      `SELECT ${FOLLOW_UP_SELECT}
       FROM enquiry_follow_ups f
       INNER JOIN admission_enquiries e ON e.id = f.enquiry_id
       LEFT JOIN users u ON u.id = f.created_by
       LEFT JOIN staff cs ON cs.id = f.counselor_id
       LEFT JOIN users cu ON cu.id = cs.user_id
       LEFT JOIN users ou ON ou.id = e.created_by
       WHERE f.enquiry_id = $1
       ORDER BY f.follow_up_date DESC, f.id DESC`,
      [enquiryId]
    );
    const rows = (result.rows || []).map((row) => {
      const ownerName = readableCreatorName({
        creator_first_name: row.enquiry_owner_first_name,
        creator_last_name: row.enquiry_owner_last_name,
        creator_username: row.enquiry_owner_username,
        created_by: row.enquiry_owner_user_id,
      });
      return serializeFollowUpRow({ ...row, enquiry_owner_name: ownerName });
    });
    return success(res, 200, 'Follow-ups fetched successfully', rows);
  } catch (err) {
    console.error('listFollowUpsByEnquiry error:', err);
    return errorResponse(res, 500, 'Failed to fetch follow-ups', 'ENQUIRY_FOLLOW_UP_LIST_FAILED');
  }
};

const listFollowUpActivity = async (req, res) => {
  try {
    const uid = Number(req.user?.id);
    if (!Number.isFinite(uid) || uid <= 0) {
      return errorResponse(res, 401, 'Not authenticated', 'UNAUTHORIZED');
    }
    const privileged = isFollowUpPrivilegedUser(req);
    const academicYearId = req.query?.academic_year_id ? Number(req.query.academic_year_id) : null;
    const limitRaw = req.query?.limit != null && req.query?.limit !== '' ? Number(req.query.limit) : 50;
    const limit = Number.isInteger(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 50;

    const params = [];
    let whereSql = '';
    if (privileged) {
      whereSql = 'WHERE TRUE';
    } else {
      params.push(uid);
      whereSql = `WHERE (
        e.created_by = $1
        OR f.created_by = $1
        OR f.counselor_id IN (
          SELECT s.id FROM staff s
          WHERE s.user_id = $1 AND ${STAFF_ACTIVE_FOR_ENQUIRY_SQL}
        )
      )`;
    }

    if (Number.isInteger(academicYearId) && academicYearId > 0) {
      params.push(academicYearId);
      whereSql += ` AND e.academic_year_id = $${params.length}`;
    }

    params.push(limit);
    const limitParamIndex = params.length;

    const result = await query(
      `SELECT ${FOLLOW_UP_SELECT}
       FROM enquiry_follow_ups f
       INNER JOIN admission_enquiries e ON e.id = f.enquiry_id
       LEFT JOIN users u ON u.id = f.created_by
       LEFT JOIN staff cs ON cs.id = f.counselor_id
       LEFT JOIN users cu ON cu.id = cs.user_id
       LEFT JOIN users ou ON ou.id = e.created_by
       ${whereSql}
       ORDER BY f.follow_up_date DESC, f.id DESC
       LIMIT $${limitParamIndex}`,
      params
    );

    const rows = (result.rows || []).map((row) => {
      const ownerName = readableCreatorName({
        creator_first_name: row.enquiry_owner_first_name,
        creator_last_name: row.enquiry_owner_last_name,
        creator_username: row.enquiry_owner_username,
        created_by: row.enquiry_owner_user_id,
      });
      return serializeFollowUpRow({ ...row, enquiry_owner_name: ownerName });
    });
    return success(res, 200, 'Follow-up activity fetched successfully', rows);
  } catch (err) {
    console.error('listFollowUpActivity error:', err);
    return errorResponse(res, 500, 'Failed to fetch follow-up activity', 'ENQUIRY_FOLLOW_UP_ACTIVITY_FAILED');
  }
};

const resolveCounselorIdForInsert = async (counselorId) => {
  const cid = Number(counselorId);
  if (!Number.isInteger(cid) || cid <= 0) return null;
  const r = await query(
    `SELECT s.id FROM staff s WHERE s.id = $1 AND ${STAFF_ACTIVE_FOR_ENQUIRY_SQL} LIMIT 1`,
    [cid]
  );
  if (!r.rows.length) return null;
  return cid;
};

const createFollowUpForEnquiry = async (req, res) => {
  try {
    const enquiryId = Number(req.params?.id);
    const createdBy = Number(req.user?.id);
    if (!Number.isInteger(enquiryId) || enquiryId <= 0) {
      return errorResponse(res, 400, 'Invalid enquiry id', 'INVALID_ENQUIRY_ID');
    }
    if (!Number.isFinite(createdBy) || createdBy <= 0) {
      return errorResponse(res, 401, 'Not authenticated', 'UNAUTHORIZED');
    }

    const enquiry = await fetchEnquiryRow(enquiryId);
    if (!enquiry) {
      return errorResponse(res, 404, 'Enquiry not found', 'ENQUIRY_NOT_FOUND');
    }
    if (!canUserAccessEnquiryForFollowUps(req, enquiry)) {
      return errorResponse(res, 403, 'You can only add follow-ups to enquiries you created', 'ENQUIRY_FOLLOW_UP_FORBIDDEN');
    }

    const remarks = stripHtml(req.body?.remarks, 8000);
    if (!remarks) {
      return errorResponse(res, 400, 'Remarks are required', 'ENQUIRY_FOLLOW_UP_REMARKS_REQUIRED');
    }

    let followUpAt = new Date();
    if (req.body?.follow_up_date) {
      const parsed = new Date(String(req.body.follow_up_date).trim());
      if (!Number.isNaN(parsed.getTime())) followUpAt = parsed;
    }

    const nextRaw = req.body?.next_follow_up_date ? String(req.body.next_follow_up_date).trim() : '';
    const nextFollow = /^\d{4}-\d{2}-\d{2}$/.test(nextRaw) ? nextRaw : null;

    const followDay = followUpAt.toISOString().slice(0, 10);
    if (nextFollow && nextFollow < followDay) {
      return errorResponse(
        res,
        400,
        'Next follow-up date cannot be before the follow-up date',
        'ENQUIRY_FOLLOW_UP_DATE_INVALID'
      );
    }

    let counselorId = null;
    if (req.body?.counselor_id != null && req.body?.counselor_id !== '') {
      counselorId = await resolveCounselorIdForInsert(req.body.counselor_id);
      if (counselorId == null) {
        return errorResponse(res, 400, 'Invalid or unauthorized counselor selection', 'ENQUIRY_FOLLOW_UP_COUNSELOR_INVALID');
      }
    }

    const inserted = await query(
      `INSERT INTO enquiry_follow_ups (
         enquiry_id, follow_up_date, remarks, next_follow_up_date, counselor_id,
         created_by, updated_by, updated_at
       )
       VALUES ($1, $2, $3, $4::date, $5, $6, $6, CURRENT_TIMESTAMP)
       RETURNING id`,
      [enquiryId, followUpAt.toISOString(), remarks, nextFollow, counselorId, createdBy]
    );
    const newId = inserted.rows[0]?.id;
    const detail = await query(
      `SELECT ${FOLLOW_UP_SELECT}
       FROM enquiry_follow_ups f
       INNER JOIN admission_enquiries e ON e.id = f.enquiry_id
       LEFT JOIN users u ON u.id = f.created_by
       LEFT JOIN staff cs ON cs.id = f.counselor_id
       LEFT JOIN users cu ON cu.id = cs.user_id
       LEFT JOIN users ou ON ou.id = e.created_by
       WHERE f.id = $1
       LIMIT 1`,
      [newId]
    );
    const row = detail.rows[0];
    const ownerName = readableCreatorName({
      creator_first_name: row.enquiry_owner_first_name,
      creator_last_name: row.enquiry_owner_last_name,
      creator_username: row.enquiry_owner_username,
      created_by: row.enquiry_owner_user_id,
    });
    return success(res, 201, 'Follow-up recorded successfully', serializeFollowUpRow({ ...row, enquiry_owner_name: ownerName }));
  } catch (err) {
    console.error('createFollowUpForEnquiry error:', err);
    if (String(err?.code) === '23514') {
      return errorResponse(
        res,
        400,
        'Next follow-up date must be on or after the follow-up date',
        'ENQUIRY_FOLLOW_UP_CONSTRAINT'
      );
    }
    if (String(err?.code) === '23503') {
      return errorResponse(res, 400, 'Invalid reference', 'INVALID_REFERENCE');
    }
    return errorResponse(res, 500, 'Failed to create follow-up', 'ENQUIRY_FOLLOW_UP_CREATE_FAILED');
  }
};

module.exports = {
  listEnquiries,
  createEnquiry,
  updateEnquiry,
  updateEnquiryStatus,
  deleteEnquiry,
  listFollowUpCounselorOptions,
  listFollowUpsByEnquiry,
  listFollowUpActivity,
  createFollowUpForEnquiry,
};
