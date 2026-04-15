const isProduction = process.env.NODE_ENV === 'production';

/**
 * SameSite for auth + CSRF cookies.
 *
 * Split production (SPA on host A, API on host B) needs SameSite=None; Secure so that
 * credentialed fetch/XHR from the SPA includes cookies. Default Lax does NOT send them on
 * cross-site subrequests — login succeeds (Set-Cookie) then /auth/me returns 401 → "instant logout".
 * Localhost different ports are still same-site, so dev keeps working with Lax.
 *
 * Override anytime with COOKIE_SAME_SITE=strict|lax|none
 */
function resolveSameSite() {
  const configured = String(process.env.COOKIE_SAME_SITE || '').trim().toLowerCase();
  if (configured === 'strict') return 'strict';
  if (configured === 'lax') return 'lax';
  if (configured === 'none') return isProduction ? 'none' : 'lax';

  const allowCrossSite = String(process.env.ALLOW_CROSS_SITE_COOKIES || '').toLowerCase() === 'true';
  if (allowCrossSite) return isProduction ? 'none' : 'lax';

  // Production + explicit CORS allowlist ⇒ almost always a cross-origin SPA; None is required for session cookies.
  const corsConfigured = String(process.env.CORS_ORIGIN || '').trim().length > 0;
  if (isProduction && corsConfigured) return 'none';

  return 'lax';
}

function secureCookieBase() {
  const sameSite = resolveSameSite();
  const secure = isProduction || sameSite === 'none';
  return { sameSite, secure };
}

module.exports = {
  secureCookieBase,
};
