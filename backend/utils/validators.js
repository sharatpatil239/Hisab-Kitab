const validator = require("validator");

/** Checks a value is a non-empty string. */
const isNonEmptyString = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

/** Checks an email looks valid. */
const isValidEmail = (email) => {
  return typeof email === "string" && validator.isEmail(email);
};

/** Checks a password meets the minimum requirements (>= 6 characters). */
const isValidPassword = (password) => {
  return typeof password === "string" && password.length >= 6;
};

/** Checks a value is a valid, parseable date. */
const isValidDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const VALID_INTEREST_TYPES = ["SIMPLE", "COMPOUND"];
const VALID_RATE_PERIODS = ["DAILY", "MONTHLY", "YEARLY"];
const VALID_PAYMENT_ALLOCATIONS = ["INTEREST_FIRST", "PRINCIPAL_FIRST"];
const VALID_LOAN_STATUSES = ["ACTIVE", "PAID", "OVERDUE"];

module.exports = {
  isNonEmptyString,
  isValidEmail,
  isValidPassword,
  isValidDate,
  VALID_INTEREST_TYPES,
  VALID_RATE_PERIODS,
  VALID_PAYMENT_ALLOCATIONS,
  VALID_LOAN_STATUSES,
};
