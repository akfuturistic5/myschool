/**
 * Prints SHA256 of the provisioning template after LF normalization (same as runtime).
 * Use this value for PROVISIONING_TEMPLATE_SQL_SHA256 on Render / production.
 *
 *   node scripts/provisioningTemplateHash.js
 *   npm run provisioning:template-hash
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVER_ROOT = path.resolve(__dirname, '..');
const rel = process.argv[2] || 'sql/template_schema.sql';
const abs = path.isAbsolute(rel) ? path.normalize(rel) : path.join(SERVER_ROOT, rel);

let raw;
try {
  raw = fs.readFileSync(abs, 'utf8');
} catch (e) {
  console.error('Read failed:', abs, e.message);
  process.exit(1);
}

const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const sha = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');

console.log('File:', path.relative(SERVER_ROOT, abs) || abs);
console.log('PROVISIONING_TEMPLATE_SQL_SHA256=' + sha);
