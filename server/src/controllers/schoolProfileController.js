const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { query, masterQuery } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');
const { getSchoolProfile, ensureSchoolProfile } = require('../services/schoolProfileService');

/** Resize large logos to fit within 512×512 (keeps aspect ratio); reduces upload failures and layout issues. */
async function optimizeSchoolLogoInPlace(filePath) {
  const tmpPath = `${filePath}.opt`;
  const pipeline = sharp(filePath).rotate().resize(512, 512, {
    fit: 'inside',
    withoutEnlargement: true,
  });
  const meta = await sharp(filePath).metadata();
  const fmt = meta.format;
  if (fmt === 'png') {
    await pipeline.png({ compressionLevel: 9 }).toFile(tmpPath);
  } else if (fmt === 'jpeg') {
    await pipeline.jpeg({ quality: 88, mozjpeg: true }).toFile(tmpPath);
  } else if (fmt === 'webp') {
    await pipeline.webp({ quality: 88 }).toFile(tmpPath);
  } else {
    await pipeline.png().toFile(tmpPath);
  }
  fs.renameSync(tmpPath, filePath);
}

async function validateLogoImageShape(filePath) {
  const meta = await sharp(filePath).metadata();
  const width = Number(meta.width || 0);
  const height = Number(meta.height || 0);
  if (!width || !height) {
    const err = new Error('Could not read image dimensions.');
    err.statusCode = 400;
    throw err;
  }

  // Reject banner-like images: logo should not be extremely wide.
  // Allows most normal logos (square/portrait/moderately landscape).
  const maxAspectRatio = 3;
  if (width / height > maxAspectRatio) {
    const err = new Error('Image is too wide for a logo. Please upload a logo-style image.');
    err.statusCode = 400;
    throw err;
  }
}

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

    try {
      await validateLogoImageShape(req.file.path);
    } catch (shapeErr) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
      const msg = shapeErr?.message || 'Invalid logo image';
      return errorResponse(res, shapeErr.statusCode || 400, msg);
    }

    try {
      await optimizeSchoolLogoInPlace(req.file.path);
    } catch (optErr) {
      console.error('School logo optimize error:', optErr);
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
      return errorResponse(
        res,
        400,
        'This image could not be processed. Please try another image (max 5 MB).'
      );
    }

    await ensureSchoolProfile(req.user?.school_name || null);
    const logoUrl = normalizeLogoUrl(req.file.path);
    if (!logoUrl) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
      return errorResponse(res, 400, 'Invalid logo path');
    }

    const prevRes = await query(
      `SELECT logo_url FROM school_profile ORDER BY id ASC LIMIT 1`
    );
    const previousLogoUrl = prevRes.rows?.[0]?.logo_url ?? null;

    const updated = await query(
      `UPDATE school_profile
       SET logo_url = $1, updated_at = NOW()
       WHERE id = (SELECT id FROM school_profile ORDER BY id ASC LIMIT 1)
       RETURNING id, school_name, logo_url, created_at, updated_at`,
      [logoUrl]
    );

    const schoolId = req.user?.school_id;
    if (schoolId == null) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
      await query(
        `UPDATE school_profile SET logo_url = $1, updated_at = NOW()
         WHERE id = (SELECT id FROM school_profile ORDER BY id ASC LIMIT 1)`,
        [previousLogoUrl]
      );
      return errorResponse(res, 500, 'Invalid session: missing school scope');
    }

    try {
      await masterQuery(`UPDATE schools SET logo = $1 WHERE id = $2 AND deleted_at IS NULL`, [
        logoUrl,
        schoolId,
      ]);
    } catch (e) {
      console.error('School logo: failed to sync master_db.schools.logo:', e);
      try {
        await query(
          `UPDATE school_profile SET logo_url = $1, updated_at = NOW()
           WHERE id = (SELECT id FROM school_profile ORDER BY id ASC LIMIT 1)`,
          [previousLogoUrl]
        );
      } catch (revertErr) {
        console.error('School logo: revert school_profile after master failure:', revertErr);
      }
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
      return errorResponse(
        res,
        500,
        'Could not save logo to the platform registry. Your previous logo was restored.'
      );
    }

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

