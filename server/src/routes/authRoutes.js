const express = require('express');
const { login, getMe, updateMe, changePassword, logout } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { validate } = require('../utils/validate');
const { echoCsrfToken } = require('../utils/csrfEcho');
const { strongPasswordJoi } = require('../utils/passwordPolicy');
const Joi = require('joi');

const router = express.Router();

const loginSchema = Joi.object({
  instituteNumber: Joi.string().trim().required(),
  username: Joi.string().trim().required(),
  password: Joi.string().required()
});

router.post('/login', validate(loginSchema), login);
// Cross-origin SPA: returns XSRF value in JSON (cookie stays on API host; JS cannot read it cross-site)
router.get('/csrf-token', echoCsrfToken);
router.get('/me', authenticate, getMe);
router.patch(
  '/me',
  authenticate,
  validate(
    Joi.object({
      first_name: Joi.string().trim().allow('', null).max(100).optional(),
      last_name: Joi.string().trim().allow('', null).max(100).optional(),
      email: Joi.string().trim().allow('', null).email().max(255).optional(),
      phone: Joi.string().trim().allow('', null).max(50).optional(),
      current_address: Joi.string().trim().allow('', null).max(2000).optional(),
      permanent_address: Joi.string().trim().allow('', null).max(2000).optional(),
      avatar: Joi.string().trim().allow('', null).max(512).optional(),
    }).min(1)
  ),
  updateMe
);

router.post(
  '/change-password',
  authenticate,
  validate(
    Joi.object({
      currentPassword: Joi.string().trim().min(1).required(),
      newPassword: strongPasswordJoi().required(),
      confirmPassword: Joi.string().trim().min(1).required(),
    })
      .custom((v, helpers) => {
      if (v.newPassword !== v.confirmPassword) {
        return helpers.error('any.invalid', { message: 'Passwords do not match' });
      }
      if (v.currentPassword === v.newPassword) {
        return helpers.error('any.invalid', { message: 'New password must be different' });
      }
      return v;
    }, 'password match validation')
      .messages({
        'any.invalid': '{{#message}}',
      })
  ),
  changePassword
);
// Logout clears cookie - no auth required so expired tokens can still clear the cookie
router.post('/logout', logout);

module.exports = router;
