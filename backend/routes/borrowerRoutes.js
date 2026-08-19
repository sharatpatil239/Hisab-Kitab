const express = require("express");
const router = express.Router();
const {
  createBorrower,
  getBorrowers,
  getBorrowerById,
  updateBorrower,
  deleteBorrower,
  getBorrowerAccountSummary,
} = require("../controllers/borrowerController");
const { protect } = require("../middleware/authMiddleware");

// All borrower routes require a logged-in lender
router.use(protect);

router.route("/").post(createBorrower).get(getBorrowers);

router.get("/:id/summary", getBorrowerAccountSummary);

router.route("/:id").get(getBorrowerById).put(updateBorrower).delete(deleteBorrower);

module.exports = router;
