/**
 * School / tenant id from authenticated session only (never from client body).
 * @param {import('express').Request} req
 * @returns {number|null}
 */
function getSchoolIdFromRequest(req) {
  const fromUser = req.user?.school_id;
  const fromTenant = req.tenant?.school_id;
  const raw = fromUser != null ? fromUser : fromTenant;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** URL segment: `12` or `school_12` */
function parseSchoolKey(key) {
  const s = String(key || '').trim();
  const m = /^school_(\d+)$/i.exec(s);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(s, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return null;
}

module.exports = { getSchoolIdFromRequest, parseSchoolKey };
