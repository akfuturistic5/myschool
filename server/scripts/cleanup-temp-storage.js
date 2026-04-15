/**
 * Delete files under each school's temp/ older than TTL (default 24h).
 * Run via cron: cd server && node scripts/cleanup-temp-storage.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { getStorageRoot } = require('../src/storage/schoolStorageConfig');

const MAX_AGE_MS = parseInt(process.env.STORAGE_TEMP_MAX_AGE_MS || String(24 * 60 * 60 * 1000), 10);

function walkRemoveOld(dir, now) {
  let removed = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return removed;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      removed += walkRemoveOld(full, now);
      try {
        if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
      } catch {
        /* ignore */
      }
      continue;
    }
    try {
      const st = fs.statSync(full);
      if (now - st.mtimeMs > MAX_AGE_MS) {
        fs.unlinkSync(full);
        removed += 1;
      }
    } catch {
      /* ignore */
    }
  }
  return removed;
}

const root = getStorageRoot();
if (!fs.existsSync(root)) {
  console.log('Storage root does not exist, nothing to clean:', root);
  process.exit(0);
}

const now = Date.now();
let total = 0;
const schools = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory() && /^school_\d+$/i.test(d.name));
for (const d of schools) {
  const tempDir = path.join(root, d.name, 'temp');
  if (fs.existsSync(tempDir)) {
    const n = walkRemoveOld(tempDir, now);
    total += n;
    if (n) console.log(d.name, 'removed', n, 'file(s)');
  }
}
console.log('cleanup-temp-storage done, total removed:', total);
