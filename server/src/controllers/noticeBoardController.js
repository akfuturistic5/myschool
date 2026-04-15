const { query } = require('../config/database');
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

const getAllNotices = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const result = await query(
      `SELECT id, title, content, message_to, created_by, created_at, modified_at
       FROM notice_board
       ORDER BY COALESCE(modified_at, created_at) DESC
       LIMIT $1`,
      [limit]
    );
    const data = result.rows.map((r) => ({
      id: r.id,
      title: sanitizeNoticeTitle(r.title || ''),
      content: sanitizeNoticeContent(r.content || ''),
      messageTo: sanitizeNoticeTitle(r.message_to || 'All'),
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
    const result = await query(
      `SELECT id, title, content, message_to, created_by, created_at, modified_at
       FROM notice_board
       WHERE id = $1`,
      [id]
    );
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
    const userId = req.user?.id;
    const { title, content, message_to = 'All' } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Title is required',
      });
    }
    const safeTitle = sanitizeNoticeTitle(title);
    const safeContent = sanitizeNoticeContent(content);
    const safeTo = sanitizeNoticeTitle(message_to || 'All');
    if (!safeTitle) {
      return res.status(400).json({ status: 'ERROR', message: 'Title is required' });
    }
    const result = await query(
      `INSERT INTO notice_board (title, content, message_to, created_by, created_at, modified_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [safeTitle, safeContent || null, safeTo || 'All', userId || null]
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
    const { title, content, message_to } = req.body;
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
      updates.push(`message_to = $${i++}`);
      values.push(sanitizeNoticeTitle(message_to || 'All') || 'All');
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
