const Loan = require("../models/Loan");
const Transaction = require("../models/Transaction");
const { findOwnedBorrower } = require("./borrowerController");
const interestService = require("../services/interestService");
const { sendSuccess, sendError, asyncHandler, round2, isPositiveNumber } = require("../utils/helpers");
const {
  isValidDate,
  VALID_INTEREST_TYPES,
  VALID_RATE_PERIODS,
  VALID_PAYMENT_ALLOCATIONS,
} = require("../utils/validators");

/**
 * Builds the JSON-friendly representation of a loan, including its
 * live-calculated financial summary. Never trusts a stored "amount due"
 * field - always recalculates from the interest service.
 */
const formatLoanWithSummary = (loan) => {
  const summary = interestService.getLoanFinancialSummary(loan);
  return {
    id: loan._id,
    lender: loan.lender,
    borrower: loan.borrower,
    principalPaid: loan.principalPaid,
    interestPaid: loan.interestPaid,
    interestType: loan.interestType,
    interestRate: loan.interestRate,
    ratePeriod: loan.ratePeriod,
    interestStartDate: loan.interestStartDate,
    dueDate: loan.dueDate,
    loanCreationDate: loan.loanCreationDate,
    description: loan.description,
    status: loan.status,
    paymentAllocation: loan.paymentAllocation,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt,
    ...summary,
  };
};

/**
 * Recomputes a loan's status (ACTIVE / PAID / OVERDUE) based on its
 * current financial summary, and persists it if it changed.
 */
const refreshLoanStatus = async (loan) => {
  const summary = interestService.getLoanFinancialSummary(loan);
  let newStatus = loan.status;

  if (summary.remaining <= 0) {
    newStatus = "PAID";
  } else if (interestService.isLoanOverdue(loan)) {
    newStatus = "OVERDUE";
  } else {
    newStatus = "ACTIVE";
  }

  if (newStatus !== loan.status) {
    loan.status = newStatus;
    await loan.save();
  }
  return loan;
};

/**
 * Helper: fetches a loan and confirms it belongs to the logged-in lender.
 */
const findOwnedLoan = async (req, res) => {
  const loan = await Loan.findOne({ _id: req.params.id, lender: req.lender._id });
  if (!loan) {
    sendError(res, 404, "Loan not found");
    return null;
  }
  return loan;
};

// @desc    Create a new loan for a borrower
// @route   POST /api/loans
// @access  Private
const createLoan = asyncHandler(async (req, res) => {
  const {
    borrowerId,
    principal,
    interestType,
    interestRate,
    ratePeriod,
    interestStartDate,
    dueDate,
    loanCreationDate,
    description,
    paymentAllocation,
  } = req.body;

  if (!borrowerId) return sendError(res, 400, "borrowerId is required");

  // Ensure the borrower exists and belongs to this lender
  const borrower = await findOwnedBorrower({ ...req, params: { id: borrowerId } }, res);
  if (!borrower) return; // findOwnedBorrower already sent the error response

  if (!isPositiveNumber(principal)) {
    return sendError(res, 400, "Principal must be a positive number");
  }
  if (!VALID_INTEREST_TYPES.includes(interestType)) {
    return sendError(res, 400, `interestType must be one of: ${VALID_INTEREST_TYPES.join(", ")}`);
  }
  if (typeof interestRate !== "number" || interestRate < 0) {
    return sendError(res, 400, "interestRate must be a non-negative number");
  }
  if (!VALID_RATE_PERIODS.includes(ratePeriod)) {
    return sendError(res, 400, `ratePeriod must be one of: ${VALID_RATE_PERIODS.join(", ")}`);
  }
  if (!isValidDate(interestStartDate)) {
    return sendError(res, 400, "A valid interestStartDate is required");
  }
  if (!isValidDate(dueDate)) {
    return sendError(res, 400, "A valid dueDate is required");
  }
  if (new Date(dueDate) < new Date(interestStartDate)) {
    return sendError(res, 400, "dueDate cannot be before interestStartDate");
  }
  if (paymentAllocation && !VALID_PAYMENT_ALLOCATIONS.includes(paymentAllocation)) {
    return sendError(res, 400, `paymentAllocation must be one of: ${VALID_PAYMENT_ALLOCATIONS.join(", ")}`);
  }

  const loan = await Loan.create({
    lender: req.lender._id,
    borrower: borrower._id,
    principal,
    interestType,
    interestRate,
    ratePeriod,
    interestStartDate,
    dueDate,
    loanCreationDate: loanCreationDate || interestStartDate || Date.now(),
    description,
    paymentAllocation: paymentAllocation || "INTEREST_FIRST",
  });

  // Every loan starts with a LOAN_DISBURSED transaction so the ledger
  // history is complete from day one.
  await Transaction.create({
    lender: req.lender._id,
    borrower: borrower._id,
    loan: loan._id,
    type: "LOAN_DISBURSED",
    amount: principal,
    date: loan.loanCreationDate,
    description: description || "Loan disbursed",
    remainingBalanceAfter: principal,
  });

  return sendSuccess(res, 201, "Loan created successfully", { loan: formatLoanWithSummary(loan) });
});

// @desc    Get all loans for the logged-in lender (optionally filter by borrower/status)
// @route   GET /api/loans?borrowerId=&status=
// @access  Private
const getLoans = asyncHandler(async (req, res) => {
  const { borrowerId, status } = req.query;

  const query = { lender: req.lender._id };
  if (borrowerId) query.borrower = borrowerId;
  if (status) query.status = status;

  const loans = await Loan.find(query).sort({ createdAt: -1 });

  // Refresh statuses (e.g. mark newly-overdue loans) before returning
  const refreshed = await Promise.all(loans.map((loan) => refreshLoanStatus(loan)));

  return sendSuccess(res, 200, "Loans fetched successfully", {
    count: refreshed.length,
    loans: refreshed.map(formatLoanWithSummary),
  });
});

// @desc    Get all overdue loans for the logged-in lender
// @route   GET /api/loans/overdue
// @access  Private
const getOverdueLoans = asyncHandler(async (req, res) => {
  const loans = await Loan.find({ lender: req.lender._id, status: { $ne: "PAID" } });

  const overdueLoans = [];
  for (const loan of loans) {
    if (interestService.isLoanOverdue(loan)) {
      await refreshLoanStatus(loan);
      overdueLoans.push(formatLoanWithSummary(loan));
    }
  }

  return sendSuccess(res, 200, "Overdue loans fetched successfully", {
    count: overdueLoans.length,
    loans: overdueLoans,
  });
});

// @desc    Get a single loan with its full financial summary
// @route   GET /api/loans/:id
// @access  Private
const getLoanById = asyncHandler(async (req, res) => {
  const loan = await findOwnedLoan(req, res);
  if (!loan) return;

  await refreshLoanStatus(loan);

  const transactions = await Transaction.find({ loan: loan._id }).sort({ date: 1 });

  return sendSuccess(res, 200, "Loan fetched successfully", {
    loan: formatLoanWithSummary(loan),
    transactions,
  });
});

// @desc    Update a loan's editable details (not its financial history)
// @route   PUT /api/loans/:id
// @access  Private
const updateLoan = asyncHandler(async (req, res) => {
  const loan = await findOwnedLoan(req, res);
  if (!loan) return;

  const { interestRate, ratePeriod, dueDate, description, paymentAllocation, interestType } = req.body;

  if (interestType !== undefined) {
    if (!VALID_INTEREST_TYPES.includes(interestType)) {
      return sendError(res, 400, `interestType must be one of: ${VALID_INTEREST_TYPES.join(", ")}`);
    }
    loan.interestType = interestType;
  }
  if (interestRate !== undefined) {
    if (typeof interestRate !== "number" || interestRate < 0) {
      return sendError(res, 400, "interestRate must be a non-negative number");
    }
    loan.interestRate = interestRate;
  }
  if (ratePeriod !== undefined) {
    if (!VALID_RATE_PERIODS.includes(ratePeriod)) {
      return sendError(res, 400, `ratePeriod must be one of: ${VALID_RATE_PERIODS.join(", ")}`);
    }
    loan.ratePeriod = ratePeriod;
  }
  if (dueDate !== undefined) {
    if (!isValidDate(dueDate)) return sendError(res, 400, "A valid dueDate is required");
    if (new Date(dueDate) < new Date(loan.interestStartDate)) {
      return sendError(res, 400, "dueDate cannot be before interestStartDate");
    }
    loan.dueDate = dueDate;
  }
  if (description !== undefined) loan.description = description;
  if (paymentAllocation !== undefined) {
    if (!VALID_PAYMENT_ALLOCATIONS.includes(paymentAllocation)) {
      return sendError(res, 400, `paymentAllocation must be one of: ${VALID_PAYMENT_ALLOCATIONS.join(", ")}`);
    }
    loan.paymentAllocation = paymentAllocation;
  }

  await loan.save();
  await refreshLoanStatus(loan);

  return sendSuccess(res, 200, "Loan updated successfully", { loan: formatLoanWithSummary(loan) });
});

// @desc    Delete a loan (only allowed if no repayments have been recorded yet)
// @route   DELETE /api/loans/:id
// @access  Private
const deleteLoan = asyncHandler(async (req, res) => {
  const loan = await findOwnedLoan(req, res);
  if (!loan) return;

  const repaymentCount = await Transaction.countDocuments({ loan: loan._id, type: "REPAYMENT" });
  if (repaymentCount > 0) {
    return sendError(res, 400, "Cannot delete a loan that already has repayments recorded");
  }

  await Transaction.deleteMany({ loan: loan._id });
  await loan.deleteOne();

  return sendSuccess(res, 200, "Loan deleted successfully", {});
});

// @desc    Record a repayment against a loan
// @route   POST /api/loans/:id/repayments
// @access  Private
const recordRepayment = asyncHandler(async (req, res) => {
  const loan = await findOwnedLoan(req, res);
  if (!loan) return;

  const { amount, date, description } = req.body;

  if (!isPositiveNumber(amount)) {
    return sendError(res, 400, "Repayment amount must be a positive number");
  }

  const paymentDate = isValidDate(date) ? new Date(date) : new Date();

  const summaryBefore = interestService.getLoanFinancialSummary(loan, paymentDate);
  if (summaryBefore.remaining <= 0) {
    return sendError(res, 400, "This loan is already fully paid off");
  }
  if (amount > summaryBefore.remaining) {
    return sendError(
      res,
      400,
      `Repayment amount (${amount}) exceeds the remaining balance (${summaryBefore.remaining})`
    );
  }

  const { interestComponent, principalComponent } = interestService.allocateRepayment(
    loan,
    amount,
    paymentDate
  );

  loan.interestPaid = round2(loan.interestPaid + interestComponent);
  loan.principalPaid = round2(loan.principalPaid + principalComponent);
  if (round2(summaryBefore.remaining - amount) <= 0) {
    loan.status = "PAID";
  }
  await loan.save();
  await refreshLoanStatus(loan);

  const summaryAfter = interestService.getLoanFinancialSummary(loan, paymentDate);

  const transaction = await Transaction.create({
    lender: req.lender._id,
    borrower: loan.borrower,
    loan: loan._id,
    type: "REPAYMENT",
    amount,
    date: paymentDate,
    description: description || "Repayment received",
    principalComponent,
    interestComponent,
    remainingBalanceAfter: summaryAfter.remaining,
  });

  return sendSuccess(res, 201, "Repayment recorded successfully", {
    transaction,
    loan: formatLoanWithSummary(loan),
  });
});

module.exports = {
  createLoan,
  getLoans,
  getOverdueLoans,
  getLoanById,
  updateLoan,
  deleteLoan,
  recordRepayment,
  formatLoanWithSummary,
  refreshLoanStatus,
  findOwnedLoan,
};
