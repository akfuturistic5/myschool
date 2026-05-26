const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { normalizeView, validateTodoPayload } = require('../utils/todoValidation');

const TODO_SELECT = `
  SELECT
    t.*,
    u.username AS assigned_to_username,
    u.first_name AS assigned_to_first_name,
    u.last_name AS assigned_to_last_name,
    NULL AS assigned_to_photo_url
  FROM todos t
  LEFT JOIN users u ON t.assigned_to = u.id
`;

function buildViewClause(view) {
  switch (view) {
    case 'done':
      return ` AND t.status = 'done'`;
    case 'important':
      return ` AND t.is_important = TRUE AND t.status <> 'cancelled'`;
    case 'trash':
      return ` AND t.status = 'cancelled'`;
    case 'inbox':
    default:
      return ` AND t.status NOT IN ('done', 'cancelled')`;
  }
}

async function fetchStats(userId) {
  const statsResult = await query(
    `
    SELECT
      COUNT(*) FILTER (WHERE status NOT IN ('done', 'cancelled'))::int AS inbox,
      COUNT(*) FILTER (WHERE status = 'done')::int AS done,
      COUNT(*) FILTER (WHERE is_important = TRUE AND status <> 'cancelled')::int AS important,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS trash
    FROM todos
    WHERE user_id = $1
    `,
    [userId]
  );
  return statsResult.rows[0] || { inbox: 0, done: 0, important: 0, trash: 0 };
}

async function assertAssigneeInTenant(assigneeId) {
  if (!assigneeId) return true;
  const result = await query('SELECT id FROM users WHERE id = $1 LIMIT 1', [assigneeId]);
  return result.rows.length > 0;
}

const getAllTodos = async (req, res) => {
  try {
    if (!req.user?.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const view = normalizeView(req.query.view) || 'inbox';
    const { priority } = req.query;

    let queryStr = `${TODO_SELECT} WHERE t.user_id = $1`;
    const params = [userId];
    let paramCount = 2;

    queryStr += buildViewClause(view);

    if (priority) {
      const p = String(priority).trim().toLowerCase();
      queryStr += ` AND t.priority = $${paramCount++}`;
      params.push(p);
    }
    queryStr += ` ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC`;

    const [result, stats] = await Promise.all([
      query(queryStr, params),
      fetchStats(userId),
    ]);

    success(res, 200, 'Todos fetched successfully', result.rows, { stats });
  } catch (error) {
    console.error('Error fetching todos:', error);
    errorResponse(res, 500, 'Failed to fetch todos');
  }
};

const getTodoById = async (req, res) => {
  try {
    if (!req.user?.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return errorResponse(res, 400, 'Invalid todo id');
    }

    const result = await query(
      `${TODO_SELECT} WHERE t.id = $1 AND t.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Todo not found');
    }

    success(res, 200, 'Todo fetched successfully', result.rows[0]);
  } catch (error) {
    console.error('Error fetching todo:', error);
    errorResponse(res, 500, 'Failed to fetch todo');
  }
};

const createTodo = async (req, res) => {
  try {
    if (!req.user?.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const { errors, data } = validateTodoPayload(req.body, { isCreate: true });
    if (errors.length) {
      return errorResponse(res, 400, errors[0], 'VALIDATION_ERROR', { errors });
    }

    if (data.assigned_to) {
      const ok = await assertAssigneeInTenant(data.assigned_to);
      if (!ok) return errorResponse(res, 400, 'Assignee not found');
    }

    const title = data.title;
    const description = data.description ?? null;
    const due_date = data.due_date ?? null;
    const priority = data.priority ?? 'medium';
    const status = data.status ?? 'pending';
    const is_important = data.is_important ?? false;
    const assigned_to = data.assigned_to ?? null;

    const result = await query(
      `
      INSERT INTO todos (user_id, title, description, due_date, priority, status, tag, is_important, assigned_to)
      VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8)
      RETURNING *
      `,
      [userId, title, description, due_date, priority, status, is_important, assigned_to]
    );

    success(res, 201, 'Todo created successfully', result.rows[0]);
  } catch (error) {
    console.error('Error creating todo:', error);
    errorResponse(res, 500, 'Failed to create todo');
  }
};

const updateTodo = async (req, res) => {
  try {
    if (!req.user?.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return errorResponse(res, 400, 'Invalid todo id');
    }

    const { errors, data } = validateTodoPayload(req.body, { isCreate: false });
    if (errors.length) {
      return errorResponse(res, 400, errors[0], 'VALIDATION_ERROR', { errors });
    }
    if (Object.keys(data).length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    if (data.assigned_to) {
      const ok = await assertAssigneeInTenant(data.assigned_to);
      if (!ok) return errorResponse(res, 400, 'Assignee not found');
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.entries(data).forEach(([key, value]) => {
      updates.push(`${key} = $${paramCount++}`);
      values.push(value);
    });

    updates.push('tag = NULL');
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id, userId);

    const result = await query(
      `
      UPDATE todos
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
      `,
      values
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Todo not found');
    }

    success(res, 200, 'Todo updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Error updating todo:', error);
    errorResponse(res, 500, 'Failed to update todo');
  }
};

/** Soft-delete: move to trash (cancelled). */
const trashTodo = async (req, res) => {
  try {
    if (!req.user?.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return errorResponse(res, 400, 'Invalid todo id');
    }

    const result = await query(
      `
      UPDATE todos
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
      `,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Todo not found');
    }

    success(res, 200, 'Todo moved to trash', result.rows[0]);
  } catch (error) {
    console.error('Error trashing todo:', error);
    errorResponse(res, 500, 'Failed to delete todo');
  }
};

/** Restore from trash back to pending. */
const restoreTodo = async (req, res) => {
  try {
    if (!req.user?.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return errorResponse(res, 400, 'Invalid todo id');
    }

    const result = await query(
      `
      UPDATE todos
      SET status = 'pending', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 AND status = 'cancelled'
      RETURNING *
      `,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Todo not found in trash');
    }

    success(res, 200, 'Todo restored successfully', result.rows[0]);
  } catch (error) {
    console.error('Error restoring todo:', error);
    errorResponse(res, 500, 'Failed to restore todo');
  }
};

/** Permanent delete (typically from trash). */
const deleteTodo = async (req, res) => {
  try {
    if (!req.user?.id) {
      return errorResponse(res, 401, 'User not authenticated');
    }
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return errorResponse(res, 400, 'Invalid todo id');
    }

    const result = await query(
      `DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Todo not found');
    }

    success(res, 200, 'Todo deleted permanently');
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
  trashTodo,
  restoreTodo,
  deleteTodo,
};
