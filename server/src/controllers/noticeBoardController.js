const { query } = require('../config/database');
const { NOTICE_MANAGER_ROLES } = require('../config/roles');
const {
  sanitizeNoticeContent,
  sanitizeNoticeTitle,
} = require('../utils/htmlSanitize');

function formatDate(val) {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function toIsoDateOrNull(rawValue) {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    return null;
  }
  const d = new Date(rawValue);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeRoleName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function parseMessageTargets(rawValue) {
  const value = String(rawValue || '');
  const parts = value
    .split(',')
    .map((part) => normalizeRoleName(part))
    .filter(Boolean);
  return Array.from(new Set(parts));
}

async function getActiveRoleNameSet() {
  const roleRows = await query(
    `SELECT role_name
     FROM user_roles
     WHERE is_active = true`
  );
  return new Set(
    (roleRows.rows || [])
      .map((row) => normalizeRoleName(row.role_name))
      .filter(Boolean)
      .map((name) => name.toLowerCase())
  );
}

async function normalizeAndValidateTargets(rawValue) {
  const targets = parseMessageTargets(rawValue);
  if (targets.length === 0) {
    return { ok: false, error: 'At least one role must be selected' };
  }

  const roleSet = await getActiveRoleNameSet();
  const invalid = targets.filter((target) => !roleSet.has(target.toLowerCase()));
  if (invalid.length > 0) {
    return { ok: false, error: `Invalid role(s): ${invalid.join(', ')}` };
  }

  const normalized = targets.join(', ');
  if (normalized.length > 100) {
    return { ok: false, error: 'Selected roles are too long for notice target' };
  }

  return { ok: true, value: normalized };
}

async function resolveCurrentRoleName(req) {
  const roleId = Number(req.user?.role_id);
  if (Number.isFinite(roleId) && roleId > 0) {
    const roleRes = await query(
      `SELECT role_name
       FROM user_roles
       WHERE id = $1
       LIMIT 1`,
      [roleId]
    );
    const roleName = normalizeRoleName(roleRes.rows?.[0]?.role_name);
    if (roleName) return roleName;
  }
  return normalizeRoleName(req.user?.role_name || '');
}

function isNoticeManager(req) {
  const roleId = Number(req.user?.role_id);
  return NOTICE_MANAGER_ROLES.includes(roleId);
}

const getAllNotices = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    let result;

    if (isNoticeManager(req)) {
      result = await query(
        `SELECT nb.id, nb.title, nb.content, nb.message_to, nb.notice_date, nb.publish_on, nb.created_by, nb.created_at, nb.modified_at,
                u.first_name AS created_by_first_name, u.last_name AS created_by_last_name, u.username AS created_by_username
         FROM notice_board nb
         LEFT JOIN users u ON u.id = nb.created_by
         ORDER BY COALESCE(nb.modified_at, nb.created_at) DESC
         LIMIT $1`,
        [limit]
      );
    } else {
      const roleName = await resolveCurrentRoleName(req);
      result = await query(
        `SELECT nb.id, nb.title, nb.content, nb.message_to, nb.notice_date, nb.publish_on, nb.created_by, nb.created_at, nb.modified_at,
                u.first_name AS created_by_first_name, u.last_name AS created_by_last_name, u.username AS created_by_username
         FROM notice_board nb
         LEFT JOIN users u ON u.id = nb.created_by
         WHERE (publish_on IS NULL OR publish_on <= CURRENT_DATE)
           AND (
             COALESCE(NULLIF(TRIM(message_to), ''), 'All') = 'All'
            OR EXISTS (
                 SELECT 1
                 FROM unnest(string_to_array(COALESCE(message_to, ''), ',')) AS token
                 WHERE LOWER(TRIM(token)) = LOWER($1)
               )
           )
         ORDER BY COALESCE(nb.modified_at, nb.created_at) DESC
         LIMIT $2`,
        [roleName, limit]
      );
    }
    const data = result.rows.map((r) => ({
      id: r.id,
      title: sanitizeNoticeTitle(r.title || ''),
      content: sanitizeNoticeContent(r.content || ''),
      messageTo: sanitizeNoticeTitle(r.message_to || 'All'),
      createdByName:
        sanitizeNoticeTitle(
          `${String(r.created_by_first_name || '').trim()} ${String(r.created_by_last_name || '').trim()}`.trim()
        ) || sanitizeNoticeTitle(r.created_by_username || '') || 'System',
      notice_date: r.notice_date,
      publish_on: r.publish_on,
      noticeDate: formatDate(r.notice_date),
      publishOn: formatDate(r.publish_on),
      createdBy: r.created_by,
      created_at: r.created_at,
      modified_at: r.modified_at,
      addedOn: formatDate(r.created_at),
      modifiedOn: formatDate(r.modified_at),
    }));
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Notices fetched successfully',
      data,
      count: data.length,
    });
  } catch (error) {
    console.error('Error fetching notices:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch notices',
    });
  }
};

const getNoticeById = async (req, res) => {
  try {
    const { id } = req.params;
    let result;
    if (isNoticeManager(req)) {
      result = await query(
        `SELECT nb.id, nb.title, nb.content, nb.message_to, nb.notice_date, nb.publish_on, nb.created_by, nb.created_at, nb.modified_at,
                u.first_name AS created_by_first_name, u.last_name AS created_by_last_name, u.username AS created_by_username
         FROM notice_board nb
         LEFT JOIN users u ON u.id = nb.created_by
         WHERE nb.id = $1`,
        [id]
      );
    } else {
      const roleName = await resolveCurrentRoleName(req);
      result = await query(
        `SELECT nb.id, nb.title, nb.content, nb.message_to, nb.notice_date, nb.publish_on, nb.created_by, nb.created_at, nb.modified_at,
                u.first_name AS created_by_first_name, u.last_name AS created_by_last_name, u.username AS created_by_username
         FROM notice_board nb
         LEFT JOIN users u ON u.id = nb.created_by
         WHERE nb.id = $1
           AND (publish_on IS NULL OR publish_on <= CURRENT_DATE)
           AND (
             COALESCE(NULLIF(TRIM(message_to), ''), 'All') = 'All'
             OR EXISTS (
               SELECT 1
               FROM unnest(string_to_array(COALESCE(message_to, ''), ',')) AS token
               WHERE LOWER(TRIM(token)) = LOWER($2)
             )
           )`,
        [id, roleName]
      );
    }
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Notice not found',
      });
    }
    const r = result.rows[0];
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Notice fetched successfully',
      data: {
        id: r.id,
        title: sanitizeNoticeTitle(r.title || ''),
        content: sanitizeNoticeContent(r.content || ''),
        messageTo: sanitizeNoticeTitle(r.message_to || 'All'),
        createdByName:
          sanitizeNoticeTitle(
            `${String(r.created_by_first_name || '').trim()} ${String(r.created_by_last_name || '').trim()}`.trim()
          ) || sanitizeNoticeTitle(r.created_by_username || '') || 'System',
        notice_date: r.notice_date,
        publish_on: r.publish_on,
        noticeDate: formatDate(r.notice_date),
        publishOn: formatDate(r.publish_on),
        createdBy: r.created_by,
        created_at: r.created_at,
        modified_at: r.modified_at,
        addedOn: formatDate(r.created_at),
        modifiedOn: formatDate(r.modified_at),
      },
    });
  } catch (error) {
    console.error('Error fetching notice:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to fetch notice',
    });
  }
};

const createNotice = async (req, res) => {
  try {
    const userId = Number(req.user?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        status: 'ERROR',
        message: 'Authenticated user is required to create notice',
      });
    }
    const { title, content, message_to, notice_date, publish_on } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Title is required',
      });
    }
    const safeTitle = sanitizeNoticeTitle(title);
    const safeContent = sanitizeNoticeContent(content);
    const targetValidation = await normalizeAndValidateTargets(message_to);
    if (!targetValidation.ok) {
      return res.status(400).json({
        status: 'ERROR',
        message: targetValidation.error,
      });
    }

    const safeTo = sanitizeNoticeTitle(targetValidation.value);
    const safeNoticeDate = toIsoDateOrNull(notice_date);
    const safePublishOn = toIsoDateOrNull(publish_on);
    if (notice_date !== undefined && notice_date !== null && !safeNoticeDate) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid notice_date' });
    }
    if (publish_on !== undefined && publish_on !== null && !safePublishOn) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid publish_on' });
    }
    if (safeNoticeDate && safePublishOn && safeNoticeDate < safePublishOn) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Notice Date cannot be earlier than Publish On',
      });
    }
    if (!safeTitle) {
      return res.status(400).json({ status: 'ERROR', message: 'Title is required' });
    }
    const result = await query(
      `INSERT INTO notice_board (title, content, message_to, notice_date, publish_on, created_by, created_at, modified_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [safeTitle, safeContent || null, safeTo, safeNoticeDate, safePublishOn, userId]
    );
    const r = result.rows[0];
    res.status(201).json({
      status: 'SUCCESS',
      message: 'Notice created successfully',
      data: {
        id: r.id,
        title: sanitizeNoticeTitle(r.title || ''),
        content: sanitizeNoticeContent(r.content || ''),
        messageTo: sanitizeNoticeTitle(r.message_to || 'All'),
        notice_date: r.notice_date,
        publish_on: r.publish_on,
        noticeDate: formatDate(r.notice_date),
        publishOn: formatDate(r.publish_on),
        created_at: r.created_at,
        modified_at: r.modified_at,
      },
    });
  } catch (error) {
    console.error('Error creating notice:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to create notice',
    });
  }
};

const updateNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, message_to, notice_date, publish_on } = req.body;
    let existingNotice = null;
    if (notice_date !== undefined || publish_on !== undefined) {
      const existingResult = await query(
        `SELECT id, notice_date, publish_on
         FROM notice_board
         WHERE id = $1
         LIMIT 1`,
        [id]
      );
      if (existingResult.rows.length === 0) {
        return res.status(404).json({
          status: 'ERROR',
          message: 'Notice not found',
        });
      }
      existingNotice = existingResult.rows[0];
    }
    const updates = [];
    const values = [];
    let i = 1;
    if (title !== undefined) {
      updates.push(`title = $${i++}`);
      values.push(sanitizeNoticeTitle(title));
    }
    if (content !== undefined) {
      updates.push(`content = $${i++}`);
      values.push(sanitizeNoticeContent(content) || null);
    }
    if (message_to !== undefined) {
      const targetValidation = await normalizeAndValidateTargets(message_to);
      if (!targetValidation.ok) {
        return res.status(400).json({
          status: 'ERROR',
          message: targetValidation.error,
        });
      }
      updates.push(`message_to = $${i++}`);
      values.push(sanitizeNoticeTitle(targetValidation.value));
    }
    if (notice_date !== undefined) {
      const safeNoticeDate = toIsoDateOrNull(notice_date);
      if (notice_date !== null && !safeNoticeDate) {
        return res.status(400).json({ status: 'ERROR', message: 'Invalid notice_date' });
      }
      updates.push(`notice_date = $${i++}`);
      values.push(safeNoticeDate);
    }
    if (publish_on !== undefined) {
      const safePublishOn = toIsoDateOrNull(publish_on);
      if (publish_on !== null && !safePublishOn) {
        return res.status(400).json({ status: 'ERROR', message: 'Invalid publish_on' });
      }
      updates.push(`publish_on = $${i++}`);
      values.push(safePublishOn);
    }

    const effectiveNoticeDate =
      notice_date !== undefined
        ? toIsoDateOrNull(notice_date)
        : toIsoDateOrNull(existingNotice?.notice_date);
    const effectivePublishOn =
      publish_on !== undefined
        ? toIsoDateOrNull(publish_on)
        : toIsoDateOrNull(existingNotice?.publish_on);
    if (notice_date !== undefined && notice_date !== null && !toIsoDateOrNull(notice_date)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid notice_date' });
    }
    if (publish_on !== undefined && publish_on !== null && !toIsoDateOrNull(publish_on)) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid publish_on' });
    }
    if (
      effectiveNoticeDate &&
      effectivePublishOn &&
      effectiveNoticeDate < effectivePublishOn
    ) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Notice Date cannot be earlier than Publish On',
      });
    }
    if (updates.length === 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'No fields to update',
      });
    }
    values.push(id);
    const result = await query(
      `UPDATE notice_board SET ${updates.join(', ')}, modified_at = CURRENT_TIMESTAMP
       WHERE id = $${i}
       RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Notice not found',
      });
    }
    const ur = result.rows[0];
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Notice updated successfully',
      data: {
        ...ur,
        title: sanitizeNoticeTitle(ur.title || ''),
        content: sanitizeNoticeContent(ur.content || ''),
        message_to: sanitizeNoticeTitle(ur.message_to || 'All'),
        messageTo: sanitizeNoticeTitle(ur.message_to || 'All'),
        noticeDate: formatDate(ur.notice_date),
        publishOn: formatDate(ur.publish_on),
      },
    });
  } catch (error) {
    console.error('Error updating notice:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to update notice',
    });
  }
};

const deleteNotice = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM notice_board WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Notice not found',
      });
    }
    res.status(200).json({
      status: 'SUCCESS',
      message: 'Notice deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting notice:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to delete notice',
    });
  }
};

module.exports = {
  getAllNotices,
  getNoticeById,
  createNotice,
  updateNotice,
  deleteNotice,
};
