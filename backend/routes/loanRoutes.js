const express = require("express");
const router = express.Router();
const {
  createLoan,
  getLoans,
  getOverdueLoans,
  getLoanById,
  updateLoan,
  deleteLoan,
  recordRepayment,
} = require("../controllers/loanController");
const { protect } = require("../middleware/authMiddleware");

// All loan routes require a logged-in lender
router.use(protect);

router.route("/").post(createLoan).get(getLoans);

// Must be defined before "/:id" so "overdue" isn't treated as an :id value
router.get("/overdue", getOverdueLoans);

router.route("/:id").get(getLoanById).put(updateLoan).delete(deleteLoan);

router.post("/:id/repayments", recordRepayment);

module.exports = router;
