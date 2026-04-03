const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

// Get all calls for current user
const getAllCalls = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    
    const result = await query(`
      SELECT 
        c.id,
        c.user_id,
        c.recipient_id,
        c.call_type,
        c.phone_number,
        c.duration,
        c.call_date,
        c.created_at,
        u.username as recipient_username,
        u.first_name as recipient_first_name,
        u.last_name as recipient_last_name,
        NULL as recipient_photo_url,
        u.phone as recipient_phone
      FROM calls c
      LEFT JOIN users u ON c.recipient_id = u.id
      WHERE c.user_id = $1
      ORDER BY c.call_date DESC
    `, [userId]);
    
    success(res, 200, 'Calls fetched successfully', result.rows);
  } catch (error) {
    console.error('Error fetching calls:', error);
    errorResponse(res, 500, 'Failed to fetch calls');
  }
};

// Get call by ID
const getCallById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const result = await query(`
      SELECT 
        c.*,
        u.username as recipient_username,
        u.first_name as recipient_first_name,
        u.last_name as recipient_last_name,
        NULL as recipient_photo_url,
        u.phone as recipient_phone
      FROM calls c
      LEFT JOIN users u ON c.recipient_id = u.id
      WHERE c.id = $1 AND c.user_id = $2
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Call not found');
    }
    
    success(res, 200, 'Call fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching call:', error);
    errorResponse(res, 500, 'Failed to fetch call');
  }
};

// Create new call
const createCall = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipient_id, call_type, phone_number, duration = 0 } = req.body;
    
    if (!call_type || !phone_number) {
      return errorResponse(res, 400, 'Call type and phone number are required');
    }
    
    const result = await query(`
      INSERT INTO calls (user_id, recipient_id, call_type, phone_number, duration, call_date)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *
    `, [userId, recipient_id || null, call_type, phone_number, duration]);
    
    success(res, 201, 'Call created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating call:', error);
    errorResponse(res, 500, 'Failed to create call');
  }
};

// Update call
const updateCall = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { duration, call_type } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (duration !== undefined) {
      updates.push(`duration = $${paramCount++}`);
      values.push(duration);
    }
    if (call_type !== undefined) {
      updates.push(`call_type = $${paramCount++}`);
      values.push(call_type);
    }
    
    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }
    
    values.push(id, userId);
    
    const result = await query(`
      UPDATE calls 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Call not found');
    }
    
    success(res, 200, 'Call updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating call:', error);
    errorResponse(res, 500, 'Failed to update call');
  }
};

// Delete call
const deleteCall = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const result = await query(`
      DELETE FROM calls 
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Call not found');
    }
    
    success(res, 200, 'Call deleted successfully');
  } catch (error) {
    console.error('Error deleting call:', error);
    errorResponse(res, 500, 'Failed to delete call');
  }
};

module.exports = {
  getAllCalls,
  getCallById,
  createCall,
  updateCall,
  deleteCall
};
