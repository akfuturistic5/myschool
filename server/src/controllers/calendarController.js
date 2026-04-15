const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

// Get all calendar events for current user
const getAllEvents = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const { start_date, end_date } = req.query;
    
    let queryStr = `
      SELECT *
      FROM calendar_events
      WHERE user_id = $1
    `;
    const params = [userId];
    
    if (start_date && end_date) {
      queryStr += ` AND start_date >= $2 AND (end_date IS NULL OR end_date <= $3)`;
      params.push(start_date, end_date);
    }
    
    queryStr += ` ORDER BY start_date ASC`;
    
    const result = await query(queryStr, params);
    
    success(res, 200, 'Calendar events fetched successfully', result.rows);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    errorResponse(res, 500, 'Failed to fetch calendar events');
  }
};

// Get event by ID
const getEventById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const result = await query(`
      SELECT *
      FROM calendar_events
      WHERE id = $1 AND user_id = $2
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Event not found');
    }
    
    success(res, 200, 'Event fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching event:', error);
    errorResponse(res, 500, 'Failed to fetch event');
  }
};

// Create new event
const createEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, start_date, end_date, event_color = 'bg-primary', is_all_day = false, location } = req.body;
    
    if (!title || !start_date) {
      return errorResponse(res, 400, 'Title and start date are required');
    }
    
    const result = await query(`
      INSERT INTO calendar_events (user_id, title, description, start_date, end_date, event_color, is_all_day, location)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [userId, title, description || null, start_date, end_date || null, event_color, is_all_day, location || null]);
    
    success(res, 201, 'Event created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating event:', error);
    errorResponse(res, 500, 'Failed to create event');
  }
};

// Update event
const updateEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, description, start_date, end_date, event_color, is_all_day, location } = req.body;
    
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
      values.push(location);
    }
    
    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }
    
    values.push(id, userId);
    
    const result = await query(`
      UPDATE calendar_events 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Event not found');
    }
    
    success(res, 200, 'Event updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating event:', error);
    errorResponse(res, 500, 'Failed to update event');
  }
};

// Delete event
const deleteEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const result = await query(`
      DELETE FROM calendar_events 
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [id, userId]);
    
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Event not found');
    }
    
    success(res, 200, 'Event deleted successfully');
  } catch (error) {
    console.error('Error deleting event:', error);
    errorResponse(res, 500, 'Failed to delete event');
  }
};

module.exports = {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent
};
