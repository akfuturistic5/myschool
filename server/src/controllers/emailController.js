const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

// Get all emails for current user
const getAllEmails = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const { folder = 'inbox' } = req.query;
    
    const result = await query(`
      SELECT 
        e.id,
        e.user_id,
        e.sender_id,
        e.sender_email,
        e.recipient_email,
        e.subject,
        e.body,
        e.is_read,
        e.is_starred,
        e.is_important,
        e.folder,
        e.has_attachment,
        e.attachment_url,
        e.sent_at,
        e.created_at,
        u.username as sender_username,
        u.first_name as sender_first_name,
        u.last_name as sender_last_name,
        NULL as sender_photo_url
      FROM emails e
      LEFT JOIN users u ON e.sender_id = u.id
      WHERE e.user_id = $1 AND e.folder = $2
      ORDER BY e.sent_at DESC
    `, [userId, folder]);
    
    success(res, 200, 'Emails fetched successfully', result.rows);
  } catch (error) {
    console.error('Error fetching emails:', error);
    errorResponse(res, 500, 'Failed to fetch emails');
  }
};

// Get email by ID
const getEmailById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const result = await query(`
      SELECT 
        e.*,
        u.username as sender_username,
        u.first_name as sender_first_name,
        u.last_name as sender_last_name,
        NULL as sender_photo_url
      FROM emails e
      LEFT JOIN users u ON e.sender_id = u.id
      WHERE e.id = $1 AND e.user_id = $2
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Email not found');
    }
    
    // Mark as read when viewing
    await query(`
      UPDATE emails SET is_read = true WHERE id = $1 AND user_id = $2
    `, [id, userId]);
    
    success(res, 200, 'Email fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching email:', error);
    errorResponse(res, 500, 'Failed to fetch email');
  }
};

// Create new email
const createEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipient_email, subject, body, sender_id, has_attachment = false, attachment_url, folder = 'sent' } = req.body;
    
    if (!recipient_email || !subject || !body) {
      return errorResponse(res, 400, 'Recipient email, subject, and body are required');
    }
    
    const result = await query(`
      INSERT INTO emails (user_id, sender_id, sender_email, recipient_email, subject, body, folder, has_attachment, attachment_url, sent_at)
      VALUES ($1, $2, (SELECT email FROM users WHERE id = $1), $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *
    `, [userId, sender_id || userId, recipient_email, subject, body, folder, has_attachment, attachment_url || null]);
    
    success(res, 201, 'Email created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating email:', error);
    errorResponse(res, 500, 'Failed to create email');
  }
};

// Update email
const updateEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { is_read, is_starred, is_important, folder } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (is_read !== undefined) {
      updates.push(`is_read = $${paramCount++}`);
      values.push(is_read);
    }
    if (is_starred !== undefined) {
      updates.push(`is_starred = $${paramCount++}`);
      values.push(is_starred);
    }
    if (is_important !== undefined) {
      updates.push(`is_important = $${paramCount++}`);
      values.push(is_important);
    }
    if (folder !== undefined) {
      updates.push(`folder = $${paramCount++}`);
      values.push(folder);
    }
    
    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }
    
    values.push(id, userId);
    
    const result = await query(`
      UPDATE emails 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Email not found');
    }
    
    success(res, 200, 'Email updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating email:', error);
    errorResponse(res, 500, 'Failed to update email');
  }
};

// Delete email
const deleteEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // Move to trash instead of hard delete
    const result = await query(`
      UPDATE emails 
      SET folder = 'trash'
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Email not found');
    }
    
    success(res, 200, 'Email moved to trash successfully');
  } catch (error) {
    console.error('Error deleting email:', error);
    errorResponse(res, 500, 'Failed to delete email');
  }
};

module.exports = {
  getAllEmails,
  getEmailById,
  createEmail,
  updateEmail,
  deleteEmail
};
