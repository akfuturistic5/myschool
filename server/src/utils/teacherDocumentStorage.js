const fs = require('fs');
const path = require('path');
const { sanitizeTenant, sanitizeFilename } = require('./schoolLogoStorage');

function getDefaultTeacherDocsRoot() {
  return path.resolve(process.cwd(), 'uploads', 'teacher-documents');
}

function getConfiguredTeacherDocsRoot() {
  const configured = String(process.env.TEACHER_DOCUMENTS_STORAGE_ROOT || '').trim();
  if (!configured) return getDefaultTeacherDocsRoot();
  return path.resolve(configured);
}

function ensureTenantTeacherDocDir(tenant) {
  const safeTenant = sanitizeTenant(tenant) || 'default_tenant';
  const dir = path.join(getConfiguredTeacherDocsRoot(), safeTenant);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * @param {string} storedRelative "{tenant}/{filename}" as stored in DB
 */
function resolveTeacherDocumentPath(storedRelative) {
  if (!storedRelative || typeof storedRelative !== 'string') return null;
  const idx = storedRelative.indexOf('/');
  if (idx < 1) return null;
  const safeTenant = sanitizeTenant(storedRelative.slice(0, idx));
  const rawFile = storedRelative.slice(idx + 1);
  const safeFile = sanitizeFilename(rawFile);
  if (!safeTenant || !safeFile) return null;
  const rootTenant = path.resolve(path.join(getConfiguredTeacherDocsRoot(), safeTenant));
  const fullResolved = path.resolve(path.join(rootTenant, safeFile));
  if (!fullResolved.startsWith(rootTenant + path.sep) && fullResolved !== rootTenant) return null;
  return fullResolved;
}

module.exports = {
  ensureTenantTeacherDocDir,
  resolveTeacherDocumentPath,
  getConfiguredTeacherDocsRoot,
  sanitizeTenant,
  sanitizeFilename,
};
