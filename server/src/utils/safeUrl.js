/**
 * Reject javascript:, data:, file: and only allow safe http(s) or relative paths.
 * Shared by file metadata and chat attachments.
 */
function isSafeFileOrLinkUrl(u) {
  if (u == null) return true;
  const s = String(u).trim();
  if (!s) return true;
  if (s.startsWith('/')) return true;
  const lower = s.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('file:')) {
    return false;
  }
  if (lower.startsWith('vbscript:')) return false;
  try {
    const url = new URL(s);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

module.exports = { isSafeFileOrLinkUrl };
