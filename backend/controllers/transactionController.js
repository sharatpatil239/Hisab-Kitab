const Transaction = require("../models/Transaction");
const { sendSuccess, asyncHandler } = require("../utils/helpers");

// @desc    Get transactions for the logged-in lender, optionally filtered
//          by borrower and/or loan
// @route   GET /api/transactions?borrowerId=&loanId=&type=
// @access  Private
const getTransactions = asyncHandler(async (req, res) => {
  const { borrowerId, loanId, type } = req.query;

  const query = { lender: req.lender._id };
  if (borrowerId) query.borrower = borrowerId;
  if (loanId) query.loan = loanId;
  if (type) query.type = type;

  const transactions = await Transaction.find(query).sort({ date: -1 });

  return sendSuccess(res, 200, "Transactions fetched successfully", {
    count: transactions.length,
    transactions,
  });
});

// @desc    Get a single transaction by id
// @route   GET /api/transactions/:id
// @access  Private
const getTransactionById = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({ _id: req.params.id, lender: req.lender._id });
  if (!transaction) {
    return res.status(404).json({ success: false, message: "Transaction not found" });
  }
  return sendSuccess(res, 200, "Transaction fetched successfully", { transaction });
});

module.exports = { getTransactions, getTransactionById };
