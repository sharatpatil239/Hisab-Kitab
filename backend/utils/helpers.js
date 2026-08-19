/**
 * Small collection of reusable helper functions used across the app.
 */

/**
 * Sends a consistent success JSON response.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {object} data - optional payload
 */
const sendSuccess = (res, statusCode, message, data = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...data,
  });
};

/**
 * Sends a consistent error JSON response.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 */
const sendError = (res, statusCode, message) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

/**
 * Rounds a number to 2 decimal places (useful for currency values).
 * @param {number} value
 */
const round2 = (value) => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

/**
 * Checks whether a value is a positive number (zero not allowed).
 * @param {*} value
 */
const isPositiveNumber = (value) => {
  return typeof value === "number" && !Number.isNaN(value) && value > 0;
};

/**
 * Checks whether a value is a non-negative number (zero allowed).
 * @param {*} value
 */
const isNonNegativeNumber = (value) => {
  return typeof value === "number" && !Number.isNaN(value) && value >= 0;
};

/**
 * Wraps an async Express route handler so any thrown error (or rejected
 * promise) is automatically passed to next(error), instead of every
 * controller needing its own try/catch block.
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  sendSuccess,
  sendError,
  round2,
  isPositiveNumber,
  isNonNegativeNumber,
  asyncHandler,
};
