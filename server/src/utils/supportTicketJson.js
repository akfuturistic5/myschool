const crypto = require('crypto');

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function nextNumericId(items) {
  let max = 0;
  for (const item of items) {
    const id = Number(item?.id);
    if (Number.isFinite(id) && id > max) max = id;
  }
  return max + 1;
}

function isoNow() {
  return new Date().toISOString();
}

function buildMessageEntry(existingMessages, fields) {
  const items = parseJsonArray(existingMessages);
  return {
    id: nextNumericId(items),
    sender_type: fields.sender_type,
    sender_user_id: fields.sender_user_id ?? null,
    sender_super_admin_id: fields.sender_super_admin_id ?? null,
    sender_name: fields.sender_name || null,
    message: fields.message,
    is_internal_note: Boolean(fields.is_internal_note),
    created_at: isoNow(),
  };
}

function buildAttachmentEntries(existingAttachments, attachments, meta) {
  const items = parseJsonArray(existingAttachments);
  let nextId = nextNumericId(items);
  const created = [];
  for (const att of attachments) {
    const entry = {
      id: nextId,
      message_id: meta.message_id ?? null,
      school_id: meta.school_id,
      file_name: att.file_name,
      file_path: att.file_path,
      file_type: att.file_type ?? null,
      file_size: att.file_size ?? null,
      uploaded_by_type: meta.uploaded_by_type,
      uploaded_by_id: meta.uploaded_by_id ?? null,
      created_at: isoNow(),
    };
    nextId += 1;
    created.push(entry);
  }
  return created;
}

function buildStatusHistoryEntry(existingHistory, fields) {
  const items = parseJsonArray(existingHistory);
  return {
    id: nextNumericId(items),
    from_status: fields.from_status ?? null,
    to_status: fields.to_status,
    changed_by_type: fields.changed_by_type,
    changed_by_id: fields.changed_by_id ?? null,
    changed_by_name: fields.changed_by_name ?? null,
    note: fields.note ?? null,
    created_at: isoNow(),
  };
}

function findAttachmentById(ticketRow, attachmentId) {
  const attachments = parseJsonArray(ticketRow?.attachments);
  const aid = Number(attachmentId);
  return attachments.find((a) => Number(a.id) === aid) || null;
}

function filterPublicMessages(messages) {
  return parseJsonArray(messages).filter((m) => !m.is_internal_note);
}

function latestPublicReplyPreview(messages) {
  const publicMsgs = filterPublicMessages(messages);
  if (!publicMsgs.length) return null;
  publicMsgs.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return publicMsgs[publicMsgs.length - 1]?.message || null;
}

function normalizeTicketDetail(row) {
  const messages = parseJsonArray(row.messages);
  const attachments = parseJsonArray(row.attachments);
  const status_history = parseJsonArray(row.status_history);
  return {
    ticket: { ...row, messages: undefined, attachments: undefined, status_history: undefined },
    messages: messages
      .filter((m) => !m.is_internal_note)
      .map((m) => ({
        id: m.id,
        sender_type: m.sender_type,
        sender_name: m.sender_name,
        message: m.message,
        created_at: m.created_at,
      })),
    attachments: attachments.map((a) => ({
      id: a.id,
      message_id: a.message_id ?? null,
      file_name: a.file_name,
      file_path: a.file_path,
      file_type: a.file_type,
      file_size: a.file_size,
      created_at: a.created_at,
    })),
    status_history: status_history.map((h) => ({
      id: h.id,
      from_status: h.from_status,
      to_status: h.to_status,
      changed_by_type: h.changed_by_type,
      changed_by_name: h.changed_by_name,
      note: h.note,
      created_at: h.created_at,
    })),
  };
}

function normalizeTicketDetailAdmin(row) {
  const messages = parseJsonArray(row.messages);
  const attachments = parseJsonArray(row.attachments);
  const status_history = parseJsonArray(row.status_history);
  return {
    ticket: { ...row, messages: undefined, attachments: undefined, status_history: undefined },
    messages,
    attachments,
    status_history,
  };
}

/** Stable id for new installs without collision (optional uuid helper). */
function randomToken() {
  return crypto.randomBytes(8).toString('hex');
}

module.exports = {
  parseJsonArray,
  nextNumericId,
  buildMessageEntry,
  buildAttachmentEntries,
  buildStatusHistoryEntry,
  findAttachmentById,
  filterPublicMessages,
  latestPublicReplyPreview,
  normalizeTicketDetail,
  normalizeTicketDetailAdmin,
  randomToken,
};
