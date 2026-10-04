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
  const effectiveStatus = interestService.getEffectiveLoanStatus(loan);
  return {
    id: loan._id || loan.id,
    lender: loan.lender,
    borrower: loan.borrower,
    principal: round2(loan.principal),
    principalPaid: loan.principalPaid,
    interestPaid: loan.interestPaid,
    interestType: loan.interestType,
    interestRate: loan.interestRate,
    ratePeriod: loan.ratePeriod,
    interestStartDate: loan.interestStartDate,
    dueDate: loan.dueDate,
    loanCreationDate: loan.loanCreationDate,
    description: loan.description,
    status: effectiveStatus,
    paymentAllocation: loan.paymentAllocation,
    createdAt: loan.createdAt,
    updatedAt: loan.updatedAt,
    ...summary,
  };
};

/**
 * Recomputes a loan's status (ACTIVE / PAID / OVERDUE) based on its
 * current financial summary using the centralized interestService logic,
 * and persists it if it changed.
 */
const refreshLoanStatus = async (loan, asOfDate = new Date()) => {
  const effectiveStatus = interestService.getEffectiveLoanStatus(loan, asOfDate);

  if (effectiveStatus !== loan.status) {
    loan.status = effectiveStatus;
    if (typeof loan.save === "function") {
      await loan.save();
    }
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
  if (loanCreationDate !== undefined && !isValidDate(loanCreationDate)) {
    return sendError(res, 400, "A valid loanCreationDate is required");
  }

  // TASK 1: loan creation/disbursement date <= interest start date <= due date
  const creationDate = loanCreationDate ? new Date(loanCreationDate) : new Date(interestStartDate);
  const startDate = new Date(interestStartDate);
  const endDate = new Date(dueDate);

  if (creationDate > startDate) {
    return sendError(res, 400, "interestStartDate cannot be before loanCreationDate");
  }
  if (startDate > endDate) {
    return sendError(res, 400, "dueDate cannot be before interestStartDate");
  }
  if (creationDate > endDate) {
    return sendError(res, 400, "dueDate cannot be before loanCreationDate");
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
    interestStartDate: startDate,
    dueDate: endDate,
    loanCreationDate: creationDate,
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

  // TASK 4: Do not filter by status in MongoDB before refreshing statuses!
  // A loan whose due date passed today must have its status refreshed first.
  const loans = await Loan.find(query).sort({ createdAt: -1 });

  // Refresh statuses (persisting any transitions like ACTIVE -> OVERDUE or PAID)
  const refreshed = await Promise.all(loans.map((loan) => refreshLoanStatus(loan)));

  // Filter by status AFTER status is refreshed and calculated
  const filtered = status ? refreshed.filter((loan) => loan.status === status) : refreshed;

  return sendSuccess(res, 200, "Loans fetched successfully", {
    count: filtered.length,
    loans: filtered.map(formatLoanWithSummary),
  });
});

// @desc    Get all overdue loans for the logged-in lender
// @route   GET /api/loans/overdue
// @access  Private
const getOverdueLoans = asyncHandler(async (req, res) => {
  const loans = await Loan.find({ lender: req.lender._id });

  const overdueLoans = [];
  for (const loan of loans) {
    await refreshLoanStatus(loan);
    if (loan.status === "OVERDUE") {
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

// @desc    Update a loan's editable details (protecting financial terms if repayments exist)
// @route   PUT /api/loans/:id
// @access  Private
const updateLoan = asyncHandler(async (req, res) => {
  const loan = await findOwnedLoan(req, res);
  if (!loan) return;

  const repaymentCount = await Transaction.countDocuments({ loan: loan._id, type: "REPAYMENT" });
  const hasRepayments =
    repaymentCount > 0 ||
    (Array.isArray(loan.repayments) && loan.repayments.length > 0) ||
    loan.principalPaid > 0 ||
    loan.interestPaid > 0;

  const {
    principal,
    interestType,
    interestRate,
    ratePeriod,
    interestStartDate,
    dueDate,
    description,
    paymentAllocation,
  } = req.body;

  // TASK 5: Protected financial terms
  const toDateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);
  const financialFields = [
    { key: "original principal", proposed: principal, current: loan.principal },
    { key: "interest type", proposed: interestType, current: loan.interestType },
    { key: "interest rate", proposed: interestRate, current: loan.interestRate },
    { key: "rate period", proposed: ratePeriod, current: loan.ratePeriod },
    {
      key: "interest start date",
      proposed: toDateOnly(interestStartDate),
      current: toDateOnly(loan.interestStartDate),
    },
    { key: "repayment allocation policy", proposed: paymentAllocation, current: loan.paymentAllocation },
  ];

  if (hasRepayments) {
    const attemptedChanges = financialFields.filter(
      (f) => f.proposed !== undefined && f.proposed !== f.current
    );

    if (attemptedChanges.length > 0) {
      const changedNames = attemptedChanges.map((f) => f.key).join(", ");
      return sendError(
        res,
        400,
        `Cannot modify financial terms (${changedNames}) after repayments have been recorded on this loan.`
      );
    }
  } else {
    // No repayments yet - allow modifying financial terms with strict validation
    if (principal !== undefined) {
      if (!isPositiveNumber(principal)) {
        return sendError(res, 400, "Principal must be a positive number");
      }
      loan.principal = principal;
      await Transaction.updateOne(
        { loan: loan._id, type: "LOAN_DISBURSED" },
        { amount: principal, remainingBalanceAfter: principal }
      );
    }

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

    if (paymentAllocation !== undefined) {
      if (!VALID_PAYMENT_ALLOCATIONS.includes(paymentAllocation)) {
        return sendError(res, 400, `paymentAllocation must be one of: ${VALID_PAYMENT_ALLOCATIONS.join(", ")}`);
      }
      loan.paymentAllocation = paymentAllocation;
    }

    if (interestStartDate !== undefined) {
      if (!isValidDate(interestStartDate)) {
        return sendError(res, 400, "A valid interestStartDate is required");
      }
      const newStartDate = new Date(interestStartDate);
      const creationDate = loan.loanCreationDate ? new Date(loan.loanCreationDate) : newStartDate;
      const targetDueDate = dueDate ? new Date(dueDate) : new Date(loan.dueDate);

      if (newStartDate < creationDate) {
        return sendError(res, 400, "interestStartDate cannot be before loanCreationDate");
      }
      if (newStartDate > targetDueDate) {
        return sendError(res, 400, "dueDate cannot be before interestStartDate");
      }
      loan.interestStartDate = newStartDate;
    }
  }

  // Due date and description can always be edited if valid
  if (dueDate !== undefined) {
    if (!isValidDate(dueDate)) return sendError(res, 400, "A valid dueDate is required");
    const targetStartDate = new Date(loan.interestStartDate);
    if (new Date(dueDate) < targetStartDate) {
      return sendError(res, 400, "dueDate cannot be before interestStartDate");
    }
    loan.dueDate = dueDate;
  }

  if (description !== undefined) {
    loan.description = description;
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

/**
 * Validates a proposed repayment date against business rules:
 * 1. Must not be in the future.
 * 2. Must not be before the loan creation date.
 * 3. Must not be before the interest start date.
 * 4. Must not be earlier than previous repayment date (chronological order).
 *
 * @param {object} loan
 * @param {Date} paymentDate
 * @returns {Promise<string|null>} error message if invalid, or null if valid
 */
const validateRepaymentDate = async (loan, paymentDate) => {
  const now = new Date();
  if (paymentDate.getTime() > now.getTime()) {
    return "Repayment date cannot be in the future";
  }

  if (loan.loanCreationDate && paymentDate < new Date(loan.loanCreationDate)) {
    return "Repayment date cannot be before the loan creation date";
  }

  if (loan.interestStartDate && paymentDate < new Date(loan.interestStartDate)) {
    return "Repayment date cannot be before the interest start date";
  }

  // Find previous repayment date if any
  let lastRepaymentDate = null;
  if (Array.isArray(loan.repayments) && loan.repayments.length > 0) {
    for (const r of loan.repayments) {
      if (r.date) {
        const rDate = new Date(r.date);
        if (!lastRepaymentDate || rDate > lastRepaymentDate) {
          lastRepaymentDate = rDate;
        }
      }
    }
  }

  const lastTxn = await Transaction.findOne({ loan: loan._id, type: "REPAYMENT" }).sort({ date: -1 });
  if (lastTxn && (!lastRepaymentDate || new Date(lastTxn.date) > lastRepaymentDate)) {
    lastRepaymentDate = new Date(lastTxn.date);
  }

  if (lastRepaymentDate && paymentDate < lastRepaymentDate) {
    return `Repayment date cannot be earlier than previous repayment date (${lastRepaymentDate.toISOString().slice(0, 10)})`;
  }

  return null;
};

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

  if (date !== undefined && !isValidDate(date)) {
    return sendError(res, 400, "A valid repayment date is required");
  }

  const paymentDate = date ? new Date(date) : new Date();

  // TASK 2: Validate repayment date
  const dateError = await validateRepaymentDate(loan, paymentDate);
  if (dateError) {
    return sendError(res, 400, dateError);
  }

  const summaryBefore = interestService.getLoanFinancialSummary(loan, paymentDate);
  if (summaryBefore.remaining <= 0 || loan.status === "PAID") {
    return sendError(res, 400, "This loan is already fully paid off");
  }

  const { interestComponent, principalComponent, excessAmount } = interestService.allocateRepayment(
    loan,
    amount,
    paymentDate
  );

  loan.interestPaid = round2((loan.interestPaid || 0) + interestComponent);
  loan.principalPaid = round2((loan.principalPaid || 0) + principalComponent);

  // Checkpoint accrued interest as of this payment date so already-paid principal
  // does not generate future interest
  loan.interestAccrued = summaryBefore.accruedInterest;
  loan.lastInterestDate = paymentDate;

  // Append to repayments ledger on the loan
  loan.repayments = loan.repayments || [];
  loan.repayments.push({
    date: paymentDate,
    amount: round2(amount),
    principalPaid: principalComponent,
    interestPaid: interestComponent,
  });

  const remainingAfterPayment = round2(
    summaryBefore.remaining - (principalComponent + interestComponent)
  );
  if (remainingAfterPayment <= 0) {
    loan.status = "PAID";
  }

  await loan.save();
  await refreshLoanStatus(loan, paymentDate);

  const summaryAfter = interestService.getLoanFinancialSummary(loan, paymentDate);

  const txnDescription =
    description ||
    (excessAmount > 0
      ? `Repayment received (includes ₹${excessAmount} excess)`
      : "Repayment received");

  const transaction = await Transaction.create({
    lender: req.lender._id,
    borrower: loan.borrower,
    loan: loan._id,
    type: "REPAYMENT",
    amount,
    date: paymentDate,
    description: txnDescription,
    principalComponent,
    interestComponent,
    excessAmount: excessAmount || 0,
    remainingBalanceAfter: summaryAfter.remaining,
  });

  return sendSuccess(res, 201, "Repayment recorded successfully", {
    transaction,
    loan: formatLoanWithSummary(loan),
    allocation: {
      amountPaid: round2(amount),
      appliedToInterest: interestComponent,
      appliedToPrincipal: principalComponent,
      excessAmount: excessAmount || 0,
      remainingInterest: summaryAfter.outstandingInterest,
      remainingPrincipal: summaryAfter.outstandingPrincipal,
      remainingTotalOutstanding: summaryAfter.remaining,
    },
  });
});

// @desc    Preview repayment allocation without persisting changes
// @route   POST /api/loans/:id/repayments/preview
// @access  Private
const getRepaymentPreview = asyncHandler(async (req, res) => {
  const loan = await findOwnedLoan(req, res);
  if (!loan) return;

  const { amount, date } = req.body;

  const amountNum = Number(amount);
  if (!isPositiveNumber(amountNum)) {
    return sendError(res, 400, "Repayment amount must be a positive number");
  }

  if (date !== undefined && !isValidDate(date)) {
    return sendError(res, 400, "A valid date is required");
  }

  const paymentDate = date ? new Date(date) : new Date();

  // TASK 2: Validate preview repayment date
  const dateError = await validateRepaymentDate(loan, paymentDate);
  if (dateError) {
    return sendError(res, 400, dateError);
  }

  const summaryBefore = interestService.getLoanFinancialSummary(loan, paymentDate);

  if (summaryBefore.remaining <= 0 || loan.status === "PAID") {
    return sendError(res, 400, "This loan is already fully paid off");
  }

  const { interestComponent, principalComponent, excessAmount } = interestService.allocateRepayment(
    loan,
    amountNum,
    paymentDate
  );

  const remainingInterest = Math.max(0, round2(summaryBefore.outstandingInterest - interestComponent));
  const remainingPrincipal = Math.max(0, round2(summaryBefore.outstandingPrincipal - principalComponent));
  const remainingTotalOutstanding = Math.max(
    0,
    round2(summaryBefore.remaining - (principalComponent + interestComponent))
  );

  return sendSuccess(res, 200, "Repayment preview calculated", {
    loanId: loan._id,
    paymentAllocation: loan.paymentAllocation,
    allocationRuleLabel: loan.paymentAllocation === "PRINCIPAL_FIRST" ? "Principal First" : "Interest First",
    repaymentAmount: round2(amountNum),
    paymentDate,
    currentOutstanding: {
      outstandingPrincipal: summaryBefore.outstandingPrincipal,
      outstandingInterest: summaryBefore.outstandingInterest,
      totalOutstanding: summaryBefore.remaining,
    },
    allocation: {
      appliedToInterest: interestComponent,
      appliedToPrincipal: principalComponent,
      excessAmount: excessAmount || 0,
    },
    remainingAfter: {
      remainingInterest,
      remainingPrincipal,
      remainingTotalOutstanding,
    },
    fullyRepaysLoan: remainingTotalOutstanding === 0,
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
  getRepaymentPreview,
  formatLoanWithSummary,
  refreshLoanStatus,
  findOwnedLoan,
};
