/**
 * Todo module input validation (staff personal tasks).
 */

const PRIORITIES = new Set(['low', 'medium', 'high']);
const STATUSES = new Set(['pending', 'in_progress', 'on_hold', 'done', 'cancelled']);
const VIEWS = new Set(['inbox', 'done', 'important', 'trash']);

const TITLE_MAX = 255;
const DESCRIPTION_MAX = 10000;

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function normalizePriority(value, fallback = 'medium') {
  if (value === null || value === undefined || value === '') return fallback;
  const p = String(value).trim().toLowerCase();
  return PRIORITIES.has(p) ? p : null;
}

function normalizeStatus(value, fallback = 'pending') {
  if (value === null || value === undefined || value === '') return fallback;
  let s = String(value).trim().toLowerCase().replace(/\s+/g, '_');
  if (s === 'onhold') s = 'on_hold';
  return STATUSES.has(s) ? s : null;
}

function normalizeView(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  return VIEWS.has(v) ? v : null;
}

function normalizeDueDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function normalizeBoolean(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return undefined;
}

function validateTodoPayload(body, { isCreate = false } = {}) {
  const errors = [];
  const out = {};

  const title = normalizeString(body.title);
  if (isCreate && !title) {
    errors.push('Title is required');
  } else if (body.title !== undefined) {
    if (!title) errors.push('Title cannot be empty');
    else if (title.length > TITLE_MAX) errors.push(`Title must be at most ${TITLE_MAX} characters`);
    else out.title = title;
  }

  if (body.description !== undefined) {
    const desc = body.description === null ? null : String(body.description).trim();
    if (desc && desc.length > DESCRIPTION_MAX) {
      errors.push(`Description must be at most ${DESCRIPTION_MAX} characters`);
    } else {
      out.description = desc || null;
    }
  }

  if (body.due_date !== undefined) {
    const due = normalizeDueDate(body.due_date);
    if (due === undefined) errors.push('Invalid due date');
    else out.due_date = due;
  }

  if (body.priority !== undefined) {
    const priority = normalizePriority(body.priority, null);
    if (!priority) errors.push('Invalid priority');
    else out.priority = priority;
  }

  if (body.status !== undefined) {
    const status = normalizeStatus(body.status, null);
    if (!status) errors.push('Invalid status');
    else out.status = status;
  }

  if (body.is_important !== undefined) {
    const imp = normalizeBoolean(body.is_important);
    if (imp === undefined) errors.push('Invalid is_important value');
    else out.is_important = imp;
  }

  if (body.assigned_to !== undefined) {
    if (body.assigned_to === null || body.assigned_to === '') {
      out.assigned_to = null;
    } else {
      const id = parseInt(body.assigned_to, 10);
      if (!Number.isFinite(id) || id <= 0) errors.push('Invalid assignee');
      else out.assigned_to = id;
    }
  }

  return { errors, data: out };
}

module.exports = {
  PRIORITIES,
  STATUSES,
  VIEWS,
  normalizeView,
  validateTodoPayload,
};
