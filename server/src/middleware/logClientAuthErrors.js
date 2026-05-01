/**
 * Log 401/403 API responses to the console with the JSON reason (message/code).
 * Catches both errorResponse() and raw res.status(401|403).json({...}).
 * Disable with env LOG_HTTP_401_403=false (or 0).
 */

function isLoggingDisabled() {
  const v = String(process.env.LOG_HTTP_401_403 || 'true').toLowerCase();
  return v === 'false' || v === '0' || v === 'no';
}

function clientIp(req) {
  const ff = req.headers['x-forwarded-for'];
  if (typeof ff === 'string' && ff.trim()) return ff.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || '-';
}

function payloadReason(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') return payload;
  if (typeof payload === 'object') {
    if (typeof payload.message === 'string' && payload.message) return payload.message;
    if (typeof payload.error === 'string' && payload.error) return payload.error;
    try {
      return JSON.stringify(payload).slice(0, 500);
    } catch {
      return '[unserializable]';
    }
  }
  return String(payload);
}

function logLine(req, res, statusCode, payload) {
  if (statusCode !== 401 && statusCode !== 403) return;
  if (isLoggingDisabled()) return;

  const reason = payloadReason(payload);
  const errCode =
    payload && typeof payload === 'object'
      ? payload.errorCode || payload.code || (payload.status === 'ERROR' ? 'ERROR' : null)
      : null;
  const who =
    req.user != null
      ? `userId=${req.user.id ?? '-'} user=${String(req.user.username || req.user.email || '-').slice(0, 80)}`
      : req.superAdmin != null
        ? `superAdminId=${req.superAdmin.id ?? '-'}`
        : 'user=anonymous';
  const authHint = (() => {
    const a = req.headers.authorization;
    if (!a) return 'auth=none';
    if (a.startsWith('Bearer ')) return 'auth=bearer(len=' + a.slice(7).trim().length + ')';
    return 'auth=other';
  })();

  console.warn(
    `[http ${statusCode}] ${req.method} ${req.originalUrl} reason=${JSON.stringify(reason)} ` +
      `code=${errCode != null && errCode !== '' ? errCode : '-'} ${who} ${authHint} ip=${clientIp(req)}`
  );
}

/**
 * Mount after express.json() / cookieParser, before routes.
 */
function logClientAuthErrors(req, res, next) {
  const origJson = res.json.bind(res);
  res.json = function (payload) {
    logLine(req, res, res.statusCode, payload);
    return origJson.call(this, payload);
  };
  next();
}

module.exports = { logClientAuthErrors };
