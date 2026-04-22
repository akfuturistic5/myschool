const path = require('path');
const { getStorageProvider } = require('../storage');
const { parseRelativeKey } = require('../storage/LocalFilesystemStorageProvider');
const { getSchoolIdFromRequest, parseSchoolKey } = require('../utils/schoolContext');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { ALLOWED_FOLDERS } = require('../storage/schoolStorageConfig');

/**
 * POST /api/storage/upload
 * multipart: file, folder (students|documents|uploads|temp)
 */
const uploadSchoolFile = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromRequest(req);
    if (!schoolId) {
      return errorResponse(res, 401, 'School context required');
    }
    const folder = String(req.body?.folder || '').trim();
    const topFolder = folder.split('/')[0];
    if (!ALLOWED_FOLDERS.includes(topFolder)) {
      return errorResponse(res, 400, `Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(', ')}`);
    }
    if (!req.file || !req.file.buffer) {
      return errorResponse(res, 400, 'Missing file field');
    }

    const provider = getStorageProvider();
    const { relativePath } = await provider.upload(
      {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
      },
      schoolId,
      folder
    );

    const seg = relativePath.split('/');
    const schoolKey = seg[0];
    const fileName = seg[seg.length - 1];
    const publicUrl = `/api/storage/files/${schoolKey}/${folder}/${encodeURIComponent(fileName)}`;

    return success(res, 200, 'File uploaded', {
      relativePath,
      url: publicUrl,
    });
  } catch (err) {
    console.error('uploadSchoolFile:', err.message);
    if (err.message && err.message.includes('not allowed')) {
      return errorResponse(res, 400, err.message);
    }
    return errorResponse(res, 500, 'Upload failed');
  }
};

/**
 * GET /api/storage/files/:schoolKey/:folder/:filename
 * Same-school check; never stream paths outside tenant root.
 */
const getSchoolFile = async (req, res) => {
  try {
    const requesterSchoolId = getSchoolIdFromRequest(req);
    if (!requesterSchoolId) {
      return errorResponse(res, 401, 'School context required');
    }

    const urlSchoolId = parseSchoolKey(req.params.schoolKey);
    if (urlSchoolId == null) {
      return errorResponse(res, 400, 'Invalid school key');
    }
    if (Number(urlSchoolId) !== Number(requesterSchoolId)) {
      return errorResponse(res, 403, 'Access denied');
    }

    const fullPath = String(req.params[0] || '').trim().replace(/\\/g, '/');
    if (!fullPath) {
      return errorResponse(res, 400, 'Invalid path');
    }

    const pathSegs = fullPath.split('/');
    const filename = pathSegs.pop();
    const folder = pathSegs.join('/');

    if (!filename) {
      return errorResponse(res, 400, 'Filename required');
    }

    const topFolder = pathSegs[0] || '';
    if (!ALLOWED_FOLDERS.includes(topFolder)) {
      return errorResponse(res, 400, 'Invalid folder');
    }

    const relativeKey = `school_${urlSchoolId}/${fullPath}`;
    const provider = getStorageProvider();

    const buf = await provider.read(relativeKey);
    const mime = provider.getMimeForPath(relativeKey);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.status(200).send(buf);
  } catch (err) {
    if (err.code === 'ENOENT' || err.message === 'Invalid storage path' || err.message.includes('Path traversal')) {
      return errorResponse(res, 404, 'File not found');
    }
    console.error('getSchoolFile:', err.message);
    return errorResponse(res, 500, 'Failed to read file');
  }
};

/**
 * DELETE /api/storage/file — body: { relativePath }
 */
const deleteSchoolFile = async (req, res) => {
  try {
    const schoolId = getSchoolIdFromRequest(req);
    if (!schoolId) {
      return errorResponse(res, 401, 'School context required');
    }
    const relativePath = String(req.body?.relativePath || '').trim().replace(/\\/g, '/');
    const parsed = parseRelativeKey(relativePath);
    if (!parsed || parsed.schoolId !== schoolId) {
      return errorResponse(res, 403, 'Access denied');
    }
    const provider = getStorageProvider();
    await provider.delete(relativePath);
    return success(res, 200, 'File deleted', { deleted: true });
  } catch (err) {
    console.error('deleteSchoolFile:', err.message);
    return errorResponse(res, 500, 'Delete failed');
  }
};

module.exports = {
  uploadSchoolFile,
  getSchoolFile,
  deleteSchoolFile,
};
