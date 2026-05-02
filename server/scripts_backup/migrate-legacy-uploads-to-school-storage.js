/**
 * One-time helper: move legacy flat uploads into school_N/{students|documents|uploads}/…
 * and print SQL hints to update DB paths. Review and run manually per tenant.
 *
 * Usage:
 *   SCHOOL_ID=12 node scripts/migrate-legacy-uploads-to-school-storage.js
 *
 * Does not run automatically — paths differ per deployment (uploads/, TEACHER_DOCUMENTS_STORAGE_ROOT, etc.).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getStorageRoot } = require('../src/storage/schoolStorageConfig');

const schoolId = parseInt(process.env.SCHOOL_ID || '0', 10);
if (!Number.isFinite(schoolId) || schoolId <= 0) {
  console.error('Set SCHOOL_ID=positive integer');
  process.exit(1);
}

const legacyRoot = path.resolve(process.env.LEGACY_UPLOAD_ROOT || path.join(process.cwd(), 'uploads'));
const destRoot = path.join(getStorageRoot(), `school_${schoolId}`, 'uploads');

console.log('Legacy root:', legacyRoot);
console.log('Destination:', destRoot);
console.log('Copy files manually or extend this script; DB values should become relative paths like:');
console.log(`  school_${schoolId}/students/<filename>`);
console.log('Example UPDATE after files are moved:');
console.log(`  -- UPDATE students SET photo_url = 'school_${schoolId}/students/' || ... WHERE ...`);

if (!fs.existsSync(legacyRoot)) {
  console.warn('Legacy root missing; nothing to do.');
  process.exit(0);
}

fs.mkdirSync(destRoot, { recursive: true });
console.log('Ready to migrate. Implement file copy rules for your tree (see teacher-documents, school-logos, etc.).');
