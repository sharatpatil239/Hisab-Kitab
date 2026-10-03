const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    lender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lender",
      required: true,
      index: true,
    },
    borrower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Borrower",
      required: true,
      index: true,
    },
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["LOAN_DISBURSED", "REPAYMENT", "INTEREST_ACCRUED"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    date: {
      type: Date,
      default: Date.now,
    },

    description: {
      type: String,
      trim: true,
    },

    // Optional breakdown, useful for REPAYMENT transactions so the
    // history explains how the payment was allocated.
    principalComponent: {
      type: Number,
      default: 0,
    },
    interestComponent: {
      type: Number,
      default: 0,
    },
    excessAmount: {
      type: Number,
      default: 0,
    },

    // Snapshot of the loan's outstanding balance right after this
    // transaction was applied - makes the ledger easy to read without
    // recomputing everything.
    remainingBalanceAfter: {
      type: Number,
    },
  },
  { timestamps: true }
);

transactionSchema.index({ lender: 1, loan: 1, date: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);
