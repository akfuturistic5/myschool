const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { sanitizeChatText } = require('../utils/htmlSanitize');
const { isSafeFileOrLinkUrl } = require('../utils/safeUrl');

// Get all chats for current user (both sent and received - so recipient sees chats too)
const getAllChats = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    
    // Include conversations (messages deleted from DB on clear/delete)
    const result = await query(`
      WITH conv AS (
        SELECT c.recipient_id as other_user_id, c.id, c.user_id, c.recipient_id,
          c.message as last_message, c.is_read, c.is_pinned, c.message_type, c.file_url,
          c.created_at as last_message_time, c.updated_at
        FROM chats c WHERE c.user_id = $1
        UNION ALL
        SELECT c.user_id as other_user_id, c.id, c.user_id, c.recipient_id,
          c.message as last_message, c.is_read, c.is_pinned, c.message_type, c.file_url,
          c.created_at as last_message_time, c.updated_at
        FROM chats c WHERE c.recipient_id = $1
      )
      SELECT DISTINCT ON (sub.other_user_id)
        sub.id, sub.user_id, sub.other_user_id as recipient_id, sub.last_message, sub.is_read, sub.is_pinned,
        sub.message_type, sub.file_url, sub.last_message_time, sub.updated_at,
        u.username as recipient_username, u.first_name as recipient_first_name,
        u.last_name as recipient_last_name, u.email as recipient_email, u.phone as recipient_phone,
        NULL as recipient_photo_url,
        false as is_online,
        sub.unread_count
      FROM (
        SELECT *, COUNT(*) FILTER (WHERE recipient_id = $1 AND is_read = false) OVER (PARTITION BY other_user_id)::int as unread_count
        FROM conv
      ) sub
      LEFT JOIN users u ON u.id = sub.other_user_id
      WHERE NOT EXISTS (SELECT 1 FROM blocked_users bu WHERE bu.user_id = $1 AND bu.blocked_user_id = sub.other_user_id)
      ORDER BY sub.other_user_id, sub.last_message_time DESC
    `, [userId]);
    
    const rows = (result.rows || []).map((row) => ({
      ...row,
      last_message: sanitizeChatText(row.last_message),
    }));
    success(res, 200, 'Chats fetched successfully', rows);
  } catch (error) {
    console.error('Error fetching chats:', error);
    errorResponse(res, 500, 'Failed to fetch chats');
  }
};

// Get chat by ID
const getChatById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const result = await query(`
      SELECT 
        c.*,
        u.username as recipient_username,
        u.first_name as recipient_first_name,
        u.last_name as recipient_last_name,
        NULL as recipient_photo_url
      FROM chats c
      LEFT JOIN users u ON c.recipient_id = u.id
      WHERE c.id = $1 AND c.user_id = $2
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Chat not found');
    }

    const row = result.rows[0];
    success(res, 200, 'Chat fetched successfully', {
      ...row,
      message: sanitizeChatText(row.message),
      file_url: row.file_url && isSafeFileOrLinkUrl(row.file_url) ? row.file_url : null,
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    errorResponse(res, 500, 'Failed to fetch chat');
  }
};

// Get all messages with a specific recipient (both sent and received)
const getMessagesByRecipient = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const { recipientId } = req.params;

    const result = await query(`
      SELECT 
        c.id,
        c.user_id,
        c.recipient_id,
        c.message,
        c.message_type,
        c.file_url,
        c.is_read,
        c.is_pinned,
        c.created_at,
        c.updated_at,
        u.username as sender_username,
        u.first_name as sender_first_name,
        u.last_name as sender_last_name,
        NULL as sender_photo_url
      FROM chats c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE (c.user_id = $1 AND c.recipient_id = $2)
         OR (c.user_id = $2 AND c.recipient_id = $1)
      ORDER BY c.created_at ASC
    `, [userId, recipientId]);

    const rows = (result.rows || []).map((row) => ({
      ...row,
      message: sanitizeChatText(row.message),
    }));
    success(res, 200, 'Messages fetched successfully', rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    errorResponse(res, 500, 'Failed to fetch messages');
  }
};

// Get shared media (images, videos, files) for a conversation
const getSharedMedia = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const { recipientId } = req.params;
    const { type } = req.query; // optional: image, video, file

    const types = type && ['image', 'video', 'file'].includes(type)
      ? [type]
      : ['image', 'video', 'file'];

    const result = await query(`
      SELECT c.id, c.message_type, c.file_url, c.created_at
      FROM chats c
      WHERE ((c.user_id = $1 AND c.recipient_id = $2)
         OR (c.user_id = $2 AND c.recipient_id = $1))
         AND c.message_type = ANY($3)
         AND c.file_url IS NOT NULL AND c.file_url != ''
      ORDER BY c.created_at DESC
    `, [userId, recipientId, types]);

    const rows = (result.rows || []).map((row) => ({
      ...row,
      file_url: isSafeFileOrLinkUrl(row.file_url) ? row.file_url : null,
    }));
    success(res, 200, 'Shared media fetched', rows);
  } catch (error) {
    console.error('Error fetching shared media:', error);
    errorResponse(res, 500, 'Failed to fetch shared media');
  }
};

// Get conversations (grouped by recipient)
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await query(`
      SELECT DISTINCT ON (c.recipient_id)
        c.id,
        c.recipient_id,
        c.message,
        c.is_read,
        c.is_pinned,
        c.created_at,
        u.username as recipient_username,
        u.first_name as recipient_first_name,
        u.last_name as recipient_last_name,
        NULL as recipient_photo_url,
        COUNT(*) OVER (PARTITION BY c.recipient_id) as unread_count
      FROM chats c
      LEFT JOIN users u ON c.recipient_id = u.id
      WHERE c.user_id = $1
      ORDER BY c.recipient_id, c.created_at DESC
    `, [userId]);
    
    const rows = (result.rows || []).map((row) => ({
      ...row,
      message: sanitizeChatText(row.message),
    }));
    success(res, 200, 'Conversations fetched successfully', rows);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    errorResponse(res, 500, 'Failed to fetch conversations');
  }
};

// Create new chat
const createChat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipient_id, message, message_type = 'text', file_url } = req.body;

    if (!recipient_id || message == null || !String(message).trim()) {
      return errorResponse(res, 400, 'Recipient ID and message are required');
    }
    const safeMessage = sanitizeChatText(message);
    if (!safeMessage) {
      return errorResponse(res, 400, 'Message is required');
    }
    if (file_url != null && file_url !== '' && !isSafeFileOrLinkUrl(file_url)) {
      return errorResponse(res, 400, 'Invalid file URL');
    }

    const result = await query(`
      INSERT INTO chats (user_id, recipient_id, message, message_type, file_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [userId, recipient_id, safeMessage, message_type, file_url || null]);

    const created = result.rows[0];
    success(res, 201, 'Chat created successfully', {
      ...created,
      message: sanitizeChatText(created.message),
    });
  } catch (error) {
    console.error('Error creating chat:', error);
    errorResponse(res, 500, 'Failed to create chat');
  }
};

// Update chat
const updateChat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { is_read, is_pinned } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (is_read !== undefined) {
      updates.push(`is_read = $${paramCount++}`);
      values.push(is_read);
    }
    if (is_pinned !== undefined) {
      updates.push(`is_pinned = $${paramCount++}`);
      values.push(is_pinned);
    }
    
    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }
    
    values.push(id, userId);
    
    const result = await query(`
      UPDATE chats 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Chat not found');
    }
    
    const u = result.rows[0];
    success(res, 200, 'Chat updated successfully', {
      ...u,
      message: sanitizeChatText(u.message),
      file_url: u.file_url && isSafeFileOrLinkUrl(u.file_url) ? u.file_url : null,
    });
  } catch (error) {
    console.error('Error updating chat:', error);
    errorResponse(res, 500, 'Failed to update chat');
  }
};

// Pin/unpin conversation (updates all messages in conversation)
const pinConversation = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const { recipientId } = req.params;
    const { is_pinned } = req.body;
    
    if (is_pinned === undefined) {
      return errorResponse(res, 400, 'is_pinned is required');
    }
    
    // Update all messages in conversation (both directions)
    const result = await query(`
      UPDATE chats 
      SET is_pinned = $1, updated_at = NOW()
      WHERE (user_id = $2 AND recipient_id = $3) OR (user_id = $3 AND recipient_id = $2)
      RETURNING id
    `, [!!is_pinned, userId, recipientId]);
    
    success(res, 200, is_pinned ? 'Conversation pinned' : 'Conversation unpinned', { count: result.rowCount });
  } catch (error) {
    console.error('Error pinning conversation:', error);
    errorResponse(res, 500, 'Failed to pin conversation');
  }
};

// Delete conversation (all messages with recipient)
const deleteConversation = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const { recipientId } = req.params;
    
    const result = await query(`
      DELETE FROM chats 
      WHERE (user_id = $1 AND recipient_id = $2) OR (user_id = $2 AND recipient_id = $1)
      RETURNING id
    `, [userId, recipientId]);
    
    success(res, 200, 'Conversation deleted', { count: result.rowCount });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    errorResponse(res, 500, 'Failed to delete conversation');
  }
};

// Mute conversation
const muteConversation = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const { recipientId } = req.params;
    const { is_muted, muted_until } = req.body;
    
    await query(`
      INSERT INTO chat_settings (user_id, recipient_id, is_muted, muted_until, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, recipient_id) DO UPDATE SET
        is_muted = EXCLUDED.is_muted,
        muted_until = EXCLUDED.muted_until,
        updated_at = NOW()
    `, [userId, recipientId, !!is_muted, muted_until || null]);
    
    success(res, 200, is_muted ? 'Conversation muted' : 'Conversation unmuted', {});
  } catch (error) {
    console.error('Error muting conversation:', error);
    errorResponse(res, 500, 'Failed to mute conversation');
  }
};

// Clear conversation (deletes all messages from DB - same as delete for both users)
const clearConversation = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const { recipientId } = req.params;
    
    const result = await query(`
      DELETE FROM chats 
      WHERE (user_id = $1 AND recipient_id = $2) OR (user_id = $2 AND recipient_id = $1)
      RETURNING id
    `, [userId, recipientId]);
    
    success(res, 200, 'Conversation cleared', { count: result.rowCount });
  } catch (error) {
    console.error('Error clearing conversation:', error);
    errorResponse(res, 500, 'Failed to clear conversation');
  }
};

// Report user
const reportUser = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const { recipientId } = req.params;
    const { reason } = req.body;
    
    if (recipientId === String(userId)) {
      return errorResponse(res, 400, 'Cannot report yourself');
    }
    
    await query(`
      INSERT INTO reports (user_id, reported_user_id, reason)
      VALUES ($1, $2, $3)
    `, [userId, recipientId, reason || '']);
    
    success(res, 200, 'Report submitted', {});
  } catch (error) {
    console.error('Error reporting user:', error);
    errorResponse(res, 500, 'Failed to report user');
  }
};

// Block user
const blockUser = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const { recipientId } = req.params;
    
    if (recipientId === String(userId)) {
      return errorResponse(res, 400, 'Cannot block yourself');
    }
    
    await query(`
      INSERT INTO blocked_users (user_id, blocked_user_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, blocked_user_id) DO NOTHING
    `, [userId, recipientId]);
    
    success(res, 200, 'User blocked', {});
  } catch (error) {
    console.error('Error blocking user:', error);
    errorResponse(res, 500, 'Failed to block user');
  }
};

// Delete chat (single message)
const deleteChat = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const result = await query(`
      DELETE FROM chats 
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Chat not found');
    }
    
    success(res, 200, 'Chat deleted successfully');
  } catch (error) {
    console.error('Error deleting chat:', error);
    errorResponse(res, 500, 'Failed to delete chat');
  }
};

module.exports = {
  getAllChats,
  getChatById,
  getMessagesByRecipient,
  getSharedMedia,
  getConversations,
  createChat,
  updateChat,
  pinConversation,
  deleteConversation,
  muteConversation,
  clearConversation,
  reportUser,
  blockUser,
  deleteChat
};
