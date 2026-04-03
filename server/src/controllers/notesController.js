const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

// Get all notes for current user
const getAllNotes = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const { is_deleted = false, is_important, priority, tag } = req.query;
    
    let queryStr = `
      SELECT *
      FROM notes
      WHERE user_id = $1 AND is_deleted = $2
    `;
    const params = [userId, is_deleted];
    let paramCount = 3;
    
    if (is_important !== undefined) {
      queryStr += ` AND is_important = $${paramCount++}`;
      params.push(is_important === 'true' || is_important === true);
    }
    if (priority) {
      queryStr += ` AND priority = $${paramCount++}`;
      params.push(priority);
    }
    if (tag) {
      queryStr += ` AND tag = $${paramCount++}`;
      params.push(tag);
    }
    
    queryStr += ` ORDER BY created_at DESC`;
    
    const result = await query(queryStr, params);
    
    success(res, 200, 'Notes fetched successfully', result.rows);
  } catch (error) {
    console.error('Error fetching notes:', error);
    errorResponse(res, 500, 'Failed to fetch notes');
  }
};

// Get note by ID
const getNoteById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const result = await query(`
      SELECT *
      FROM notes
      WHERE id = $1 AND user_id = $2
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Note not found');
    }
    
    success(res, 200, 'Note fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching note:', error);
    errorResponse(res, 500, 'Failed to fetch note');
  }
};

// Create new note
const createNote = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, content, tag, priority = 'medium', is_important = false } = req.body;
    
    if (!title || !content) {
      return errorResponse(res, 400, 'Title and content are required');
    }
    
    const result = await query(`
      INSERT INTO notes (user_id, title, content, tag, priority, is_important)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [userId, title, content, tag || null, priority, is_important]);
    
    success(res, 201, 'Note created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating note:', error);
    errorResponse(res, 500, 'Failed to create note');
  }
};

// Update note
const updateNote = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, content, tag, priority, is_important } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(content);
    }
    if (tag !== undefined) {
      updates.push(`tag = $${paramCount++}`);
      values.push(tag);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
    }
    if (is_important !== undefined) {
      updates.push(`is_important = $${paramCount++}`);
      values.push(is_important);
    }
    
    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }
    
    values.push(id, userId);
    
    const result = await query(`
      UPDATE notes 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Note not found');
    }
    
    success(res, 200, 'Note updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating note:', error);
    errorResponse(res, 500, 'Failed to update note');
  }
};

// Delete note (soft delete)
const deleteNote = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const result = await query(`
      UPDATE notes 
      SET is_deleted = true
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Note not found');
    }
    
    success(res, 200, 'Note deleted successfully');
  } catch (error) {
    console.error('Error deleting note:', error);
    errorResponse(res, 500, 'Failed to delete note');
  }
};

module.exports = {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote
};
