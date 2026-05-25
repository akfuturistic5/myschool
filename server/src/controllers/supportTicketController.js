const { masterQuery } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { parsePagination, listMeta, buildOrderClause } = require('../utils/accountsPagination');
const { sanitizeChatText } = require('../utils/htmlSanitize');
const { getSchoolIdFromRequest } = require('../utils/schoolContext');
const {
  generateTicketNumber,
  validateAttachmentPathsForSchool,
  recordStatusHistory,
  escapeIlikePattern,
} = require('../utils/supportTicketUtils');
const {
  buildMessageEntry,
  buildAttachmentEntries,
  buildStatusHistoryEntry,
  normalizeTicketDetail,
  parseJsonArray,
} = require('../utils/supportTicketJson');
const { TICKET_CATEGORIES, TICKET_PRIORITIES } = require('../config/supportConstants');
const { TICKET_STATUSES } = require('../config/supportConstants');

function getSchoolAdminContext(req) {
  const schoolId = getSchoolIdFromRequest(req);
  const userId = req.user?.id ?? req.tenant?.tenant_user_id;
  const name = [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ').trim()
    || req.user?.name
    || req.user?.email
    || 'School Admin';
  const email = req.user?.email || null;
  return { schoolId, userId, name, email };
}

const listTickets = async (req, res) => {
  try {
    const { schoolId } = getSchoolAdminContext(req);
    if (!schoolId) return errorResponse(res, 401, 'School context required');

    const { page, pageSize, offset } = parsePagination(req.query, 10);
    const params = [schoolId];
    let where = 't.school_id = $1 AND t.deleted_at IS NULL';

    if (req.query.status) {
      params.push(String(req.query.status));
      where += ` AND t.status = $${params.length}`;
    }
    if (req.query.priority) {
      params.push(String(req.query.priority));
      where += ` AND t.priority = $${params.length}`;
    }
    if (req.query.category) {
      params.push(String(req.query.category));
      where += ` AND t.category = $${params.length}`;
    }
    if (req.query.search) {
      const term = escapeIlikePattern(sanitizeChatText(req.query.search));
      if (term) {
        params.push(`%${term}%`);
        where += ` AND (t.subject ILIKE $${params.length} ESCAPE '\\' OR t.ticket_number ILIKE $${params.length} ESCAPE '\\')`;
      }
    }

    const countR = await masterQuery(
      `SELECT COUNT(*)::int AS total FROM support_tickets t WHERE ${where}`,
      params
    );
    const total = countR.rows?.[0]?.total ?? 0;

    const order = buildOrderClause(
      req.query,
      {
        created_at: 't.created_at',
        updated_at: 't.updated_at',
        priority: 't.priority',
        status: 't.status',
      },
      'updated_at',
      't.id DESC',
      'desc'
    );

    const listR = await masterQuery(
      `SELECT t.id, t.ticket_number, t.subject, t.category, t.priority, t.status,
              t.created_at, t.updated_at, t.last_reply_at, t.last_reply_by,
              (SELECT elem->>'message'
               FROM jsonb_array_elements(COALESCE(t.messages, '[]'::jsonb)) AS elem
               WHERE COALESCE((elem->>'is_internal_note')::boolean, false) = false
               ORDER BY elem->>'created_at' DESC NULLS LAST
               LIMIT 1) AS latest_reply_preview
       FROM support_tickets t
       WHERE ${where}
       ${order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );

    return res.status(200).json({
      success: true,
      status: 'SUCCESS',
      message: 'Tickets fetched',
      data: listR.rows || [],
      ...listMeta(total, page, pageSize),
    });
  } catch (err) {
    console.error('listTickets error:', err);
    return errorResponse(res, 500, 'Failed to list tickets');
  }
};

const createTicket = async (req, res) => {
  try {
    const { schoolId, userId, name } = getSchoolAdminContext(req);
    if (!schoolId || !userId) return errorResponse(res, 401, 'School context required');

    const subject = sanitizeChatText(req.body.subject);
    const description = sanitizeChatText(req.body.description);
    if (subject.length < 3) return errorResponse(res, 400, 'Subject is required (min 3 characters)');
    if (description.length < 10) return errorResponse(res, 400, 'Description is required (min 10 characters)');
    const category = String(req.body.category || '').trim();
    const priority = String(req.body.priority || 'medium').trim();
    if (!TICKET_CATEGORIES.includes(category)) return errorResponse(res, 400, 'Invalid category');
    if (!TICKET_PRIORITIES.includes(priority)) return errorResponse(res, 400, 'Invalid priority');
    let attachments = [];
    try {
      attachments = validateAttachmentPathsForSchool(req.body.attachments, schoolId);
    } catch (e) {
      return errorResponse(res, 400, e.message);
    }

    const ticketNumber = await generateTicketNumber();

    const initialMessage = buildMessageEntry([], {
      sender_type: 'school_admin',
      sender_user_id: userId,
      sender_name: name,
      message: description,
      is_internal_note: false,
    });

    const attachmentEntries = buildAttachmentEntries([], attachments, {
      message_id: initialMessage.id,
      school_id: schoolId,
      uploaded_by_type: 'school_admin',
      uploaded_by_id: userId,
    });

    const initialHistory = buildStatusHistoryEntry([], {
      from_status: null,
      to_status: 'open',
      changed_by_type: 'school_admin',
      changed_by_id: userId,
      changed_by_name: name,
      note: 'Ticket created',
    });

    const ins = await masterQuery(
      `INSERT INTO support_tickets
        (ticket_number, school_id, created_by_user_id,
         subject, description, category, priority, status,
         messages, attachments, status_history)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open',
               $8::jsonb, $9::jsonb, $10::jsonb)
       RETURNING id, ticket_number, school_id, created_by_user_id, subject, description, category,
                 priority, status, created_at, updated_at`,
      [
        ticketNumber,
        schoolId,
        userId,
        subject,
        description,
        category,
        priority,
        JSON.stringify([initialMessage]),
        JSON.stringify(attachmentEntries),
        JSON.stringify([initialHistory]),
      ]
    );

    return success(res, 201, 'Support ticket created', ins.rows[0]);
  } catch (err) {
    console.error('createTicket error:', err);
    return errorResponse(res, 500, 'Failed to create ticket');
  }
};

const getTicketById = async (req, res) => {
  try {
    const { schoolId } = getSchoolAdminContext(req);
    if (!schoolId) return errorResponse(res, 401, 'School context required');
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid ticket id');

    const r = await masterQuery(
      `SELECT t.* FROM support_tickets t
       WHERE t.id = $1 AND t.school_id = $2 AND t.deleted_at IS NULL`,
      [id, schoolId]
    );
    if (!r.rows?.length) return errorResponse(res, 404, 'Ticket not found');

    const row = r.rows[0];
    const scopedRow = {
      ...row,
      attachments: parseJsonArray(row.attachments).filter(
        (a) => Number(a.school_id) === Number(schoolId)
      ),
    };
    return success(res, 200, 'Ticket fetched', normalizeTicketDetail(scopedRow));
  } catch (err) {
    console.error('getTicketById error:', err);
    return errorResponse(res, 500, 'Failed to load ticket');
  }
};

const replyToTicket = async (req, res) => {
  try {
    const { schoolId, userId, name } = getSchoolAdminContext(req);
    if (!schoolId || !userId) return errorResponse(res, 401, 'School context required');
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid ticket id');

    const ticketR = await masterQuery(
      `SELECT id, status, messages, attachments FROM support_tickets
       WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL`,
      [id, schoolId]
    );
    if (!ticketR.rows?.length) return errorResponse(res, 404, 'Ticket not found');
    const ticket = ticketR.rows[0];
    if (ticket.status === 'closed') {
      return errorResponse(res, 400, 'Cannot reply to a closed ticket');
    }

    const message = sanitizeChatText(req.body.message);
    if (!message) return errorResponse(res, 400, 'Message cannot be empty');
    let attachments = [];
    try {
      attachments = validateAttachmentPathsForSchool(req.body.attachments, schoolId);
    } catch (e) {
      return errorResponse(res, 400, e.message);
    }

    const msgEntry = buildMessageEntry(ticket.messages, {
      sender_type: 'school_admin',
      sender_user_id: userId,
      sender_name: name,
      message,
      is_internal_note: false,
    });

    const attEntries = buildAttachmentEntries(ticket.attachments, attachments, {
      message_id: msgEntry.id,
      school_id: schoolId,
      uploaded_by_type: 'school_admin',
      uploaded_by_id: userId,
    });

    let newStatus = ticket.status;
    if (ticket.status === 'waiting_for_response' || ticket.status === 'resolved') {
      newStatus = 'open';
    }

    await masterQuery(
      `UPDATE support_tickets
       SET messages = COALESCE(messages, '[]'::jsonb) || $2::jsonb,
           attachments = COALESCE(attachments, '[]'::jsonb) || $3::jsonb,
           last_reply_at = NOW(),
           last_reply_by = 'school_admin',
           updated_at = NOW(),
           status = $4
       WHERE id = $1`,
      [id, JSON.stringify([msgEntry]), JSON.stringify(attEntries), newStatus]
    );

    if (newStatus !== ticket.status) {
      await recordStatusHistory(masterQuery, id, ticket.status, newStatus, {
        changed_by_type: 'school_admin',
        changed_by_id: userId,
        changed_by_name: name,
        note: 'Reopened by school reply',
      });
    }

    return success(res, 201, 'Reply sent', { message_id: msgEntry.id });
  } catch (err) {
    console.error('replyToTicket error:', err);
    return errorResponse(res, 500, 'Failed to send reply');
  }
};

const getTicketMeta = async (req, res) => {
  const { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_CATEGORY_LABELS, TICKET_PRIORITY_LABELS } = require('../config/supportConstants');
  return success(res, 200, 'Ticket metadata', {
    categories: TICKET_CATEGORIES.map((k) => ({ value: k, label: TICKET_CATEGORY_LABELS[k] })),
    priorities: TICKET_PRIORITIES.map((k) => ({ value: k, label: TICKET_PRIORITY_LABELS[k] })),
    statuses: TICKET_STATUSES,
  });
};

module.exports = {
  listTickets,
  createTicket,
  getTicketById,
  replyToTicket,
  getTicketMeta,
};
