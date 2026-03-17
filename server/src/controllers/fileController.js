const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

function isSafeFileUrl(u) {
  if (u == null) return true;
  const s = String(u).trim();
  if (!s) return true;
  // Allow relative paths used by the app (no scheme).
  if (s.startsWith('/')) return true;
  // Reject dangerous schemes.
  const lower = s.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('file:')) return false;
  try {
    const url = new URL(s);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

// Get all files for current user
const getAllFiles = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const { parent_folder_id, file_type, is_folder } = req.query;
    
    let queryStr = `
      SELECT *
      FROM files
      WHERE user_id = $1
    `;
    const params = [userId];
    let paramCount = 2;
    
    if (parent_folder_id !== undefined) {
      queryStr += ` AND parent_folder_id ${parent_folder_id === 'null' ? 'IS NULL' : `= $${paramCount++}`}`;
      if (parent_folder_id !== 'null') {
        params.push(parent_folder_id);
      }
    } else {
      queryStr += ` AND parent_folder_id IS NULL`;
    }
    
    if (file_type !== undefined) {
      queryStr += ` AND file_type = $${paramCount++}`;
      params.push(file_type);
    }
    if (is_folder !== undefined) {
      queryStr += ` AND is_folder = $${paramCount++}`;
      params.push(is_folder === 'true');
    }
    
    queryStr += ` ORDER BY is_folder DESC, created_at DESC`;
    
    const result = await query(queryStr, params);
    
    success(res, 200, 'Files fetched successfully', result.rows);
  } catch (error) {
    console.error('Error fetching files:', error);
    errorResponse(res, 500, 'Failed to fetch files');
  }
};

// Get file by ID
const getFileById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const result = await query(`
      SELECT *
      FROM files
      WHERE id = $1 AND user_id = $2
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'File not found');
    }
    
    success(res, 200, 'File fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching file:', error);
    errorResponse(res, 500, 'Failed to fetch file');
  }
};

// Create new file/folder
const createFile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, file_type, mime_type, size = 0, file_url, parent_folder_id, is_folder = false, is_shared = false, shared_with = [] } = req.body;
    
    if (!name) {
      return errorResponse(res, 400, 'Name is required');
    }
    if (!isSafeFileUrl(file_url)) {
      return errorResponse(res, 400, 'Invalid file_url');
    }
    const sharedWithSafe = Array.isArray(shared_with)
      ? shared_with.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n))
      : [];
    
    const result = await query(`
      INSERT INTO files (user_id, name, file_type, mime_type, size, file_url, parent_folder_id, is_folder, is_shared, shared_with)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [userId, name, file_type || null, mime_type || null, size, file_url || null, parent_folder_id || null, is_folder, is_shared, sharedWithSafe]);
    
    success(res, 201, 'File created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating file:', error);
    errorResponse(res, 500, 'Failed to create file');
  }
};

// Update file
const updateFile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, is_shared, shared_with, file_url } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (is_shared !== undefined) {
      updates.push(`is_shared = $${paramCount++}`);
      values.push(is_shared);
    }
    if (shared_with !== undefined) {
      const sharedWithSafe = Array.isArray(shared_with)
        ? shared_with.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n))
        : [];
      updates.push(`shared_with = $${paramCount++}`);
      values.push(sharedWithSafe);
    }
    if (file_url !== undefined) {
      if (!isSafeFileUrl(file_url)) {
        return errorResponse(res, 400, 'Invalid file_url');
      }
      updates.push(`file_url = $${paramCount++}`);
      values.push(file_url || null);
    }
    
    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }
    
    values.push(id, userId);
    
    const result = await query(`
      UPDATE files 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'File not found');
    }
    
    success(res, 200, 'File updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating file:', error);
    errorResponse(res, 500, 'Failed to update file');
  }
};

// Delete file
const deleteFile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // Check if it's a folder with children
    const childrenCheck = await query(`
      SELECT COUNT(*) as count FROM files WHERE parent_folder_id = $1 AND user_id = $2
    `, [id, userId]);
    
    if (childrenCheck.rows[0].count > 0) {
      return errorResponse(res, 400, 'Cannot delete folder with files inside');
    }
    
    const result = await query(`
      DELETE FROM files 
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'File not found');
    }
    
    success(res, 200, 'File deleted successfully');
  } catch (error) {
    console.error('Error deleting file:', error);
    errorResponse(res, 500, 'Failed to delete file');
  }
};

module.exports = {
  getAllFiles,
  getFileById,
  createFile,
  updateFile,
  deleteFile
};
