const Joi = require('joi');

/** Minimum length and complexity for production accounts (NIST-inspired: length + mixed character classes). */
const MIN_LEN = 12;
const MAX_LEN = 128;

const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{12,128}$/;

function strongPasswordMessage() {
  return `Password must be ${MIN_LEN}–${MAX_LEN} characters and include uppercase, lowercase, a number, and a special character`;
}

/** Joi schema for new passwords (change password, super-admin provisioned admin). */
function strongPasswordJoi() {
  return Joi.string()
    .min(MIN_LEN)
    .max(MAX_LEN)
    .pattern(STRONG_PASSWORD_REGEX)
    .messages({
      'string.pattern.base': strongPasswordMessage(),
      'string.min': strongPasswordMessage(),
    });
}

function assertStrongPassword(plain) {
  const s = String(plain || '');
  if (!STRONG_PASSWORD_REGEX.test(s)) {
    const err = new Error(strongPasswordMessage());
    err.statusCode = 400;
    throw err;
  }
}

module.exports = {
  MIN_LEN,
  MAX_LEN,
  STRONG_PASSWORD_REGEX,
  strongPasswordJoi,
  strongPasswordMessage,
  assertStrongPassword,
};
