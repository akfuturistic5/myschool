const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { validateImageFileAtPath } = require('../utils/imageMagic');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getSchoolProfile, ensureSchoolProfile } = require('../services/schoolProfileService');

function normalizeLogoUrl(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const marker = '/uploads/school-logos/';
  const idx = normalized.toLowerCase().indexOf(marker);
  if (idx < 0) return null;
  const rel = normalized.slice(idx + marker.length).split('/').filter(Boolean);
  if (rel.length < 2) return null;
  const tenant = rel[0].replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = rel[rel.length - 1].replace(/[^a-zA-Z0-9._-]/g, '');
  if (!tenant || !filename) return null;
  return `/api/school/profile/logo/${tenant}/${filename}`;
}

const getProfile = async (req, res) => {
  try {
    const profile = await getSchoolProfile(req.user?.school_name || null);
    return success(res, 200, 'School profile fetched', profile);
  } catch (err) {
    console.error('School profile get error:', err);
    return errorResponse(res, 500, 'Failed to fetch school profile');
  }
};

const updateProfile = async (req, res) => {
  try {
    const schoolName = (req.body?.school_name || '').toString().trim();
    if (!schoolName) {
      return errorResponse(res, 400, 'school_name is required');
    }

    await ensureSchoolProfile(req.user?.school_name || null);
    const updated = await query(
      `UPDATE school_profile
       SET school_name = $1, updated_at = NOW()
       WHERE id = (SELECT id FROM school_profile ORDER BY id ASC LIMIT 1)
       RETURNING id, school_name, logo_url, created_at, updated_at`,
      [schoolName]
    );

    return success(res, 200, 'School profile updated', updated.rows[0] || null);
  } catch (err) {
    console.error('School profile update error:', err);
    return errorResponse(res, 500, 'Failed to update school profile');
  }
};

const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'Logo file is required');
    }

    if (!validateImageFileAtPath(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
      return errorResponse(res, 400, 'File content is not a valid PNG, JPEG, or WEBP image');
    }

    await ensureSchoolProfile(req.user?.school_name || null);
    const logoUrl = normalizeLogoUrl(req.file.path);
    if (!logoUrl) {
      return errorResponse(res, 400, 'Invalid logo path');
    }

    const updated = await query(
      `UPDATE school_profile
       SET logo_url = $1, updated_at = NOW()
       WHERE id = (SELECT id FROM school_profile ORDER BY id ASC LIMIT 1)
       RETURNING id, school_name, logo_url, created_at, updated_at`,
      [logoUrl]
    );

    return success(res, 200, 'School logo uploaded', updated.rows[0] || null);
  } catch (err) {
    console.error('School logo upload error:', err);
    return errorResponse(res, 500, 'Failed to upload school logo');
  }
};

const getLogo = async (req, res) => {
  try {
    const tenant = String(req.params.tenant || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = path.basename(String(req.params.filename || '')).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!tenant || !filename) {
      return errorResponse(res, 400, 'Invalid logo reference');
    }
    const sessionTenant = String(req.tenant?.db_name || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sessionTenant || tenant !== sessionTenant) {
      return errorResponse(res, 403, 'Access denied');
    }
    const filePath = path.resolve(__dirname, '../../uploads/school-logos', tenant, filename);
    const rootPath = path.resolve(__dirname, '../../uploads/school-logos');
    if (!filePath.startsWith(rootPath)) {
      return errorResponse(res, 403, 'Access denied');
    }
    if (!fs.existsSync(filePath)) {
      return errorResponse(res, 404, 'Logo not found');
    }
    return res.sendFile(filePath);
  } catch (err) {
    console.error('School logo fetch error:', err);
    return errorResponse(res, 500, 'Failed to fetch logo');
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadLogo,
  getLogo,
};

