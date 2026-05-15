const fs = require('fs');
const path = require('path');
const { sanitizeTenant, sanitizeFilename } = require('./schoolLogoStorage');

function getDefaultStaffDocsRoot() {
  return path.resolve(process.cwd(), 'uploads', 'staff-documents');
}

function getConfiguredStaffDocsRoot() {
  const configured = String(process.env.STAFF_DOCUMENTS_STORAGE_ROOT || '').trim();
  if (!configured) return getDefaultStaffDocsRoot();
  return path.resolve(configured);
}

function ensureTenantStaffDocDir(tenant) {
  const safeTenant = sanitizeTenant(tenant) || 'default_tenant';
  const dir = path.join(getConfiguredStaffDocsRoot(), safeTenant);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * @param {string} storedRelative "{tenant}/{filename}" as stored in DB
 */
function resolveStaffDocumentPath(storedRelative) {
  if (!storedRelative || typeof storedRelative !== 'string') return null;
  const idx = storedRelative.indexOf('/');
  if (idx < 1) return null;
  const safeTenant = sanitizeTenant(storedRelative.slice(0, idx));
  const rawFile = storedRelative.slice(idx + 1);
  const safeFile = sanitizeFilename(rawFile);
  if (!safeTenant || !safeFile) return null;
  const rootTenant = path.resolve(path.join(getConfiguredStaffDocsRoot(), safeTenant));
  const fullResolved = path.resolve(path.join(rootTenant, safeFile));
  if (!fullResolved.startsWith(rootTenant + path.sep) && fullResolved !== rootTenant) return null;
  return fullResolved;
}

module.exports = {
  ensureTenantStaffDocDir,
  resolveStaffDocumentPath,
  getConfiguredStaffDocsRoot,
  sanitizeTenant,
  sanitizeFilename,
};
