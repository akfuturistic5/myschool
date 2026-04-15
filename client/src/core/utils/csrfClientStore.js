/**
 * Cross-origin SPA (e.g. frontend on Render A, API on Render B): XSRF-TOKEN is set on the API
 * host and is not visible in document.cookie on the SPA origin. Server returns the token in
 * login JSON and via GET .../csrf-token; we cache it here for X-XSRF-TOKEN on unsafe methods.
 */
let cachedCsrfToken = null;

export function setCachedCsrfToken(token) {
  cachedCsrfToken = token ? String(token) : null;
}

export function clearCachedCsrfToken() {
  cachedCsrfToken = null;
}

export function resolveCsrfTokenForRequest() {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}
