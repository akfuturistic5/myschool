/**
 * Server-side list pagination from query string.
 * Supports: page (or p), page_size (or pageSize). Max page size 100.
 */
function parsePagination(query, defaultPageSize = 10) {
  const rawPage = query.page != null ? query.page : query.p;
  const page = Math.max(1, parseInt(String(rawPage ?? '1'), 10) || 1);
  const rawSize = query.page_size != null ? query.page_size : query.pageSize;
  const parsedSize = parseInt(String(rawSize ?? String(defaultPageSize)), 10);
  const pageSize = Math.min(100, Math.max(1, Number.isFinite(parsedSize) ? parsedSize : defaultPageSize));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, limit: pageSize, offset };
}

function listMeta(total, page, pageSize) {
  const t = Number(total) || 0;
  const ps = Math.max(1, pageSize);
  const p = Math.max(1, page);
  return {
    page: p,
    pageSize: ps,
    total: t,
    totalPages: t === 0 ? 0 : Math.ceil(t / ps),
  };
}

/**
 * Server-side ORDER BY from sort_by / sort_order query params.
 * @param {object} query - req.query
 * @param {Record<string, string>} fieldToSql - whitelist: API field name -> SQL expression (already qualified)
 * @param {string} defaultField - key in fieldToSql when sort_by missing or invalid
 * @param {string} tieBreaker - e.g. "i.id DESC"
 * @returns {string} full "ORDER BY ..." clause
 */
function buildOrderClause(query, fieldToSql, defaultField, tieBreaker, defaultOrder = 'desc') {
  const raw = query.sort_by != null ? String(query.sort_by).trim() : '';
  const qo = query.sort_order != null ? String(query.sort_order).trim().toLowerCase() : '';
  const fallback = defaultOrder === 'asc' ? 'ASC' : 'DESC';
  const ord =
    qo === 'asc' ? 'ASC' : qo === 'desc' ? 'DESC' : fallback;
  const keys = Object.keys(fieldToSql);
  const field = keys.includes(raw) ? raw : defaultField;
  const col = fieldToSql[field] || fieldToSql[defaultField];
  return `ORDER BY ${col} ${ord}, ${tieBreaker}`;
}

module.exports = { parsePagination, listMeta, buildOrderClause };
