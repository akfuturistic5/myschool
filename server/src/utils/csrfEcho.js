const crypto = require('crypto');
const { success } = require('./responseHelper');
const { secureCookieBase } = require('./cookiePolicy');

function getCsrfCookieOptions() {
  const { sameSite, secure } = secureCookieBase();
  return {
    httpOnly: false,
    secure,
    sameSite,
    path: '/',
  };
}

/**
 * GET handler for credentialed SPAs on a different origin than the API.
 * JS cannot read XSRF-TOKEN via document.cookie for cross-site cookies; the client
 * calls this with credentials:include and uses the returned csrfToken as X-XSRF-TOKEN.
 */
function echoCsrfToken(req, res) {
  let token = req.cookies?.['XSRF-TOKEN'];
  if (!token) {
    token = crypto.randomBytes(16).toString('base64url');
    res.cookie('XSRF-TOKEN', token, getCsrfCookieOptions());
  }
  return success(res, 200, 'OK', { csrfToken: token });
}

module.exports = { echoCsrfToken, getCsrfCookieOptions };
