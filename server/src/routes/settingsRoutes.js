const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const settingsController = require('../controllers/settingsController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure the directory exists
    const dir = settingsController.ensureSettingsDir();
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Unique filename to prevent overwrites
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'settings-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.get('/', settingsController.getSettings);
router.post('/', settingsController.upsertSettings);
router.post('/upload', upload.single('file'), settingsController.uploadFile);
// router.get('/file/:filename', settingsController.getFile); (Handled by public route in server.js)

module.exports = router;
