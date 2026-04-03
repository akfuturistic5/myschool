const express = require('express');
const Joi = require('joi');
const {
  superAdminLogin,
  superAdminLogout,
  updateSuperAdminProfile,
  changeSuperAdminPassword,
} = require('../controllers/superAdminAuthController');
const { authenticateSuperAdmin, requireSuperAdmin } = require('../middleware/superAdminAuthMiddleware');
const { validate } = require('../utils/validate');
const { echoCsrfToken } = require('../utils/csrfEcho');
const { strongPasswordJoi } = require('../utils/passwordPolicy');

const router = express.Router();

const superAdminLoginSchema = Joi.object({
  emailOrUsername: Joi.string().trim().required(),
  password: Joi.string().required(),
});

router.post('/login', validate(superAdminLoginSchema), superAdminLogin);
router.get('/csrf-token', echoCsrfToken);

router.patch(
  '/profile',
  authenticateSuperAdmin,
  requireSuperAdmin,
  validate(
    Joi.object({
      username: Joi.string().trim().min(2).max(150).required(),
      currentPassword: Joi.string().required(),
    })
  ),
  updateSuperAdminProfile
);

router.post(
  '/change-password',
  authenticateSuperAdmin,
  requireSuperAdmin,
  validate(
    Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: strongPasswordJoi(),
      confirmPassword: Joi.string().required(),
    })
      .custom((v, helpers) => {
        if (v.newPassword !== v.confirmPassword) {
          return helpers.error('any.invalid', { message: 'Passwords do not match' });
        }
        if (v.currentPassword === v.newPassword) {
          return helpers.error('any.invalid', { message: 'New password must be different from the current password' });
        }
        return v;
      }, 'super admin password validation')
      .messages({
        'any.invalid': '{{#message}}',
      })
  ),
  changeSuperAdminPassword
);

// Logout clears cookie only (like tenant /api/auth/logout). No auth required so expired
// sessions can still clear the httpOnly cookie; CSRF double-submit still applies.
router.post('/logout', superAdminLogout);

module.exports = router;

