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
  if (targets.some((target) => String(target).toLowerCase() === 'all')) {
    return { ok: true, value: 'All' };
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
    const includeExpired = String(req.query.include_expired || '').toLowerCase() === 'true';
    let result;

    if (isNoticeManager(req)) {
      result = await query(
        `SELECT nb.id, nb.title, nb.content, nb.message_to, nb.notice_start_date, nb.notice_end_date, nb.created_by, nb.created_at, nb.updated_at,
                u.first_name AS created_by_first_name, u.last_name AS created_by_last_name, u.username AS created_by_username
         FROM notice_board nb
         LEFT JOIN users u ON u.id = nb.created_by
         ORDER BY COALESCE(nb.updated_at, nb.created_at) DESC
         LIMIT $1`,
        [limit]
      );
    } else {
      const roleName = await resolveCurrentRoleName(req);
      if (includeExpired) {
        result = await query(
          `SELECT nb.id, nb.title, nb.content, nb.message_to, nb.notice_start_date, nb.notice_end_date, nb.created_by, nb.created_at, nb.updated_at,
                  u.first_name AS created_by_first_name, u.last_name AS created_by_last_name, u.username AS created_by_username
           FROM notice_board nb
           LEFT JOIN users u ON u.id = nb.created_by
           WHERE (
             LOWER(COALESCE(NULLIF(TRIM(message_to), ''), 'All')) = 'all'
            OR EXISTS (
                 SELECT 1
                 FROM unnest(string_to_array(COALESCE(message_to, ''), ',')) AS token
                 WHERE LOWER(TRIM(token)) = LOWER($1)
               )
           )
           ORDER BY COALESCE(nb.updated_at, nb.created_at) DESC
           LIMIT $2`,
          [roleName, limit]
        );
      } else {
        result = await query(
          `SELECT nb.id, nb.title, nb.content, nb.message_to, nb.notice_start_date, nb.notice_end_date, nb.created_by, nb.created_at, nb.updated_at,
                  u.first_name AS created_by_first_name, u.last_name AS created_by_last_name, u.username AS created_by_username
           FROM notice_board nb
           LEFT JOIN users u ON u.id = nb.created_by
           WHERE (nb.notice_end_date IS NULL OR nb.notice_end_date >= CURRENT_DATE)
             AND (
               LOWER(COALESCE(NULLIF(TRIM(message_to), ''), 'All')) = 'all'
              OR EXISTS (
                   SELECT 1
                   FROM unnest(string_to_array(COALESCE(message_to, ''), ',')) AS token
                   WHERE LOWER(TRIM(token)) = LOWER($1)
                 )
             )
           ORDER BY COALESCE(nb.updated_at, nb.created_at) DESC
           LIMIT $2`,
          [roleName, limit]
        );
      }
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
      notice_start_date: r.notice_start_date,
      notice_end_date: r.notice_end_date,
      noticeStartDate: formatDate(r.notice_start_date),
      noticeEndDate: formatDate(r.notice_end_date),
      publishOn: formatDate(r.created_at),
      createdBy: r.created_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
      addedOn: formatDate(r.created_at),
      modifiedOn: formatDate(r.updated_at),
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
        `SELECT nb.id, nb.title, nb.content, nb.message_to, nb.notice_start_date, nb.notice_end_date, nb.created_by, nb.created_at, nb.updated_at,
                u.first_name AS created_by_first_name, u.last_name AS created_by_last_name, u.username AS created_by_username
         FROM notice_board nb
         LEFT JOIN users u ON u.id = nb.created_by
         WHERE nb.id = $1`,
        [id]
      );
    } else {
      const roleName = await resolveCurrentRoleName(req);
      result = await query(
        `SELECT nb.id, nb.title, nb.content, nb.message_to, nb.notice_start_date, nb.notice_end_date, nb.created_by, nb.created_at, nb.updated_at,
                u.first_name AS created_by_first_name, u.last_name AS created_by_last_name, u.username AS created_by_username
         FROM notice_board nb
         LEFT JOIN users u ON u.id = nb.created_by
         WHERE nb.id = $1
           AND (nb.notice_end_date IS NULL OR nb.notice_end_date >= CURRENT_DATE)
           AND (
             LOWER(COALESCE(NULLIF(TRIM(message_to), ''), 'All')) = 'all'
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
        notice_start_date: r.notice_start_date,
        notice_end_date: r.notice_end_date,
        noticeStartDate: formatDate(r.notice_start_date),
        noticeEndDate: formatDate(r.notice_end_date),
        publishOn: formatDate(r.created_at),
        createdBy: r.created_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
        addedOn: formatDate(r.created_at),
        modifiedOn: formatDate(r.updated_at),
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
    const { title, content, message_to, notice_start_date, notice_end_date } = req.body;
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
    const safeStartDate = toIsoDateOrNull(notice_start_date);
    const safeEndDate = toIsoDateOrNull(notice_end_date);
    if (notice_start_date !== undefined && notice_start_date !== null && !safeStartDate) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid notice_start_date' });
    }
    if (notice_end_date !== undefined && notice_end_date !== null && !safeEndDate) {
      return res.status(400).json({ status: 'ERROR', message: 'Invalid notice_end_date' });
    }
    if (safeStartDate && safeEndDate && safeEndDate < safeStartDate) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Notice End Date cannot be earlier than Notice Start Date',
      });
    }
    if (!safeTitle) {
      return res.status(400).json({ status: 'ERROR', message: 'Title is required' });
    }
    const result = await query(
      `INSERT INTO notice_board (title, content, message_to, notice_start_date, notice_end_date, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [safeTitle, safeContent || null, safeTo, safeStartDate, safeEndDate, userId]
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
        notice_start_date: r.notice_start_date,
        notice_end_date: r.notice_end_date,
        noticeStartDate: formatDate(r.notice_start_date),
        noticeEndDate: formatDate(r.notice_end_date),
        publishOn: formatDate(r.created_at),
        created_at: r.created_at,
        updated_at: r.updated_at,
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
    const { title, content, message_to, notice_start_date, notice_end_date } = req.body;
    let existingNotice = null;
    if (notice_start_date !== undefined || notice_end_date !== undefined) {
      const existingResult = await query(
        `SELECT id, notice_start_date, notice_end_date
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
    if (notice_start_date !== undefined) {
      const safeStartDate = toIsoDateOrNull(notice_start_date);
      if (notice_start_date !== null && !safeStartDate) {
        return res.status(400).json({ status: 'ERROR', message: 'Invalid notice_start_date' });
      }
      updates.push(`notice_start_date = $${i++}`);
      values.push(safeStartDate);
    }
    if (notice_end_date !== undefined) {
      const safeEndDate = toIsoDateOrNull(notice_end_date);
      if (notice_end_date !== null && !safeEndDate) {
        return res.status(400).json({ status: 'ERROR', message: 'Invalid notice_end_date' });
      }
      updates.push(`notice_end_date = $${i++}`);
      values.push(safeEndDate);
    }

    const effectiveStartDate =
      notice_start_date !== undefined
        ? toIsoDateOrNull(notice_start_date)
        : toIsoDateOrNull(existingNotice?.notice_start_date);
    const effectiveEndDate =
      notice_end_date !== undefined
        ? toIsoDateOrNull(notice_end_date)
        : toIsoDateOrNull(existingNotice?.notice_end_date);
    if (
      effectiveStartDate &&
      effectiveEndDate &&
      effectiveEndDate < effectiveStartDate
    ) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Notice End Date cannot be earlier than Notice Start Date',
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
      `UPDATE notice_board SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
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
        notice_start_date: ur.notice_start_date,
        notice_end_date: ur.notice_end_date,
        noticeStartDate: formatDate(ur.notice_start_date),
        noticeEndDate: formatDate(ur.notice_end_date),
        publishOn: formatDate(ur.created_at),
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
