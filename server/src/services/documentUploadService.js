const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { getStorageRoot } = require('../storage/schoolStorageConfig');

/** 4 MB — student PDFs (medical / TC) */
const STUDENT_PDF_MAX_BYTES = 4 * 1024 * 1024;

const DOC_PREFIX = {
  medical: 'medical',
  transfer_certificate: 'tc',
};

/**
 * @param {Buffer} buffer
 * @param {string} originalname
 * @param {number} schoolId
 * @param {'medical'|'transfer_certificate'} docType
 * @returns {Promise<{ relativePath: string }>}
 */
async function uploadStudentPdf(buffer, originalname, schoolId, docType) {
  const sid = Number(schoolId);
  if (!Number.isFinite(sid) || sid <= 0) {
    throw new Error('Invalid school context');
  }
  const prefix = DOC_PREFIX[docType];
  if (!prefix) {
    throw new Error('Invalid document type');
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Empty file');
  }
  if (buffer.length > STUDENT_PDF_MAX_BYTES) {
    throw new Error('File too large (max 4MB)');
  }
  const ext = path.extname(originalname || '').toLowerCase();
  if (ext !== '.pdf') {
    throw new Error('Only PDF allowed');
  }
  const head = buffer.slice(0, 5).toString('utf8');
  if (!head.startsWith('%PDF')) {
    throw new Error('Only PDF allowed');
  }

  const stamp = Date.now().toString(36);
  const rand = crypto.randomBytes(8).toString('hex');
  const filename = `${prefix}_${stamp}_${rand}.pdf`;
  const dir = path.join(getStorageRoot(), `school_${sid}`, 'documents');
  await fs.mkdir(dir, { recursive: true });
  const full = path.join(dir, filename);
  const resolved = path.resolve(full);
  const boundary = path.resolve(dir);
  if (!resolved.startsWith(boundary + path.sep) && resolved !== boundary) {
    throw new Error('Invalid path');
  }
  await fs.writeFile(resolved, buffer);
  const relativePath = `school_${sid}/documents/${filename}`;
  return { relativePath };
}

module.exports = {
  uploadStudentPdf,
  STUDENT_PDF_MAX_BYTES,
};
