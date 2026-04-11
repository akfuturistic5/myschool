const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getStorageRoot, ALLOWED_FOLDERS, ALLOWED_EXTENSIONS } = require('./schoolStorageConfig');

/**
 * Relative DB key: school_{id}/{folder}/{filename}
 */
function normalizeRelativeKey(schoolId, folder, filename) {
  const sid = Number(schoolId);
  if (!Number.isFinite(sid) || sid <= 0) throw new Error('Invalid school id');
  if (!ALLOWED_FOLDERS.includes(folder)) throw new Error('Invalid folder');
  const base = path.basename(String(filename || ''));
  if (!base || base !== String(filename).replace(/\\/g, '/').split('/').pop()) {
    throw new Error('Invalid filename');
  }
  return `school_${sid}/${folder}/${base}`;
}

function parseRelativeKey(relativeKey) {
  const s = String(relativeKey || '').replace(/\\/g, '/').trim();
  const m = /^school_(\d+)\/(students|documents|uploads|temp)\/([^/]+)$/.exec(s);
  if (!m) return null;
  return { schoolId: parseInt(m[1], 10), folder: m[2], filename: m[3] };
}

class LocalFilesystemStorageProvider {
  constructor(rootPath = getStorageRoot()) {
    this.rootPath = path.resolve(rootPath);
  }

  schoolRootPath(schoolId) {
    const sid = Number(schoolId);
    if (!Number.isFinite(sid) || sid <= 0) throw new Error('Invalid school id');
    return path.join(this.rootPath, `school_${sid}`);
  }

  /**
   * @returns {string} absolute path
   */
  resolveSafe(relativeKey) {
    const parsed = parseRelativeKey(relativeKey);
    if (!parsed) throw new Error('Invalid storage path');
    const abs = path.resolve(path.join(this.schoolRootPath(parsed.schoolId), parsed.folder, parsed.filename));
    const boundary = path.resolve(path.join(this.schoolRootPath(parsed.schoolId), parsed.folder));
    if (!abs.startsWith(boundary + path.sep) && abs !== boundary) {
      throw new Error('Path traversal blocked');
    }
    return abs;
  }

  async ensureSchoolFolder(schoolId, folder) {
    if (!ALLOWED_FOLDERS.includes(folder)) throw new Error('Invalid folder');
    const dir = path.join(this.schoolRootPath(schoolId), folder);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  /**
   * @param {object} file - { buffer, originalname, mimetype }
   * @returns {{ relativePath: string, filename: string }}
   */
  async upload(file, schoolId, folder) {
    await this.ensureSchoolFolder(schoolId, folder);
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS[ext]) {
      throw new Error(`File type not allowed: ${ext || '(no extension)'}`);
    }
    const mime = (file.mimetype || '').toLowerCase();
    const allowedMimes = ALLOWED_EXTENSIONS[ext];
    if (mime && allowedMimes.length && !allowedMimes.includes(mime)) {
      throw new Error('MIME type does not match file extension');
    }
    const rand = crypto.randomBytes(12).toString('hex');
    const stamp = Date.now().toString(36);
    const filename = `${stamp}_${rand}${ext}`;
    const relativePath = normalizeRelativeKey(schoolId, folder, filename);
    const abs = this.resolveSafe(relativePath);
    await fs.writeFile(abs, file.buffer);
    return { relativePath, filename };
  }

  async read(relativeKey) {
    const abs = this.resolveSafe(relativeKey);
    return fs.readFile(abs);
  }

  async delete(relativeKey) {
    const abs = this.resolveSafe(relativeKey);
    await fs.unlink(abs).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
    });
  }

  async exists(relativeKey) {
    try {
      const abs = this.resolveSafe(relativeKey);
      await fs.access(abs, fsSync.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  getMimeForPath(relativeKey) {
    const ext = path.extname(relativeKey || '').toLowerCase();
    const list = ALLOWED_EXTENSIONS[ext];
    return list && list[0] ? list[0] : 'application/octet-stream';
  }
}

module.exports = {
  LocalFilesystemStorageProvider,
  normalizeRelativeKey,
  parseRelativeKey,
};
