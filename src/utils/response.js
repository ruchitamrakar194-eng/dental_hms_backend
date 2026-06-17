'use strict';

/**
 * Standard API success response
 * Matches frontend expectation: { success, message, data, meta }
 */
const success = (res, data = {}, message = 'Success', statusCode = 200, meta = null) => {
  const payload = { success: true, message, data };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

/**
 * Standard API error response
 */
const error = (res, message = 'Something went wrong', statusCode = 500, errors = null) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

/**
 * Validation error (422)
 */
const validationError = (res, errors) => {
  return res.status(422).json({
    success: false,
    message: 'Validation failed',
    errors,
  });
};

module.exports = { success, error, validationError };
