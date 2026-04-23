const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { isSafeFileOrLinkUrl } = require('../utils/safeUrl');
const { getStorageProvider } = require('../storage');
const { deleteFileIfExist } = require('../utils/fileDeleteHelper');
const { getSchoolIdFromRequest } = require('../utils/schoolContext');
const { ROLES } = require('../config/roles');

const EVENT_FOR_ALLOWED = new Set([
  'all',
  'students',
  'staff',
  'staffs',
  'teachers',
  'parents',
  'guardians',
]);

function normalizeNullableText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeIdArray(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (!Array.isArray(value)) return 'INVALID';
  const parsed = value
    .map((v) => parseInt(v, 10))
    .filter((v) => Number.isInteger(v) && v > 0);
  return parsed;
}

function isInvalidDateOrder(startDate, endDate) {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true;
  return end.getTime() < start.getTime();
}

function parsePositiveInt(value) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function ensureEventExists(eventId) {
  const res = await query('SELECT id FROM events WHERE id = $1', [eventId]);
  return res.rows.length > 0;
}

function isMissingEventAttachmentsTable(err) {
  if (!err) return false;
  const msg = String(err.message || '');
  return err.code === '42P01' && /event_attachments/i.test(msg);
}

function eventSelectProjection(alias = 'e') {
  return `${alias}.id, ${alias}.title, ${alias}.description,
          to_char(${alias}.start_date, 'YYYY-MM-DD"T"HH24:MI:SS') AS start_date,
          CASE
            WHEN ${alias}.end_date IS NULL THEN NULL
            ELSE to_char(${alias}.end_date, 'YYYY-MM-DD"T"HH24:MI:SS')
          END AS end_date,
          ${alias}.event_color, ${alias}.is_all_day, ${alias}.location,
          ${alias}.event_category, ${alias}.event_for, ${alias}.created_at,
          ${alias}.target_class_ids, ${alias}.target_section_ids,
          ${alias}.target_department_ids, ${alias}.target_designation_ids,
          ${alias}.attachment_url, ${alias}.created_by`;
}

function getUserRoleId(req) {
  const roleId = parseInt(req?.user?.role_id, 10);
  return Number.isInteger(roleId) ? roleId : null;
}

/**
 * Restrict visible school events by selected audience.
 * Managers (admin/administrative/teacher) can still view all for management screens.
 */
async function appendAudienceVisibilityWhere(where, params, paramCount, req) {
  const roleId = getUserRoleId(req);
  if (roleId == null) return paramCount;

  if (roleId === ROLES.ADMIN || roleId === ROLES.ADMINISTRATIVE || roleId === ROLES.TEACHER) {
    return paramCount;
  }

  if (roleId === ROLES.STUDENT) {
    const studentRes = await query(
      `SELECT class_id, section_id
       FROM students
       WHERE user_id = $1 AND is_active = true
       LIMIT 1`,
      [req.user?.id]
    );
    const classId = studentRes.rows[0]?.class_id || null;
    const sectionId = studentRes.rows[0]?.section_id || null;
    const classIds = classId ? [String(classId)] : [];
    const sectionIds = sectionId ? [String(sectionId)] : [];
    where.push(`LOWER(COALESCE(e.event_for, 'all')) IN ('all','students')`);
    where.push(
      `(e.target_class_ids IS NULL OR jsonb_typeof(e.target_class_ids) <> 'array' OR jsonb_array_length(e.target_class_ids) = 0 OR EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(e.target_class_ids) cls
         WHERE cls = ANY($${paramCount}::text[])
       ))`
    );
    params.push(classIds);
    paramCount += 1;
    where.push(
      `(e.target_section_ids IS NULL OR jsonb_typeof(e.target_section_ids) <> 'array' OR jsonb_array_length(e.target_section_ids) = 0 OR EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(e.target_section_ids) sec
         WHERE sec = ANY($${paramCount}::text[])
       ))`
    );
    params.push(sectionIds);
    paramCount += 1;
    return paramCount;
  }
  if (roleId === ROLES.PARENT) {
    where.push(`LOWER(COALESCE(e.event_for, 'all')) IN ('all','parents')`);
    const linkedRes = await query(
      `SELECT s.class_id, s.section_id
       FROM parents p
       INNER JOIN students s ON s.id = p.student_id
       WHERE p.user_id = $1 AND s.is_active = true`,
      [req.user?.id]
    );
    const classIds = Array.from(
      new Set(
        linkedRes.rows
          .map((r) => r.class_id)
          .filter((v) => Number.isInteger(v) && v > 0)
          .map(String)
      )
    );
    const sectionIds = Array.from(
      new Set(
        linkedRes.rows
          .map((r) => r.section_id)
          .filter((v) => Number.isInteger(v) && v > 0)
          .map(String)
      )
    );
    where.push(
      `(e.target_class_ids IS NULL OR jsonb_typeof(e.target_class_ids) <> 'array' OR jsonb_array_length(e.target_class_ids) = 0 OR EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(e.target_class_ids) cls
         WHERE cls = ANY($${paramCount}::text[])
       ))`
    );
    params.push(classIds);
    paramCount += 1;
    where.push(
      `(e.target_section_ids IS NULL OR jsonb_typeof(e.target_section_ids) <> 'array' OR jsonb_array_length(e.target_section_ids) = 0 OR EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(e.target_section_ids) sec
         WHERE sec = ANY($${paramCount}::text[])
       ))`
    );
    params.push(sectionIds);
    paramCount += 1;
    return paramCount;
  }
  if (roleId === ROLES.GUARDIAN) {
    where.push(`LOWER(COALESCE(e.event_for, 'all')) IN ('all','guardians')`);
    const linkedRes = await query(
      `SELECT s.class_id, s.section_id
       FROM guardians g
       INNER JOIN students s ON s.id = g.student_id
       WHERE g.user_id = $1 AND s.is_active = true`,
      [req.user?.id]
    );
    const classIds = Array.from(
      new Set(
        linkedRes.rows
          .map((r) => r.class_id)
          .filter((v) => Number.isInteger(v) && v > 0)
          .map(String)
      )
    );
    const sectionIds = Array.from(
      new Set(
        linkedRes.rows
          .map((r) => r.section_id)
          .filter((v) => Number.isInteger(v) && v > 0)
          .map(String)
      )
    );
    where.push(
      `(e.target_class_ids IS NULL OR jsonb_typeof(e.target_class_ids) <> 'array' OR jsonb_array_length(e.target_class_ids) = 0 OR EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(e.target_class_ids) cls
         WHERE cls = ANY($${paramCount}::text[])
       ))`
    );
    params.push(classIds);
    paramCount += 1;
    where.push(
      `(e.target_section_ids IS NULL OR jsonb_typeof(e.target_section_ids) <> 'array' OR jsonb_array_length(e.target_section_ids) = 0 OR EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(e.target_section_ids) sec
         WHERE sec = ANY($${paramCount}::text[])
       ))`
    );
    params.push(sectionIds);
    paramCount += 1;
    return paramCount;
  }
  where.push(`LOWER(COALESCE(e.event_for, 'all')) = 'all'`);
  return paramCount;
}

/**
 * Get all school-wide events (for dashboards and Events page)
 * All authenticated users can view
 */
const getAllEvents = async (req, res) => {
  try {
    const {
      limit,
      offset,
      start_date,
      end_date,
      event_category,
      event_for,
      q,
    } = req.query;
    const limitVal = Math.min(parseInt(limit, 10) || 100, 200);
    const offsetVal = Math.max(0, parseInt(offset, 10) || 0);
    const params = [];
    let paramCount = 1;
    const where = [];
    paramCount = await appendAudienceVisibilityWhere(where, params, paramCount, req);

    if (start_date && end_date) {
      // Return rows overlapping selected range
      where.push(
        `(e.start_date <= $${paramCount + 1} AND COALESCE(e.end_date, e.start_date) >= $${paramCount})`
      );
      params.push(start_date, end_date);
      paramCount += 2;
    }
    if (event_category) {
      where.push(`LOWER(COALESCE(e.event_category, '')) = LOWER($${paramCount})`);
      params.push(String(event_category).trim());
      paramCount += 1;
    }
    if (event_for) {
      const ef = String(event_for).trim().toLowerCase();
      if (ef === 'staff') {
        where.push(`LOWER(COALESCE(e.event_for, 'all')) IN ('staff','staffs','teachers')`);
      } else {
        where.push(`LOWER(COALESCE(e.event_for, 'all')) = LOWER($${paramCount})`);
        params.push(ef);
        paramCount += 1;
      }
    }
    if (q) {
      where.push(`(e.title ILIKE $${paramCount} OR COALESCE(e.description, '') ILIKE $${paramCount})`);
      params.push(`%${String(q).trim()}%`);
      paramCount += 1;
    }

    const result = await query(
      `SELECT ${eventSelectProjection('e')},
              u.first_name AS created_by_first_name, u.last_name AS created_by_last_name
       FROM events e
       LEFT JOIN users u ON e.created_by = u.id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY e.start_date DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, limitVal, offsetVal]
    );

    success(res, 200, 'Events fetched successfully', result.rows);
  } catch (err) {
    console.error('Error fetching events:', err);
    errorResponse(res, 500, 'Failed to fetch events');
  }
};

/**
 * Get upcoming events (start_date >= now - event has not started yet)
 */
const getUpcomingEvents = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const where = ['e.start_date >= CURRENT_TIMESTAMP'];
    const params = [];
    let paramCount = 1;
    paramCount = await appendAudienceVisibilityWhere(where, params, paramCount, req);
    params.push(limit);
    const result = await query(
      `SELECT e.id, e.title, e.description,
              to_char(e.start_date, 'YYYY-MM-DD"T"HH24:MI:SS') AS start_date,
              CASE WHEN e.end_date IS NULL THEN NULL ELSE to_char(e.end_date, 'YYYY-MM-DD"T"HH24:MI:SS') END AS end_date,
              e.event_color, e.is_all_day, e.location, e.event_category, e.event_for
       FROM events e
       WHERE ${where.join(' AND ')}
       ORDER BY e.start_date ASC
       LIMIT $${paramCount}`,
      params
    );
    success(res, 200, 'Upcoming events fetched successfully', result.rows);
  } catch (err) {
    console.error('Error fetching upcoming events:', err);
    errorResponse(res, 500, 'Failed to fetch upcoming events');
  }
};

/**
 * Get completed events (COALESCE(end_date, start_date) < now)
 */
const getCompletedEvents = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const where = [`COALESCE(e.end_date, e.start_date) < CURRENT_TIMESTAMP`];
    const params = [];
    let paramCount = 1;
    paramCount = await appendAudienceVisibilityWhere(where, params, paramCount, req);
    params.push(limit);
    const result = await query(
      `SELECT e.id, e.title, e.description,
              to_char(e.start_date, 'YYYY-MM-DD"T"HH24:MI:SS') AS start_date,
              CASE WHEN e.end_date IS NULL THEN NULL ELSE to_char(e.end_date, 'YYYY-MM-DD"T"HH24:MI:SS') END AS end_date,
              e.event_color, e.is_all_day, e.location, e.event_category, e.event_for
       FROM events e
       WHERE ${where.join(' AND ')}
       ORDER BY COALESCE(e.end_date, e.start_date) DESC
       LIMIT $${paramCount}`,
      params
    );
    success(res, 200, 'Completed events fetched successfully', result.rows);
  } catch (err) {
    console.error('Error fetching completed events:', err);
    errorResponse(res, 500, 'Failed to fetch completed events');
  }
};

/**
 * Create new school event
 */
const createEvent = async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      title,
      description,
      start_date,
      end_date,
      event_color = 'bg-primary',
      is_all_day = false,
      location,
      event_category,
      event_for = 'all',
      target_class_ids,
      target_section_ids,
      target_department_ids,
      target_designation_ids,
      attachment_url,
    } = req.body;

    if (!title || !start_date) {
      return errorResponse(res, 400, 'Title and start date are required');
    }
    if (isInvalidDateOrder(start_date, end_date)) {
      return errorResponse(res, 400, 'End date/time must be after start date/time');
    }
    if (event_for !== undefined && !EVENT_FOR_ALLOWED.has(String(event_for).trim().toLowerCase())) {
      return errorResponse(res, 400, 'Invalid event_for value');
    }
    if (!isSafeFileOrLinkUrl(attachment_url)) {
      return errorResponse(res, 400, 'Invalid attachment URL');
    }
    const normalizedClassIds = normalizeIdArray(target_class_ids);
    if (normalizedClassIds === 'INVALID') {
      return errorResponse(res, 400, 'target_class_ids must be an array of IDs');
    }
    const normalizedSectionIds = normalizeIdArray(target_section_ids);
    if (normalizedSectionIds === 'INVALID') {
      return errorResponse(res, 400, 'target_section_ids must be an array of IDs');
    }
    const normalizedDepartmentIds = normalizeIdArray(target_department_ids);
    if (normalizedDepartmentIds === 'INVALID') {
      return errorResponse(res, 400, 'target_department_ids must be an array of IDs');
    }
    const normalizedDesignationIds = normalizeIdArray(target_designation_ids);
    if (normalizedDesignationIds === 'INVALID') {
      return errorResponse(res, 400, 'target_designation_ids must be an array of IDs');
    }

    const result = await query(
      `INSERT INTO events (
        title, description, start_date, end_date, event_color, is_all_day,
        location, event_category, event_for, target_class_ids, target_section_ids,
        target_department_ids, target_designation_ids, attachment_url, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING ${eventSelectProjection('events')}`,
      [
        String(title).trim(),
        normalizeNullableText(description),
        start_date,
        end_date || null,
        event_color,
        is_all_day,
        normalizeNullableText(location),
        normalizeNullableText(event_category),
        String(event_for || 'all').trim().toLowerCase(),
        normalizedClassIds ? JSON.stringify(normalizedClassIds) : null,
        normalizedSectionIds ? JSON.stringify(normalizedSectionIds) : null,
        normalizedDepartmentIds ? JSON.stringify(normalizedDepartmentIds) : null,
        normalizedDesignationIds ? JSON.stringify(normalizedDesignationIds) : null,
        normalizeNullableText(attachment_url),
        userId || null,
      ]
    );

    success(res, 201, 'Event created successfully', result.rows[0]);
  } catch (err) {
    console.error('Error creating event:', err);
    errorResponse(res, 500, 'Failed to create event');
  }
};

/**
 * Update school event
 */
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      start_date,
      end_date,
      event_color,
      is_all_day,
      location,
      event_category,
      event_for,
      target_class_ids,
      target_section_ids,
      target_department_ids,
      target_designation_ids,
      attachment_url,
    } = req.body;
    if (isInvalidDateOrder(start_date, end_date)) {
      return errorResponse(res, 400, 'End date/time must be after start date/time');
    }
    if (event_for !== undefined && !EVENT_FOR_ALLOWED.has(String(event_for).trim().toLowerCase())) {
      return errorResponse(res, 400, 'Invalid event_for value');
    }
    if (!isSafeFileOrLinkUrl(attachment_url)) {
      return errorResponse(res, 400, 'Invalid attachment URL');
    }
    const normalizedClassIds = normalizeIdArray(target_class_ids);
    if (normalizedClassIds === 'INVALID') {
      return errorResponse(res, 400, 'target_class_ids must be an array of IDs');
    }
    const normalizedSectionIds = normalizeIdArray(target_section_ids);
    if (normalizedSectionIds === 'INVALID') {
      return errorResponse(res, 400, 'target_section_ids must be an array of IDs');
    }
    const normalizedDepartmentIds = normalizeIdArray(target_department_ids);
    if (normalizedDepartmentIds === 'INVALID') {
      return errorResponse(res, 400, 'target_department_ids must be an array of IDs');
    }
    const normalizedDesignationIds = normalizeIdArray(target_designation_ids);
    if (normalizedDesignationIds === 'INVALID') {
      return errorResponse(res, 400, 'target_designation_ids must be an array of IDs');
    }

    const existing = await query('SELECT attachment_url FROM events WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Event not found');
    }
    const previousAttachmentUrl = existing.rows[0].attachment_url;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(String(title).trim());
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(normalizeNullableText(description));
    }
    if (start_date !== undefined) {
      updates.push(`start_date = $${paramCount++}`);
      values.push(start_date);
    }
    if (end_date !== undefined) {
      updates.push(`end_date = $${paramCount++}`);
      values.push(end_date);
    }
    if (event_color !== undefined) {
      updates.push(`event_color = $${paramCount++}`);
      values.push(event_color);
    }
    if (is_all_day !== undefined) {
      updates.push(`is_all_day = $${paramCount++}`);
      values.push(is_all_day);
    }
    if (location !== undefined) {
      updates.push(`location = $${paramCount++}`);
      values.push(normalizeNullableText(location));
    }
    if (event_category !== undefined) {
      updates.push(`event_category = $${paramCount++}`);
      values.push(normalizeNullableText(event_category));
    }
    if (event_for !== undefined) {
      updates.push(`event_for = $${paramCount++}`);
      values.push(String(event_for).trim().toLowerCase());
    }
    if (target_class_ids !== undefined) {
      updates.push(`target_class_ids = $${paramCount++}`);
      values.push(normalizedClassIds ? JSON.stringify(normalizedClassIds) : null);
    }
    if (target_section_ids !== undefined) {
      updates.push(`target_section_ids = $${paramCount++}`);
      values.push(normalizedSectionIds ? JSON.stringify(normalizedSectionIds) : null);
    }
    if (target_department_ids !== undefined) {
      updates.push(`target_department_ids = $${paramCount++}`);
      values.push(normalizedDepartmentIds ? JSON.stringify(normalizedDepartmentIds) : null);
    }
    if (target_designation_ids !== undefined) {
      updates.push(`target_designation_ids = $${paramCount++}`);
      values.push(normalizedDesignationIds ? JSON.stringify(normalizedDesignationIds) : null);
    }
    if (attachment_url !== undefined) {
      updates.push(`attachment_url = $${paramCount++}`);
      values.push(normalizeNullableText(attachment_url));
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    values.push(id);
    const result = await query(
      `UPDATE events
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING ${eventSelectProjection('events')}`,
      values
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Event not found');
    }

    success(res, 200, 'Event updated successfully', result.rows[0]);

    if (attachment_url !== undefined && previousAttachmentUrl && previousAttachmentUrl !== attachment_url) {
      await deleteFileIfExist(previousAttachmentUrl);
    }
  } catch (err) {
    console.error('Error updating event:', err);
    errorResponse(res, 500, 'Failed to update event');
  }
};

/**
 * Delete school event
 */
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch attachment_url and any event_attachments before deleting
    const existing = await query('SELECT attachment_url FROM events WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Event not found');
    }
    const eventAttachmentUrl = existing.rows[0].attachment_url;

    let attachments = [];
    try {
      const attRes = await query('SELECT relative_path, file_url FROM event_attachments WHERE event_id = $1', [id]);
      attachments = attRes.rows;
    } catch (e) {
      // event_attachments might not exist yet
    }

    await query('DELETE FROM events WHERE id = $1', [id]);

    // Cleanup physical files
    if (eventAttachmentUrl) {
      await deleteFileIfExist(eventAttachmentUrl);
    }
    for (const att of attachments) {
      if (att.relative_path) {
        try {
          await getStorageProvider().delete(att.relative_path);
        } catch (e) {
          console.warn('Failed to delete event attachment file:', e.message);
        }
      } else if (att.file_url) {
        await deleteFileIfExist(att.file_url);
      }
    }

    success(res, 200, 'Event deleted successfully');
  } catch (err) {
    console.error('Error deleting event:', err);
    errorResponse(res, 500, 'Failed to delete event');
  }
};

module.exports = {
  getAllEvents,
  getUpcomingEvents,
  getCompletedEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventAttachments: async (req, res) => {
    try {
      const eventId = parsePositiveInt(req.params.id);
      if (!eventId) return errorResponse(res, 400, 'Invalid event id');
      if (!(await ensureEventExists(eventId))) {
        return errorResponse(res, 404, 'Event not found');
      }
      try {
        const result = await query(
          `SELECT ea.id, ea.event_id, ea.file_url, ea.file_name, ea.file_type, ea.file_size,
                  ea.relative_path, ea.uploaded_by, ea.created_at,
                  u.first_name AS uploaded_by_first_name, u.last_name AS uploaded_by_last_name
           FROM event_attachments ea
           LEFT JOIN users u ON ea.uploaded_by = u.id
           WHERE ea.event_id = $1
           ORDER BY ea.created_at DESC`,
          [eventId]
        );
        return success(res, 200, 'Event attachments fetched successfully', result.rows);
      } catch (tableErr) {
        if (isMissingEventAttachmentsTable(tableErr)) {
          return success(res, 200, 'Event attachments not configured yet', []);
        }
        throw tableErr;
      }
    } catch (err) {
      console.error('Error fetching event attachments:', err);
      return errorResponse(res, 500, 'Failed to fetch event attachments');
    }
  },
  uploadEventAttachment: async (req, res) => {
    try {
      const eventId = parsePositiveInt(req.params.id);
      if (!eventId) return errorResponse(res, 400, 'Invalid event id');
      if (!(await ensureEventExists(eventId))) {
        return errorResponse(res, 404, 'Event not found');
      }
      const schoolId = getSchoolIdFromRequest(req);
      if (!schoolId) return errorResponse(res, 401, 'School context required');
      if (!req.file || !req.file.buffer) {
        return errorResponse(res, 400, 'Missing file field');
      }

      const provider = getStorageProvider();
      const { relativePath } = await provider.upload(
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
        },
        schoolId,
        'documents'
      );
      const parts = relativePath.split('/');
      const schoolKey = parts[0];
      const fileName = parts[parts.length - 1];
      const fileUrl = `/api/storage/files/${schoolKey}/documents/${encodeURIComponent(fileName)}`;

      try {
        const insert = await query(
          `INSERT INTO event_attachments (
            event_id, file_url, file_name, file_type, file_size, relative_path, uploaded_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, event_id, file_url, file_name, file_type, file_size, relative_path, uploaded_by, created_at`,
          [
            eventId,
            fileUrl,
            String(req.file.originalname || fileName).trim().slice(0, 255),
            req.file.mimetype || null,
            Number.isFinite(req.file.size) ? req.file.size : null,
            relativePath,
            req.user?.id || null,
          ]
        );
        return success(res, 201, 'Event attachment uploaded successfully', insert.rows[0]);
      } catch (tableErr) {
        if (!isMissingEventAttachmentsTable(tableErr)) {
          throw tableErr;
        }
        // Legacy-safe fallback: keep upload usable even before attachment metadata migration.
        await query(
          `UPDATE events
           SET attachment_url = COALESCE(NULLIF(TRIM(attachment_url), ''), $1)
           WHERE id = $2`,
          [fileUrl, eventId]
        );
        return success(res, 201, 'Attachment uploaded successfully', {
          id: null,
          event_id: eventId,
          file_url: fileUrl,
          file_name: String(req.file.originalname || fileName).trim().slice(0, 255),
          file_type: req.file.mimetype || null,
          file_size: Number.isFinite(req.file.size) ? req.file.size : null,
          relative_path: relativePath,
          uploaded_by: req.user?.id || null,
          created_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Error uploading event attachment:', err);
      return errorResponse(res, 500, 'Failed to upload event attachment');
    }
  },
  deleteEventAttachment: async (req, res) => {
    try {
      const eventId = parsePositiveInt(req.params.id);
      const attachmentId = parsePositiveInt(req.params.attachmentId);
      if (!eventId || !attachmentId) {
        return errorResponse(res, 400, 'Invalid ids');
      }
      const existing = await query(
        `SELECT id, relative_path FROM event_attachments WHERE id = $1 AND event_id = $2`,
        [attachmentId, eventId]
      );
      if (existing.rows.length === 0) {
        return errorResponse(res, 404, 'Attachment not found');
      }

      await query('DELETE FROM event_attachments WHERE id = $1 AND event_id = $2', [
        attachmentId,
        eventId,
      ]);

      try {
        const provider = getStorageProvider();
        if (existing.rows[0].relative_path) {
          await provider.delete(existing.rows[0].relative_path);
        }
      } catch (storageErr) {
        // Metadata is already deleted; storage cleanup failure should not leak internals.
        console.warn('Attachment storage cleanup failed:', storageErr.message);
      }

      return success(res, 200, 'Event attachment deleted successfully', { id: attachmentId });
    } catch (err) {
      console.error('Error deleting event attachment:', err);
      return errorResponse(res, 500, 'Failed to delete event attachment');
    }
  },
};
