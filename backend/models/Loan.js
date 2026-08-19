const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema(
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

    // Original amount disbursed to the borrower. This never changes after
    // creation - it is the base used for interest calculation.
    principal: {
      type: Number,
      required: [true, "Principal amount is required"],
      min: [0.01, "Principal must be a positive amount"],
    },

    // Cumulative amount that has been applied towards paying off the
    // principal (as opposed to interest). Updated whenever a repayment
    // is recorded, based on the loan's paymentAllocation rule.
    principalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Cumulative amount that has been applied towards paying off interest.
    interestPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    interestType: {
      type: String,
      enum: ["SIMPLE", "COMPOUND"],
      required: [true, "Interest type is required"],
    },

    interestRate: {
      type: Number,
      required: [true, "Interest rate is required"],
      min: [0, "Interest rate cannot be negative"],
    },

    // The period the interestRate applies to, e.g. a rate of 12 with
    // ratePeriod YEARLY means "12% per year".
    ratePeriod: {
      type: String,
      enum: ["DAILY", "MONTHLY", "YEARLY"],
      required: [true, "Interest rate period is required"],
    },

    // Date from which interest starts accruing.
    interestStartDate: {
      type: Date,
      required: [true, "Interest start date is required"],
    },

    // Date by which the loan should be fully repaid.
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },

    // Date the loan/money was actually disbursed.
    loanCreationDate: {
      type: Date,
      default: Date.now,
    },

    description: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "PAID", "OVERDUE"],
      default: "ACTIVE",
    },

    // Determines how a repayment is split between outstanding interest
    // and outstanding principal. Defaults to INTEREST_FIRST.
    paymentAllocation: {
      type: String,
      enum: ["INTEREST_FIRST", "PRINCIPAL_FIRST"],
      default: "INTEREST_FIRST",
    },
  },
  { timestamps: true }
);

loanSchema.index({ lender: 1, borrower: 1 });
loanSchema.index({ lender: 1, status: 1 });

module.exports = mongoose.model("Loan", loanSchema);
