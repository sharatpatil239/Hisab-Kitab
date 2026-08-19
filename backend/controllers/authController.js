const jwt = require("jsonwebtoken");
const Lender = require("../models/Lender");
const { sendSuccess, sendError, asyncHandler } = require("../utils/helpers");
const { isNonEmptyString, isValidEmail, isValidPassword } = require("../utils/validators");

/**
 * Creates a signed JWT for a given lender id.
 */
const generateToken = (lenderId) => {
  return jwt.sign({ id: lenderId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

/**
 * Strips sensitive/internal fields before sending a lender back to the client.
 */
const formatLender = (lender) => ({
  id: lender._id,
  name: lender.name,
  email: lender.email,
  phone: lender.phone,
  createdAt: lender.createdAt,
});

// @desc    Register a new lender
// @route   POST /api/auth/register
// @access  Public
const registerLender = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!isNonEmptyString(name)) {
    return sendError(res, 400, "Name is required");
  }
  if (!isValidEmail(email)) {
    return sendError(res, 400, "A valid email is required");
  }
  if (!isNonEmptyString(phone)) {
    return sendError(res, 400, "Phone number is required");
  }
  if (!isValidPassword(password)) {
    return sendError(res, 400, "Password must be at least 6 characters long");
  }

  const existingLender = await Lender.findOne({ email: email.toLowerCase() });
  if (existingLender) {
    return sendError(res, 400, "An account with this email already exists");
  }

  const lender = await Lender.create({ name, email, phone, password });

  const token = generateToken(lender._id);

  return sendSuccess(res, 201, "Lender registered successfully", {
    token,
    lender: formatLender(lender),
  });
});

// @desc    Log in a lender
// @route   POST /api/auth/login
// @access  Public
const loginLender = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!isValidEmail(email) || !isNonEmptyString(password)) {
    return sendError(res, 400, "Email and password are required");
  }

  // password has `select: false` in the schema, so we must explicitly ask for it
  const lender = await Lender.findOne({ email: email.toLowerCase() }).select("+password");
  if (!lender) {
    return sendError(res, 401, "Invalid email or password");
  }

  const isMatch = await lender.comparePassword(password);
  if (!isMatch) {
    return sendError(res, 401, "Invalid email or password");
  }

  const token = generateToken(lender._id);

  return sendSuccess(res, 200, "Login successful", {
    token,
    lender: formatLender(lender),
  });
});

// @desc    Get the logged-in lender's own profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  return sendSuccess(res, 200, "Profile fetched", {
    lender: formatLender(req.lender),
  });
});

module.exports = { registerLender, loginLender, getMe };
