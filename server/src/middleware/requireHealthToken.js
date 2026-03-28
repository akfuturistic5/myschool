/**
 * Protects /api/health/* from unauthenticated reconnaissance.
 * Set HEALTH_CHECK_TOKEN (or legacy TENANT_HEALTH_TOKEN). Send header X-Health-Check-Token.
 * In non-production, if no token is configured, checks are allowed (local dev).
 */
function requireHealthToken(req, res, next) {
  const expected = (
    process.env.HEALTH_CHECK_TOKEN ||
    process.env.TENANT_HEALTH_TOKEN ||
    ''
  )
    .toString()
    .trim();
  const got = (
    req.headers['x-health-check-token'] ||
    req.headers['x-tenant-health-token'] ||
    ''
  )
    .toString()
    .trim();

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        status: 'ERROR',
        message: 'Health check is not configured',
      });
    }
    return next();
  }

  if (got !== expected) {
    return res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
  }
  return next();
}

module.exports = { requireHealthToken };
