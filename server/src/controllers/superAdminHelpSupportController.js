const { masterQuery } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { parsePagination, listMeta, buildOrderClause } = require('../utils/accountsPagination');
const { sanitizeChatText, sanitizeHelpContent } = require('../utils/htmlSanitize');
const { writeSuperAdminAudit } = require('../utils/superAdminSecurity');
const {
  recordStatusHistory,
  escapeIlikePattern,
  safeAttachmentFileName,
  isValidHelpSlug,
} = require('../utils/supportTicketUtils');
const { HELP_ARTICLE_STATUSES } = require('../config/supportConstants');
const { TICKET_STATUSES, TICKET_PRIORITIES } = require('../config/supportConstants');
const { getStorageProvider } = require('../storage');
const { parseRelativeKey } = require('../storage/LocalFilesystemStorageProvider');
const path = require('path');

// ——— Help CMS ———

/** Global unique sort_order among non-deleted articles (exclude id when editing). */
async function assertArticleSortOrderAvailable(res, sortOrder, excludeArticleId = null) {
  const order = Number(sortOrder);
  if (!Number.isInteger(order) || order < 1) {
    errorResponse(res, 400, 'Sort order must be at least 1 (0 is not allowed)');
    return false;
  }
  const params = [order];
  let sql = `SELECT id, title FROM help_articles WHERE sort_order = $1 AND deleted_at IS NULL`;
  if (excludeArticleId != null) {
    sql += ` AND id <> $2`;
    params.push(excludeArticleId);
  }
  const r = await masterQuery(sql, params);
  if (r.rows?.length) {
    errorResponse(
      res,
      409,
      `Sort order ${order} is already used by article "${r.rows[0].title}". Choose a different value.`
    );
    return false;
  }
  return true;
}

/** Global unique sort_order among FAQs (exclude id when editing). */
async function assertFaqSortOrderAvailable(res, sortOrder, excludeFaqId = null) {
  const order = Number(sortOrder);
  if (!Number.isInteger(order) || order < 1) {
    errorResponse(res, 400, 'Sort order must be at least 1 (0 is not allowed)');
    return false;
  }
  const params = [order];
  let sql = `SELECT id, question FROM help_faqs WHERE sort_order = $1`;
  if (excludeFaqId != null) {
    sql += ` AND id <> $2`;
    params.push(excludeFaqId);
  }
  const r = await masterQuery(sql, params);
  if (r.rows?.length) {
    const label = String(r.rows[0].question).slice(0, 80);
    errorResponse(
      res,
      409,
      `Sort order ${order} is already used by FAQ "${label}". Choose a different value.`
    );
    return false;
  }
  return true;
}

/** Global unique sort_order among help categories (exclude id when editing). */
async function assertCategorySortOrderAvailable(res, sortOrder, excludeCategoryId = null) {
  const order = Number(sortOrder);
  if (!Number.isInteger(order) || order < 1) {
    errorResponse(res, 400, 'Sort order must be at least 1 (0 is not allowed)');
    return false;
  }
  const params = [order];
  let sql = `SELECT id, name FROM help_categories WHERE sort_order = $1`;
  if (excludeCategoryId != null) {
    sql += ` AND id <> $2`;
    params.push(excludeCategoryId);
  }
  const r = await masterQuery(sql, params);
  if (r.rows?.length) {
    errorResponse(
      res,
      409,
      `Sort order ${order} is already used by topic "${r.rows[0].name}". Choose a different value.`
    );
    return false;
  }
  return true;
}

const listHelpCategoriesAdmin = async (req, res) => {
  try {
    const r = await masterQuery(
      `SELECT c.*,
              COUNT(a.id) FILTER (WHERE a.deleted_at IS NULL) AS article_count,
              COUNT(a.id) AS linked_article_count
       FROM help_categories c
       LEFT JOIN help_articles a ON a.category_id = c.id
       GROUP BY c.id ORDER BY c.sort_order ASC`
    );
    return success(res, 200, 'Categories fetched', r.rows || []);
  } catch (err) {
    console.error('listHelpCategoriesAdmin:', err);
    return errorResponse(res, 500, 'Failed to load categories');
  }
};

const listHelpArticlesAdmin = async (req, res) => {
  try {
    const r = await masterQuery(
      `SELECT a.id, a.title, a.status, a.sort_order, a.updated_at,
              c.name AS category_name, c.slug AS category_slug
       FROM help_articles a
       JOIN help_categories c ON c.id = a.category_id
       WHERE a.deleted_at IS NULL
       ORDER BY a.sort_order ASC, c.sort_order ASC, a.title ASC`
    );
    return success(res, 200, 'Articles fetched', r.rows || []);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to load articles');
  }
};

const createHelpArticle = async (req, res) => {
  try {
    const b = req.body;
    const cat = await masterQuery(`SELECT id FROM help_categories WHERE id = $1`, [b.category_id]);
    if (!cat.rows?.length) return errorResponse(res, 400, 'Invalid category');
    const content = sanitizeHelpContent(b.content);
    const status = b.status || 'draft';
    const sortOrder = Number(b.sort_order);
    if (!(await assertArticleSortOrderAvailable(res, sortOrder))) return;
    const publishedAt = status === 'published' ? new Date() : null;
    const ins = await masterQuery(
      `INSERT INTO help_articles
        (category_id, title, description, content, status, sort_order,
         created_by_super_admin_id, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, status`,
      [
        b.category_id,
        sanitizeChatText(b.title),
        sanitizeChatText(b.description || ''),
        content,
        status,
        sortOrder,
        req.superAdmin?.id ?? null,
        publishedAt,
      ]
    );
    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'help_article_created',
      resourceType: 'help_article',
      resourceId: String(ins.rows[0].id),
      req,
    });
    return success(res, 201, 'Article created', ins.rows[0]);
  } catch (err) {
    console.error('createHelpArticle:', err);
    return errorResponse(res, 500, 'Failed to create article');
  }
};

const listFaqsAdmin = async (req, res) => {
  try {
    const r = await masterQuery(`SELECT * FROM help_faqs ORDER BY sort_order ASC, id ASC`);
    return success(res, 200, 'FAQs fetched', r.rows || []);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to load FAQs');
  }
};

const createFaq = async (req, res) => {
  try {
    const b = req.body;
    const sortOrder = Number(b.sort_order);
    if (!(await assertFaqSortOrderAvailable(res, sortOrder))) return;
    const ins = await masterQuery(
      `INSERT INTO help_faqs (category_slug, question, answer, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        b.category_slug || null,
        sanitizeChatText(b.question),
        sanitizeHelpContent(b.answer),
        sortOrder,
        b.is_active !== false,
      ]
    );
    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'help_faq_created',
      resourceType: 'help_faq',
      resourceId: String(ins.rows[0].id),
      req,
    });
    return success(res, 201, 'FAQ created', ins.rows[0]);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to create FAQ');
  }
};

const createHelpCategory = async (req, res) => {
  try {
    const b = req.body;
    const slug = String(b.slug).trim().toLowerCase();
    if (!isValidHelpSlug(slug)) {
      return errorResponse(res, 400, 'Invalid slug (use lowercase letters, numbers, hyphens)');
    }
    const sortOrder = Number(b.sort_order);
    if (!(await assertCategorySortOrderAvailable(res, sortOrder))) return;
    const ins = await masterQuery(
      `INSERT INTO help_categories (slug, name, description, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        slug,
        sanitizeChatText(b.name),
        sanitizeChatText(b.description || ''),
        sortOrder,
        b.is_active !== false,
      ]
    );
    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'help_category_created',
      resourceType: 'help_category',
      resourceId: String(ins.rows[0].id),
      req,
    });
    return success(res, 201, 'Category created', ins.rows[0]);
  } catch (err) {
    if (err.code === '23505') return errorResponse(res, 409, 'Category slug already exists');
    console.error('createHelpCategory:', err);
    return errorResponse(res, 500, 'Failed to create category');
  }
};

const patchHelpCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid category id');
    const b = req.body;
    const updates = [];
    const params = [];
    let p = 0;

    if (b.slug !== undefined) {
      const slug = String(b.slug).trim().toLowerCase();
      if (!isValidHelpSlug(slug)) {
        return errorResponse(res, 400, 'Invalid slug');
      }
      p += 1;
      updates.push(`slug = $${p}`);
      params.push(slug);
    }
    if (b.name !== undefined) {
      p += 1;
      updates.push(`name = $${p}`);
      params.push(sanitizeChatText(b.name));
    }
    if (b.description !== undefined) {
      p += 1;
      updates.push(`description = $${p}`);
      params.push(sanitizeChatText(b.description || ''));
    }
    if (b.sort_order !== undefined) {
      if (!(await assertCategorySortOrderAvailable(res, b.sort_order, id))) return;
      p += 1;
      updates.push(`sort_order = $${p}`);
      params.push(b.sort_order);
    }
    if (b.is_active !== undefined) {
      p += 1;
      updates.push(`is_active = $${p}`);
      params.push(Boolean(b.is_active));
    }
    if (!updates.length) return errorResponse(res, 400, 'No updates provided');

    updates.push('updated_at = NOW()');
    p += 1;
    params.push(id);

    const r = await masterQuery(
      `UPDATE help_categories SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`,
      params
    );
    if (!r.rows?.length) return errorResponse(res, 404, 'Category not found');

    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'help_category_updated',
      resourceType: 'help_category',
      resourceId: String(id),
      details: b,
      req,
    });
    return success(res, 200, 'Category updated', r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return errorResponse(res, 409, 'Category slug already exists');
    console.error('patchHelpCategory:', err);
    return errorResponse(res, 500, 'Failed to update category');
  }
};

const deleteHelpCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid category id');

    const countR = await masterQuery(
      `SELECT
         COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active_n,
         COUNT(*)::int AS total_n
       FROM help_articles
       WHERE category_id = $1`,
      [id]
    );
    const activeCount = countR.rows?.[0]?.active_n ?? 0;
    const totalCount = countR.rows?.[0]?.total_n ?? 0;

    if (activeCount > 0) {
      await masterQuery(
        `UPDATE help_categories SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
        [id]
      );
      await writeSuperAdminAudit({
        superAdminId: req.superAdmin?.id,
        action: 'help_category_deactivated',
        resourceType: 'help_category',
        resourceId: String(id),
        details: { activeCount, totalCount },
        req,
      });
      return success(res, 200, 'Category deactivated (has active guide articles)', {
        id,
        deactivated: true,
      });
    }

    if (totalCount > 0) {
      await masterQuery(
        `DELETE FROM help_articles WHERE category_id = $1 AND deleted_at IS NOT NULL`,
        [id]
      );
    }

    const del = await masterQuery(`DELETE FROM help_categories WHERE id = $1 RETURNING id`, [id]);
    if (!del.rows?.length) return errorResponse(res, 404, 'Category not found');

    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'help_category_deleted',
      resourceType: 'help_category',
      resourceId: String(id),
      details: { removedArchivedArticles: totalCount - activeCount },
      req,
    });
    return success(res, 200, 'Category deleted', { id });
  } catch (err) {
    if (err.code === '23503') {
      try {
        const id = parseInt(req.params.id, 10);
        await masterQuery(
          `UPDATE help_categories SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
          [id]
        );
        return success(res, 200, 'Category deactivated (linked content exists)', {
          id,
          deactivated: true,
        });
      } catch (inner) {
        console.error('deleteHelpCategory deactivate fallback:', inner);
      }
    }
    console.error('deleteHelpCategory:', err);
    return errorResponse(res, 500, 'Failed to delete category');
  }
};

const getHelpArticleAdmin = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid article id');
    const r = await masterQuery(
      `SELECT a.*, c.name AS category_name, c.slug AS category_slug
       FROM help_articles a
       JOIN help_categories c ON c.id = a.category_id
       WHERE a.id = $1 AND a.deleted_at IS NULL`,
      [id]
    );
    if (!r.rows?.length) return errorResponse(res, 404, 'Article not found');
    return success(res, 200, 'Article fetched', r.rows[0]);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to load article');
  }
};

const patchHelpArticle = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid article id');
    const b = req.body;

    const cur = await masterQuery(`SELECT status, published_at FROM help_articles WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (!cur.rows?.length) return errorResponse(res, 404, 'Article not found');

    const updates = [];
    const params = [];
    let p = 0;

    if (b.category_id !== undefined) {
      const cat = await masterQuery(`SELECT id FROM help_categories WHERE id = $1`, [b.category_id]);
      if (!cat.rows?.length) return errorResponse(res, 400, 'Invalid category');
      p += 1;
      updates.push(`category_id = $${p}`);
      params.push(b.category_id);
    }
    if (b.title !== undefined) {
      p += 1;
      updates.push(`title = $${p}`);
      params.push(sanitizeChatText(b.title));
    }
    if (b.description !== undefined) {
      p += 1;
      updates.push(`description = $${p}`);
      params.push(sanitizeChatText(b.description || ''));
    }
    if (b.content !== undefined) {
      p += 1;
      updates.push(`content = $${p}`);
      params.push(sanitizeHelpContent(b.content));
    }
    if (b.status !== undefined) {
      if (!HELP_ARTICLE_STATUSES.includes(b.status)) {
        return errorResponse(res, 400, 'Invalid status');
      }
      p += 1;
      updates.push(`status = $${p}`);
      params.push(b.status);
      if (b.status === 'published' && !cur.rows[0].published_at) {
        updates.push('published_at = NOW()');
      }
    }
    if (b.sort_order !== undefined) {
      if (!(await assertArticleSortOrderAvailable(res, b.sort_order, id))) return;
      p += 1;
      updates.push(`sort_order = $${p}`);
      params.push(b.sort_order);
    }
    if (!updates.length) return errorResponse(res, 400, 'No updates provided');

    updates.push('updated_at = NOW()');
    p += 1;
    updates.push(`updated_by_super_admin_id = $${p}`);
    params.push(req.superAdmin?.id ?? null);
    p += 1;
    params.push(id);

    const r = await masterQuery(
      `UPDATE help_articles SET ${updates.join(', ')} WHERE id = $${p} AND deleted_at IS NULL RETURNING id, title, status`,
      params
    );
    if (!r.rows?.length) return errorResponse(res, 404, 'Article not found');

    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'help_article_updated',
      resourceType: 'help_article',
      resourceId: String(id),
      details: b,
      req,
    });
    return success(res, 200, 'Article updated', r.rows[0]);
  } catch (err) {
    console.error('patchHelpArticle:', err);
    return errorResponse(res, 500, 'Failed to update article');
  }
};

const deleteHelpArticle = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid article id');
    const r = await masterQuery(
      `UPDATE help_articles SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id]
    );
    if (!r.rows?.length) return errorResponse(res, 404, 'Article not found');
    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'help_article_deleted',
      resourceType: 'help_article',
      resourceId: String(id),
      req,
    });
    return success(res, 200, 'Article deleted', { id });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to delete article');
  }
};

const patchFaq = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid FAQ id');
    const b = req.body;
    const updates = [];
    const params = [];
    let p = 0;

    if (b.category_slug !== undefined) {
      p += 1;
      updates.push(`category_slug = $${p}`);
      params.push(b.category_slug ? String(b.category_slug).trim() : null);
    }
    if (b.question !== undefined) {
      p += 1;
      updates.push(`question = $${p}`);
      params.push(sanitizeChatText(b.question));
    }
    if (b.answer !== undefined) {
      p += 1;
      updates.push(`answer = $${p}`);
      params.push(sanitizeHelpContent(b.answer));
    }
    if (b.sort_order !== undefined) {
      if (!(await assertFaqSortOrderAvailable(res, b.sort_order, id))) return;
      p += 1;
      updates.push(`sort_order = $${p}`);
      params.push(b.sort_order);
    }
    if (b.is_active !== undefined) {
      p += 1;
      updates.push(`is_active = $${p}`);
      params.push(Boolean(b.is_active));
    }
    if (!updates.length) return errorResponse(res, 400, 'No updates provided');

    updates.push('updated_at = NOW()');
    p += 1;
    params.push(id);

    const r = await masterQuery(
      `UPDATE help_faqs SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`,
      params
    );
    if (!r.rows?.length) return errorResponse(res, 404, 'FAQ not found');

    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'help_faq_updated',
      resourceType: 'help_faq',
      resourceId: String(id),
      details: b,
      req,
    });
    return success(res, 200, 'FAQ updated', r.rows[0]);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to update FAQ');
  }
};

const deleteFaq = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid FAQ id');
    const r = await masterQuery(`DELETE FROM help_faqs WHERE id = $1 RETURNING id`, [id]);
    if (!r.rows?.length) return errorResponse(res, 404, 'FAQ not found');
    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'help_faq_deleted',
      resourceType: 'help_faq',
      resourceId: String(id),
      req,
    });
    return success(res, 200, 'FAQ deleted', { id });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to delete FAQ');
  }
};

// ——— Support tickets (all schools) ———

const listAllTickets = async (req, res) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query, 15);
    const params = [];
    let where = 't.deleted_at IS NULL';

    if (req.query.status) {
      params.push(String(req.query.status));
      where += ` AND t.status = $${params.length}`;
    }
    if (req.query.priority) {
      params.push(String(req.query.priority));
      where += ` AND t.priority = $${params.length}`;
    }
    if (req.query.school_id) {
      const sid = parseInt(req.query.school_id, 10);
      if (!Number.isNaN(sid)) {
        params.push(sid);
        where += ` AND t.school_id = $${params.length}`;
      }
    }
    if (req.query.search) {
      const term = escapeIlikePattern(sanitizeChatText(req.query.search));
      if (term) {
        params.push(`%${term}%`);
        where += ` AND (t.subject ILIKE $${params.length} ESCAPE '\\' OR t.ticket_number ILIKE $${params.length} ESCAPE '\\' OR s.school_name ILIKE $${params.length} ESCAPE '\\')`;
      }
    }

    const countR = await masterQuery(
      `SELECT COUNT(*)::int AS total
       FROM support_tickets t
       JOIN schools s ON s.id = t.school_id
       WHERE ${where}`,
      params
    );
    const total = countR.rows?.[0]?.total ?? 0;

    const order = buildOrderClause(
      req.query,
      { created_at: 't.created_at', updated_at: 't.updated_at', priority: 't.priority' },
      'updated_at',
      't.id DESC',
      'desc'
    );

    const listR = await masterQuery(
      `SELECT t.id, t.ticket_number, t.subject, t.category, t.priority, t.status,
              t.created_at, t.updated_at, t.last_reply_at, t.last_reply_by,
              s.id AS school_id, s.school_name, s.institute_number
       FROM support_tickets t
       JOIN schools s ON s.id = t.school_id
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
    console.error('listAllTickets:', err);
    return errorResponse(res, 500, 'Failed to list tickets');
  }
};

const getTicketAdmin = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid ticket id');

    const r = await masterQuery(
      `SELECT t.*, s.school_name, s.institute_number
       FROM support_tickets t
       JOIN schools s ON s.id = t.school_id
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [id]
    );
    if (!r.rows?.length) return errorResponse(res, 404, 'Ticket not found');

    const { normalizeTicketDetailAdmin } = require('../utils/supportTicketJson');
    return success(res, 200, 'Ticket fetched', normalizeTicketDetailAdmin(r.rows[0]));
  } catch (err) {
    return errorResponse(res, 500, 'Failed to load ticket');
  }
};

const patchTicketAdmin = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid ticket id');

    const cur = await masterQuery(`SELECT status, priority FROM support_tickets WHERE id = $1`, [id]);
    if (!cur.rows?.length) return errorResponse(res, 404, 'Ticket not found');

    const updates = [];
    const params = [];
    let p = 0;
    const fromStatus = cur.rows[0].status;

    if (req.body.status) {
      if (!TICKET_STATUSES.includes(req.body.status)) {
        return errorResponse(res, 400, 'Invalid status');
      }
      p += 1;
      updates.push(`status = $${p}`);
      params.push(req.body.status);
      if (req.body.status === 'closed') {
        updates.push('closed_at = NOW()');
      } else if (fromStatus === 'closed') {
        updates.push('closed_at = NULL');
      }
    }
    if (!updates.length) return errorResponse(res, 400, 'No updates provided');

    updates.push('updated_at = NOW()');
    p += 1;
    params.push(id);

    const r = await masterQuery(
      `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`,
      params
    );

    if (req.body.status && req.body.status !== fromStatus) {
      await recordStatusHistory(masterQuery, id, fromStatus, req.body.status, {
        changed_by_type: 'super_admin',
        changed_by_id: req.superAdmin?.id,
        changed_by_name: req.superAdmin?.email || 'Support',
      });
    }

    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'support_ticket_updated',
      resourceType: 'support_ticket',
      resourceId: String(id),
      details: req.body,
      req,
    });

    return success(res, 200, 'Ticket updated', r.rows[0]);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to update ticket');
  }
};

const replyTicketAdmin = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return errorResponse(res, 400, 'Invalid ticket id');

    const ticketR = await masterQuery(
      `SELECT id, school_id, status FROM support_tickets WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!ticketR.rows?.length) return errorResponse(res, 404, 'Ticket not found');
    const ticket = ticketR.rows[0];

    const message = sanitizeChatText(req.body.message);
    if (!message) return errorResponse(res, 400, 'Message cannot be empty');
    const isInternal = Boolean(req.body.is_internal_note);
    const adminName = req.superAdmin?.email || 'Platform Support';

    const {
      buildMessageEntry,
    } = require('../utils/supportTicketJson');

    const ticketFull = await masterQuery(
      `SELECT messages FROM support_tickets WHERE id = $1`,
      [id]
    );
    const msgEntry = buildMessageEntry(ticketFull.rows?.[0]?.messages, {
      sender_type: 'super_admin',
      sender_super_admin_id: req.superAdmin?.id,
      sender_name: adminName,
      message,
      is_internal_note: isInternal,
    });
    const messageId = msgEntry.id;

    // Only auto-advance brand-new tickets; manual status (PATCH) is authoritative otherwise.
    let newStatus = ticket.status;
    if (!isInternal && ticket.status === 'open') {
      newStatus = 'in_progress';
    }

    await masterQuery(
      `UPDATE support_tickets
       SET messages = COALESCE(messages, '[]'::jsonb) || $2::jsonb,
           last_reply_at = NOW(),
           last_reply_by = 'super_admin',
           updated_at = NOW(),
           status = $3
       WHERE id = $1`,
      [id, JSON.stringify([msgEntry]), newStatus]
    );

    if (!isInternal && newStatus !== ticket.status) {
      await recordStatusHistory(masterQuery, id, ticket.status, newStatus, {
        changed_by_type: 'super_admin',
        changed_by_id: req.superAdmin?.id,
        changed_by_name: adminName,
      });
    }

    await writeSuperAdminAudit({
      superAdminId: req.superAdmin?.id,
      action: 'support_ticket_reply',
      resourceType: 'support_ticket',
      resourceId: String(id),
      req,
    });

    return success(res, 201, 'Reply sent', { message_id: messageId, status: newStatus });
  } catch (err) {
    console.error('replyTicketAdmin:', err);
    return errorResponse(res, 500, 'Failed to send reply');
  }
};

const downloadTicketAttachment = async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const attachmentId = parseInt(req.params.attachmentId, 10);
    if (Number.isNaN(ticketId) || Number.isNaN(attachmentId)) {
      return errorResponse(res, 400, 'Invalid ids');
    }

    const { findAttachmentById } = require('../utils/supportTicketJson');
    const ticketR = await masterQuery(
      `SELECT id, school_id, attachments FROM support_tickets WHERE id = $1 AND deleted_at IS NULL`,
      [ticketId]
    );
    if (!ticketR.rows?.length) return errorResponse(res, 404, 'Ticket not found');
    const att = findAttachmentById(ticketR.rows[0], attachmentId);
    if (!att) return errorResponse(res, 404, 'Attachment not found');

    const { file_path: relativePath, file_name: fileName, file_type: fileType } = att;
    const parsed = parseRelativeKey(relativePath);
    if (!parsed) return errorResponse(res, 400, 'Invalid file path');

    const provider = getStorageProvider();
    const exists = await provider.exists(relativePath);
    if (!exists) return errorResponse(res, 404, 'File not found');

    const buf = await provider.read(relativePath);
    const mime = fileType || provider.getMimeForPath(relativePath);
    const safeName = safeAttachmentFileName(fileName);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(buf);
  } catch (err) {
    if (err.code === 'ENOENT' || String(err.message || '').includes('Invalid storage')) {
      return errorResponse(res, 404, 'File not found');
    }
    console.error('downloadTicketAttachment:', err);
    return errorResponse(res, 500, 'Failed to download attachment');
  }
};

module.exports = {
  listHelpCategoriesAdmin,
  createHelpCategory,
  patchHelpCategory,
  deleteHelpCategory,
  listHelpArticlesAdmin,
  getHelpArticleAdmin,
  createHelpArticle,
  patchHelpArticle,
  deleteHelpArticle,
  listFaqsAdmin,
  createFaq,
  patchFaq,
  deleteFaq,
  listAllTickets,
  getTicketAdmin,
  patchTicketAdmin,
  replyTicketAdmin,
  downloadTicketAttachment,
};
