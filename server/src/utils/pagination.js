/**
 * Pagination helper - parses page and limit from query params
 * @param {object} query - req.query
 * @returns {{ page: number, limit: number, offset: number }}
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

module.exports = { parsePagination };
