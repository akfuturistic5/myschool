const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

/**
 * Get all school-wide events (for dashboards and Events page)
 * All authenticated users can view
 */
const getAllEvents = async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const limitVal = Math.min(parseInt(limit, 10) || 100, 200);
    const offsetVal = Math.max(0, parseInt(offset, 10) || 0);

    const result = await query(
      `SELECT e.id, e.title, e.description, e.start_date, e.end_date, e.event_color,
              e.is_all_day, e.location, e.event_category, e.event_for, e.created_at,
              u.first_name AS created_by_first_name, u.last_name AS created_by_last_name
       FROM events e
       LEFT JOIN users u ON e.created_by = u.id
       ORDER BY e.start_date DESC
       LIMIT $1 OFFSET $2`,
      [limitVal, offsetVal]
    );

    success(res, 200, 'Events fetched successfully', result.rows);
  } catch (err) {
    console.error('Error fetching events:', err);
    errorResponse(res, 500, 'Failed to fetch events');
  }
};

/**
 * Get upcoming events (start_date >= now - event has not started yet)
 */
const getUpcomingEvents = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const result = await query(
      `SELECT e.id, e.title, e.description, e.start_date, e.end_date, e.event_color,
              e.is_all_day, e.location, e.event_category, e.event_for
       FROM events e
       WHERE e.start_date >= CURRENT_TIMESTAMP
       ORDER BY e.start_date ASC
       LIMIT $1`,
      [limit]
    );
    success(res, 200, 'Upcoming events fetched successfully', result.rows);
  } catch (err) {
    console.error('Error fetching upcoming events:', err);
    errorResponse(res, 500, 'Failed to fetch upcoming events');
  }
};

/**
 * Get completed events (COALESCE(end_date, start_date) < now)
 */
const getCompletedEvents = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const result = await query(
      `SELECT e.id, e.title, e.description, e.start_date, e.end_date, e.event_color,
              e.is_all_day, e.location, e.event_category, e.event_for
       FROM events e
       WHERE COALESCE(e.end_date, e.start_date) < CURRENT_TIMESTAMP
       ORDER BY COALESCE(e.end_date, e.start_date) DESC
       LIMIT $1`,
      [limit]
    );
    success(res, 200, 'Completed events fetched successfully', result.rows);
  } catch (err) {
    console.error('Error fetching completed events:', err);
    errorResponse(res, 500, 'Failed to fetch completed events');
  }
};

/**
 * Create new event - Admin/Headmaster only
 */
const createEvent = async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      title,
      description,
      start_date,
      end_date,
      event_color = 'bg-primary',
      is_all_day = false,
      location,
      event_category,
      event_for = 'all',
      target_class_ids,
      target_section_ids,
      attachment_url,
    } = req.body;

    if (!title || !start_date) {
      return errorResponse(res, 400, 'Title and start date are required');
    }

    const result = await query(
      `INSERT INTO events (
        title, description, start_date, end_date, event_color, is_all_day,
        location, event_category, event_for, target_class_ids, target_section_ids,
        attachment_url, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        title,
        description || null,
        start_date,
        end_date || null,
        event_color,
        is_all_day,
        location || null,
        event_category || null,
        event_for,
        target_class_ids ? JSON.stringify(target_class_ids) : null,
        target_section_ids ? JSON.stringify(target_section_ids) : null,
        attachment_url || null,
        userId || null,
      ]
    );

    success(res, 201, 'Event created successfully', result.rows[0]);
  } catch (err) {
    console.error('Error creating event:', err);
    errorResponse(res, 500, 'Failed to create event');
  }
};

/**
 * Update event - Admin only
 */
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      start_date,
      end_date,
      event_color,
      is_all_day,
      location,
      event_category,
      event_for,
      target_class_ids,
      target_section_ids,
      attachment_url,
    } = req.body;

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
    if (event_category !== undefined) {
      updates.push(`event_category = $${paramCount++}`);
      values.push(event_category);
    }
    if (event_for !== undefined) {
      updates.push(`event_for = $${paramCount++}`);
      values.push(event_for);
    }
    if (target_class_ids !== undefined) {
      updates.push(`target_class_ids = $${paramCount++}`);
      values.push(target_class_ids ? JSON.stringify(target_class_ids) : null);
    }
    if (target_section_ids !== undefined) {
      updates.push(`target_section_ids = $${paramCount++}`);
      values.push(target_section_ids ? JSON.stringify(target_section_ids) : null);
    }
    if (attachment_url !== undefined) {
      updates.push(`attachment_url = $${paramCount++}`);
      values.push(attachment_url);
    }

    if (updates.length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    values.push(id);
    const result = await query(
      `UPDATE events SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Event not found');
    }

    success(res, 200, 'Event updated successfully', result.rows[0]);
  } catch (err) {
    console.error('Error updating event:', err);
    errorResponse(res, 500, 'Failed to update event');
  }
};

/**
 * Delete event - Admin only
 */
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Event not found');
    }

    success(res, 200, 'Event deleted successfully');
  } catch (err) {
    console.error('Error deleting event:', err);
    errorResponse(res, 500, 'Failed to delete event');
  }
};

module.exports = {
  getAllEvents,
  getUpcomingEvents,
  getCompletedEvents,
  createEvent,
  updateEvent,
  deleteEvent,
};
