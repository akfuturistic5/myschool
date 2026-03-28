const express = require('express');
const Joi = require('joi');
const { superAdminLogin, superAdminLogout } = require('../controllers/superAdminAuthController');
const { validate } = require('../utils/validate');
const { echoCsrfToken } = require('../utils/csrfEcho');

const router = express.Router();

const superAdminLoginSchema = Joi.object({
  emailOrUsername: Joi.string().trim().required(),
  password: Joi.string().required(),
});

router.post('/login', validate(superAdminLoginSchema), superAdminLogin);
router.get('/csrf-token', echoCsrfToken);

// Logout clears cookie only (like tenant /api/auth/logout). No auth required so expired
// sessions can still clear the httpOnly cookie; CSRF double-submit still applies.
router.post('/logout', superAdminLogout);

module.exports = router;

