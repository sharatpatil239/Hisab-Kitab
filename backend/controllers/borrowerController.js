const Borrower = require("../models/Borrower");
const Loan = require("../models/Loan");
const Transaction = require("../models/Transaction");
const interestService = require("../services/interestService");
const { sendSuccess, sendError, asyncHandler, round2 } = require("../utils/helpers");
const { isNonEmptyString } = require("../utils/validators");

// @desc    Add a new borrower
// @route   POST /api/borrowers
// @access  Private
const createBorrower = asyncHandler(async (req, res) => {
  const { name, phone, email, address, notes } = req.body;

  if (!isNonEmptyString(name)) {
    return sendError(res, 400, "Borrower name is required");
  }
  if (!isNonEmptyString(phone)) {
    return sendError(res, 400, "Borrower phone number is required");
  }

  const borrower = await Borrower.create({
    lender: req.lender._id,
    name,
    phone,
    email,
    address,
    notes,
  });

  return sendSuccess(res, 201, "Borrower created successfully", { borrower });
});

// @desc    Get all borrowers for the logged-in lender (with optional search)
// @route   GET /api/borrowers?search=someName
// @access  Private
const getBorrowers = asyncHandler(async (req, res) => {
  const { search } = req.query;

  const query = { lender: req.lender._id };

  if (search && isNonEmptyString(search)) {
    const searchRegex = new RegExp(search.trim(), "i");
    query.$or = [{ name: searchRegex }, { phone: searchRegex }, { email: searchRegex }];
  }

  const borrowers = await Borrower.find(query).sort({ createdAt: -1 });

  return sendSuccess(res, 200, "Borrowers fetched successfully", {
    count: borrowers.length,
    borrowers,
  });
});

/**
 * Helper: fetches a borrower and confirms it belongs to the logged-in
 * lender. Returns null (and sends a response) if not found/authorized.
 */
const findOwnedBorrower = async (req, res) => {
  const borrower = await Borrower.findOne({ _id: req.params.id, lender: req.lender._id });
  if (!borrower) {
    sendError(res, 404, "Borrower not found");
    return null;
  }
  return borrower;
};

// @desc    Get a single borrower
// @route   GET /api/borrowers/:id
// @access  Private
const getBorrowerById = asyncHandler(async (req, res) => {
  const borrower = await findOwnedBorrower(req, res);
  if (!borrower) return;

  return sendSuccess(res, 200, "Borrower fetched successfully", { borrower });
});

// @desc    Update a borrower
// @route   PUT /api/borrowers/:id
// @access  Private
const updateBorrower = asyncHandler(async (req, res) => {
  const borrower = await findOwnedBorrower(req, res);
  if (!borrower) return;

  const { name, phone, email, address, notes } = req.body;

  if (name !== undefined) {
    if (!isNonEmptyString(name)) return sendError(res, 400, "Name cannot be empty");
    borrower.name = name;
  }
  if (phone !== undefined) {
    if (!isNonEmptyString(phone)) return sendError(res, 400, "Phone cannot be empty");
    borrower.phone = phone;
  }
  if (email !== undefined) borrower.email = email;
  if (address !== undefined) borrower.address = address;
  if (notes !== undefined) borrower.notes = notes;

  await borrower.save();

  return sendSuccess(res, 200, "Borrower updated successfully", { borrower });
});

// @desc    Delete a borrower
// @route   DELETE /api/borrowers/:id
// @access  Private
const deleteBorrower = asyncHandler(async (req, res) => {
  const borrower = await findOwnedBorrower(req, res);
  if (!borrower) return;

  // Prevent deleting a borrower who still has loans on record, so the
  // ledger history is never orphaned or accidentally destroyed.
  const loanCount = await Loan.countDocuments({ borrower: borrower._id, lender: req.lender._id });
  if (loanCount > 0) {
    return sendError(
      res,
      400,
      "Cannot delete a borrower who has loan records. Please resolve or remove their loans first."
    );
  }

  await borrower.deleteOne();

  return sendSuccess(res, 200, "Borrower deleted successfully", {});
});

// @desc    Get a borrower's complete account summary: their info, every
//          loan (with live financial summary), and full transaction history
// @route   GET /api/borrowers/:id/summary
// @access  Private
const getBorrowerAccountSummary = asyncHandler(async (req, res) => {
  const borrower = await findOwnedBorrower(req, res);
  if (!borrower) return;

  const loans = await Loan.find({ borrower: borrower._id, lender: req.lender._id }).sort({
    createdAt: -1,
  });

  const loansWithSummary = loans.map((loan) => {
    const summary = interestService.getLoanFinancialSummary(loan);
    const effectiveStatus = interestService.getEffectiveLoanStatus(loan);
    if (loan.status !== effectiveStatus) {
      loan.status = effectiveStatus;
      loan.save().catch(() => {});
    }
    return {
      id: loan._id,
      principal: round2(loan.principal),
      principalPaid: loan.principalPaid,
      interestPaid: loan.interestPaid,
      interestType: loan.interestType,
      interestRate: loan.interestRate,
      ratePeriod: loan.ratePeriod,
      interestStartDate: loan.interestStartDate,
      dueDate: loan.dueDate,
      loanCreationDate: loan.loanCreationDate,
      status: effectiveStatus,
      paymentAllocation: loan.paymentAllocation,
      ...summary,
    };
  });

  const loanIds = loans.map((loan) => loan._id);
  const transactions = await Transaction.find({ loan: { $in: loanIds } }).sort({ date: 1 });

  const totals = loansWithSummary.reduce(
    (acc, loan) => {
      acc.totalPrincipalLent += loan.principal;
      acc.totalInterestAccrued += loan.accruedInterest;
      acc.totalRepaid += loan.totalPaid;
      acc.outstandingPrincipal += loan.outstandingPrincipal;
      acc.outstandingInterest += loan.outstandingInterest;
      acc.totalOutstanding += loan.remaining;
      return acc;
    },
    {
      totalPrincipalLent: 0,
      totalInterestAccrued: 0,
      totalRepaid: 0,
      outstandingPrincipal: 0,
      outstandingInterest: 0,
      totalOutstanding: 0,
    }
  );

  totals.totalPrincipalLent = round2(totals.totalPrincipalLent);
  totals.totalInterestAccrued = round2(totals.totalInterestAccrued);
  totals.totalRepaid = round2(totals.totalRepaid);
  totals.outstandingPrincipal = round2(totals.outstandingPrincipal);
  totals.outstandingInterest = round2(totals.outstandingInterest);
  totals.totalOutstanding = round2(totals.totalOutstanding);
  // Maintain backward-compatible aliases
  totals.totalLent = totals.totalPrincipalLent;
  totals.totalPaid = totals.totalRepaid;

  return sendSuccess(res, 200, "Borrower account summary fetched successfully", {
    borrower,
    loans: loansWithSummary,
    transactions,
    totals,
  });
});

module.exports = {
  createBorrower,
  getBorrowers,
  getBorrowerById,
  updateBorrower,
  deleteBorrower,
  findOwnedBorrower,
  getBorrowerAccountSummary,
};
