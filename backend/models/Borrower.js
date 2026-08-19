const mongoose = require("mongoose");

const borrowerSchema = new mongoose.Schema(
  {
    lender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lender",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Borrower name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Borrower phone number is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Speeds up "search my borrowers by name/phone" queries
borrowerSchema.index({ lender: 1, name: 1 });

module.exports = mongoose.model("Borrower", borrowerSchema);
