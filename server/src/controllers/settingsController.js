const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const { success, error: errorResponse } = require('../utils/responseHelper');

const ensureSettingsDir = () => {
  const dir = path.join(process.cwd(), 'uploads', 'settings');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const getSettings = async (req, res) => {
  try {
    const group = req.query.group;
    let sql = `SELECT * FROM settings`;
    const params = [];
    if (group) {
      sql += ` WHERE setting_group = $1`;
      params.push(group);
    }
    const r = await query(sql, params);
    
    // Convert array to key-value object
    const settings = {};
    for (const row of r.rows) {
      settings[row.setting_key] = row.setting_value;
    }
    
    return success(res, 200, 'Settings fetched', settings);
  } catch (err) {
    console.error('getSettings error:', err);
    return errorResponse(res, 500, 'Failed to fetch settings');
  }
};

const upsertSettings = async (req, res) => {
  try {
    const group = req.body.group || null;
    const settings = req.body.settings;
    if (!settings || typeof settings !== 'object') {
      return errorResponse(res, 400, 'Invalid settings body');
    }
    
    for (const [key, value] of Object.entries(settings)) {
      await query(
        `INSERT INTO settings (setting_key, setting_value, setting_group, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, setting_group = EXCLUDED.setting_group, updated_at = NOW()`,
        [key, value, group]
      );
    }

    return success(res, 200, 'Settings updated', settings);
  } catch (err) {
    console.error('upsertSettings error:', err);
    return errorResponse(res, 500, 'Failed to save settings');
  }
};

const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'File is required');
    }
    const filename = req.file.filename;
    // URL matching our new static route
    const fileUrl = `/settings/file/${filename}`;
    
    return success(res, 200, 'File uploaded', { url: fileUrl });
  } catch (err) {
    console.error('uploadFile error:', err);
    return errorResponse(res, 500, 'Failed to upload file');
  }
};

const getFile = async (req, res) => {
  try {
    const filename = String(req.params.filename).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!filename) return errorResponse(res, 400, 'Invalid filename');
    
    const filePath = path.join(ensureSettingsDir(), filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Not Found');
    }
    return res.sendFile(filePath);
  } catch (err) {
    console.error('getFile error:', err);
    return errorResponse(res, 500, 'Failed to fetch file');
  }
};

module.exports = {
  getSettings,
  upsertSettings,
  uploadFile,
  getFile,
  ensureSettingsDir
};
