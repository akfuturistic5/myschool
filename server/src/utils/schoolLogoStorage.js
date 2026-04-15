const fs = require('fs');
const path = require('path');

function sanitizeTenant(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function sanitizeFilename(value) {
  return path.basename(String(value || '')).replace(/[^a-zA-Z0-9._-]/g, '');
}

function getDefaultStorageRoot() {
  return path.resolve(process.cwd(), 'uploads', 'school-logos');
}

function getLegacyStorageRoots() {
  return [
    getDefaultStorageRoot(),
    path.resolve(__dirname, '../../uploads/school-logos'),
  ];
}

function getConfiguredStorageRoot() {
  const configured = String(process.env.SCHOOL_LOGO_STORAGE_ROOT || '').trim();
  if (!configured) return getDefaultStorageRoot();
  return path.resolve(configured);
}

function ensureTenantLogoDir(tenant) {
  const safeTenant = sanitizeTenant(tenant) || 'default_tenant';
  const dir = path.join(getConfiguredStorageRoot(), safeTenant);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getConfiguredLogoPath(tenant, filename) {
  const safeTenant = sanitizeTenant(tenant);
  const safeFilename = sanitizeFilename(filename);
  if (!safeTenant || !safeFilename) return null;
  return path.join(getConfiguredStorageRoot(), safeTenant, safeFilename);
}

function getLegacyLogoPaths(tenant, filename) {
  const safeTenant = sanitizeTenant(tenant);
  const safeFilename = sanitizeFilename(filename);
  if (!safeTenant || !safeFilename) return [];
  return getLegacyStorageRoots().map((root) => path.join(root, safeTenant, safeFilename));
}

function resolveExistingLogoPath(tenant, filename) {
  const configured = getConfiguredLogoPath(tenant, filename);
  const candidates = [
    configured,
    ...getLegacyLogoPaths(tenant, filename),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // Ignore bad candidate and continue.
    }
  }
  return configured;
}

module.exports = {
  ensureTenantLogoDir,
  getConfiguredStorageRoot,
  resolveExistingLogoPath,
  sanitizeFilename,
  sanitizeTenant,
};
