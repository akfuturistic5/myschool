/**
 * Joi validation middleware
 * Returns 400 with validation errors in standardized format
 */
const Joi = require('joi');
const { error: errorResponse } = require('./responseHelper');

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      return errorResponse(res, 400, message);
    }

    req[property] = value;
    next();
  };
};

module.exports = { validate };
