const { masterQuery } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { sanitizeHelpContent, sanitizeChatText } = require('../utils/htmlSanitize');
const { escapeIlikePattern } = require('../utils/supportTicketUtils');

const listCategories = async (req, res) => {
  try {
    const r = await masterQuery(
      `SELECT c.id, c.slug, c.name, c.description, c.sort_order,
              COUNT(a.id) FILTER (WHERE a.status = 'published' AND a.deleted_at IS NULL) AS article_count
       FROM help_categories c
       LEFT JOIN help_articles a ON a.category_id = c.id
       WHERE c.is_active = TRUE
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.name ASC`
    );
    return success(res, 200, 'Categories fetched', r.rows || []);
  } catch (err) {
    console.error('listCategories error:', err);
    return errorResponse(res, 500, 'Failed to load categories');
  }
};

const listArticles = async (req, res) => {
  try {
    const categorySlug = req.query.category ? String(req.query.category).trim() : '';
    const params = [];
    let where = `a.status = 'published' AND a.deleted_at IS NULL`;
    if (categorySlug) {
      params.push(categorySlug);
      where += ` AND c.slug = $${params.length}`;
    }
    const r = await masterQuery(
      `SELECT a.id, a.title, a.description, a.sort_order,
              a.updated_at, a.published_at,
              c.id AS category_id, c.slug AS category_slug, c.name AS category_name
       FROM help_articles a
       JOIN help_categories c ON c.id = a.category_id
       WHERE ${where}
       ORDER BY c.sort_order ASC, a.sort_order ASC, a.title ASC`,
      params
    );
    return success(res, 200, 'Articles fetched', r.rows || []);
  } catch (err) {
    console.error('listArticles error:', err);
    return errorResponse(res, 500, 'Failed to load articles');
  }
};

const getArticleById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) return errorResponse(res, 400, 'Invalid article id');
    const r = await masterQuery(
      `SELECT a.id, a.title, a.description, a.content, a.updated_at, a.published_at,
              c.id AS category_id, c.slug AS category_slug, c.name AS category_name
       FROM help_articles a
       JOIN help_categories c ON c.id = a.category_id
       WHERE a.id = $1 AND a.status = 'published' AND a.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );
    if (!r.rows?.length) return errorResponse(res, 404, 'Article not found');
    const row = r.rows[0];
    row.content = sanitizeHelpContent(row.content);
    const related = await masterQuery(
      `SELECT id, title, description, updated_at
       FROM help_articles
       WHERE category_id = $1 AND id <> $2 AND status = 'published' AND deleted_at IS NULL
       ORDER BY sort_order ASC, title ASC
       LIMIT 5`,
      [row.category_id, row.id]
    );
    return success(res, 200, 'Article fetched', {
      ...row,
      related_articles: related.rows || [],
    });
  } catch (err) {
    console.error('getArticleById error:', err);
    return errorResponse(res, 500, 'Failed to load article');
  }
};

const listFaqs = async (req, res) => {
  try {
    const category = req.query.category ? String(req.query.category).trim() : '';
    const params = [];
    let where = 'is_active = TRUE';
    if (category) {
      params.push(category);
      where += ` AND category_slug = $${params.length}`;
    }
    const r = await masterQuery(
      `SELECT id, category_slug, question, answer, sort_order, updated_at
       FROM help_faqs
       WHERE ${where}
       ORDER BY sort_order ASC, id ASC`,
      params
    );
    const rows = (r.rows || []).map((f) => ({
      ...f,
      answer: sanitizeHelpContent(f.answer),
    }));
    return success(res, 200, 'FAQs fetched', rows);
  } catch (err) {
    console.error('listFaqs error:', err);
    return errorResponse(res, 500, 'Failed to load FAQs');
  }
};

const searchHelpCenter = async (req, res) => {
  try {
    const q = sanitizeChatText(req.query.q || '').slice(0, 200);
    const type = String(req.query.type || 'all').toLowerCase();
    const category = req.query.category ? String(req.query.category).trim() : '';
    if (!q || q.length < 2) {
      return success(res, 200, 'Search results', { articles: [], faqs: [], suggestions: [] });
    }
    const pattern = `%${escapeIlikePattern(q)}%`;
    const params = [pattern];
    let catFilterArticles = '';
    let catFilterFaqs = '';
    if (category) {
      params.push(category);
      catFilterArticles = ` AND c.slug = $${params.length}`;
      catFilterFaqs = ` AND category_slug = $${params.length}`;
    }

    const articles = type === 'faqs' ? [] : (
      await masterQuery(
        `SELECT a.id, a.title, a.description, 'article' AS result_type,
                c.slug AS category_slug, c.name AS category_name
         FROM help_articles a
         JOIN help_categories c ON c.id = a.category_id
         WHERE a.status = 'published' AND a.deleted_at IS NULL
           AND (
             a.title ILIKE $1 ESCAPE '\\'
             OR a.description ILIKE $1 ESCAPE '\\'
             OR a.content ILIKE $1 ESCAPE '\\'
           )${catFilterArticles}
         ORDER BY a.title ASC
         LIMIT 30`,
        params
      )
    ).rows || [];

    const faqs = type === 'articles' ? [] : (
      await masterQuery(
        `SELECT id, question AS title, answer AS description, category_slug,
                'faq' AS result_type
         FROM help_faqs
         WHERE is_active = TRUE
           AND (question ILIKE $1 ESCAPE '\\' OR answer ILIKE $1 ESCAPE '\\')
           ${catFilterFaqs}
         ORDER BY sort_order ASC
         LIMIT 20`,
        params
      )
    ).rows || [];

    const suggestions = [
      ...articles.slice(0, 5).map((a) => ({ type: 'article', label: a.title, id: a.id })),
      ...faqs.slice(0, 3).map((f) => ({ type: 'faq', label: f.title, id: f.id })),
    ];

    return success(res, 200, 'Search results', {
      articles,
      faqs,
      suggestions,
      query: q,
    });
  } catch (err) {
    console.error('searchHelpCenter error:', err);
    return errorResponse(res, 500, 'Search failed');
  }
};

module.exports = {
  listCategories,
  listArticles,
  getArticleById,
  listFaqs,
  searchHelpCenter,
};
