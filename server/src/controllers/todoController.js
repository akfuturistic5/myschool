const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

// Get all todos for current user
const getAllTodos = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const { status, priority, tag } = req.query;
    
    let queryStr = `
      SELECT 
        t.*,
        u.username as assigned_to_username,
        u.first_name as assigned_to_first_name,
        u.last_name as assigned_to_last_name,
        NULL as assigned_to_photo_url
      FROM todos t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.user_id = $1
    `;
    const params = [userId];
    let paramCount = 2;
    
    if (status) {
      queryStr += ` AND t.status = $${paramCount++}`;
      params.push(status);
    }
    if (priority) {
      queryStr += ` AND t.priority = $${paramCount++}`;
      params.push(priority);
    }
    if (tag) {
      queryStr += ` AND t.tag = $${paramCount++}`;
      params.push(tag);
    }
    
    queryStr += ` ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC`;
    
    const result = await query(queryStr, params);
    
    success(res, 200, 'Todos fetched successfully', result.rows);
  } catch (error) {
    console.error('Error fetching todos:', error);
    errorResponse(res, 500, 'Failed to fetch todos');
  }
};

// Get todo by ID
const getTodoById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const result = await query(`
      SELECT 
        t.*,
        u.username as assigned_to_username,
        u.first_name as assigned_to_first_name,
        u.last_name as assigned_to_last_name,
        NULL as assigned_to_photo_url
      FROM todos t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = $1 AND t.user_id = $2
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Todo not found');
    }
    
    success(res, 200, 'Todo fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching todo:', error);
    errorResponse(res, 500, 'Failed to fetch todo');
  }
};

// Create new todo
const createTodo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, due_date, priority = 'medium', status = 'pending', tag, is_important = false, assigned_to } = req.body;
    
    if (!title) {
      return errorResponse(res, 400, 'Title is required');
    }
    
    const result = await query(`
      INSERT INTO todos (user_id, title, description, due_date, priority, status, tag, is_important, assigned_to)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [userId, title, description || null, due_date || null, priority, status, tag || null, is_important, assigned_to || null]);
    
    success(res, 201, 'Todo created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating todo:', error);
    errorResponse(res, 500, 'Failed to create todo');
  }
};

// Update todo
const updateTodo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, description, due_date, priority, status, tag, is_important, assigned_to } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${paramCount++}`);
      values.push(due_date);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (tag !== undefined) {
      updates.push(`tag = $${paramCount++}`);
      values.push(tag);
    }
    if (is_important !== undefined) {
      updates.push(`is_important = $${paramCount++}`);
      values.push(is_important);
    }
    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramCount++}`);
      values.push(assigned_to);
    }
    
    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }
    
    values.push(id, userId);
    
    const result = await query(`
      UPDATE todos 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Todo not found');
    }
    
    success(res, 200, 'Todo updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating todo:', error);
    errorResponse(res, 500, 'Failed to update todo');
  }
};

// Delete todo
const deleteTodo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const result = await query(`
      DELETE FROM todos 
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Todo not found');
    }
    
    success(res, 200, 'Todo deleted successfully');
  } catch (error) {
    console.error('Error deleting todo:', error);
    errorResponse(res, 500, 'Failed to delete todo');
  }
};

module.exports = {
  getAllTodos,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo
};
