const { masterQuery } = require('../config/database');
const { parseRelativeKey } = require('../storage/LocalFilesystemStorageProvider');
const { getMaxUploadBytes } = require('../storage/schoolStorageConfig');
const path = require('path');

const HELP_ARTICLE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Escape % and _ for safe ILIKE patterns (PostgreSQL ESCAPE '\\'). */
function escapeIlikePattern(raw) {
  return String(raw || '')
    .slice(0, 200)
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

function isValidHelpSlug(slug) {
  const s = String(slug || '').trim().toLowerCase();
  return s.length >= 2 && s.length <= 120 && HELP_ARTICLE_SLUG_RE.test(s);
}

function safeAttachmentFileName(name) {
  const base = path.basename(String(name || 'file').replace(/[^\w.\- ()]/g, '_'));
  return base.slice(0, 255) || 'file';
}

async function generateTicketNumber() {
  const year = new Date().getFullYear();
  const r = await masterQuery(`SELECT nextval('support_ticket_number_seq') AS n`);
  const n = r.rows?.[0]?.n ?? Date.now();
  return `TKT-${year}-${String(n).padStart(6, '0')}`;
}

function validateAttachmentPathsForSchool(attachments, schoolId) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  const sid = Number(schoolId);
  const out = [];
  for (const a of attachments) {
    const path = String(a?.file_path || '').trim();
    const parsed = parseRelativeKey(path);
    if (!parsed || Number(parsed.schoolId) !== sid) {
      throw new Error('Invalid attachment path for this school');
    }
    if (!path.includes('/support/')) {
      throw new Error('Attachments must be uploaded to the support folder');
    }
    const maxBytes = getMaxUploadBytes();
    const size = a.file_size != null ? Number(a.file_size) : null;
    if (size != null && Number.isFinite(size) && size > maxBytes) {
      throw new Error('Attachment exceeds maximum allowed size');
    }
    out.push({
      file_name: safeAttachmentFileName(a.file_name || parsed.filename),
      file_path: path,
      file_type: a.file_type ? String(a.file_type).slice(0, 100) : null,
      file_size: size,
    });
  }
  return out;
}

async function recordStatusHistory(clientOrQuery, ticketId, fromStatus, toStatus, meta) {
  const { buildStatusHistoryEntry } = require('./supportTicketJson');
  const q = clientOrQuery;
  const cur = await q(`SELECT status_history FROM support_tickets WHERE id = $1`, [ticketId]);
  const entry = buildStatusHistoryEntry(cur.rows?.[0]?.status_history, {
    from_status: fromStatus,
    to_status: toStatus,
    changed_by_type: meta.changed_by_type,
    changed_by_id: meta.changed_by_id ?? null,
    changed_by_name: meta.changed_by_name || null,
    note: meta.note || null,
  });
  await q(
    `UPDATE support_tickets
     SET status_history = COALESCE(status_history, '[]'::jsonb) || $2::jsonb
     WHERE id = $1`,
    [ticketId, JSON.stringify([entry])]
  );
}

module.exports = {
  generateTicketNumber,
  validateAttachmentPathsForSchool,
  recordStatusHistory,
  escapeIlikePattern,
  isValidHelpSlug,
  safeAttachmentFileName,
};
