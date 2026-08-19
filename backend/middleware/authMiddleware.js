const jwt = require("jsonwebtoken");
const Lender = require("../models/Lender");
const { sendError } = require("../utils/helpers");

/**
 * Protects routes by requiring a valid JWT in the Authorization header.
 * Format expected: "Authorization: Bearer <token>"
 *
 * On success, attaches the authenticated lender to req.lender (without
 * the password field) so downstream controllers can use req.lender._id
 * to scope all queries to this lender's own data.
 */
const protect = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return sendError(res, 401, "Not authorized, no token provided");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const lender = await Lender.findById(decoded.id);
    if (!lender) {
      return sendError(res, 401, "Not authorized, lender no longer exists");
    }

    req.lender = lender;
    next();
  } catch (error) {
    return sendError(res, 401, "Not authorized, invalid or expired token");
  }
};

module.exports = { protect };
