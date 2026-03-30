const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES, ALL_AUTHENTICATED_ROLES } = require('../config/roles');
const { getProfile, updateProfile, uploadLogo, getLogo } = require('../controllers/schoolProfileController');

const router = express.Router();

const logoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const tenant = String(req.tenant?.db_name || 'default_tenant').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dir = path.join(__dirname, '../../uploads/school-logos', tenant);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    cb(null, `logo_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const ok = mime.startsWith('image/');
    if (!ok) {
      const err = new Error('Only image files are allowed.');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

router.get('/', requireRole(ALL_AUTHENTICATED_ROLES), getProfile);
router.get('/logo/:tenant/:filename', requireRole(ALL_AUTHENTICATED_ROLES), getLogo);
router.patch('/', requireRole([ROLES.ADMIN]), updateProfile);
router.post('/logo', requireRole([ROLES.ADMIN]), upload.single('logo'), uploadLogo);

module.exports = router;

