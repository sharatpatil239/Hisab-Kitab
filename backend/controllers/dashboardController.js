const Loan = require("../models/Loan");
const Borrower = require("../models/Borrower");
const Transaction = require("../models/Transaction");
const interestService = require("../services/interestService");
const { sendSuccess, asyncHandler, round2 } = require("../utils/helpers");

// @desc    Get an overall dashboard summary for the logged-in lender
// @route   GET /api/dashboard
// @access  Private
const getDashboard = asyncHandler(async (req, res) => {
  const lenderId = req.lender._id;

  const [loans, borrowerCount] = await Promise.all([
    Loan.find({ lender: lenderId }),
    Borrower.countDocuments({ lender: lenderId }),
  ]);

  let totalLent = 0;
  let totalReceived = 0;
  let totalOutstanding = 0;
  let totalInterestAccrued = 0;
  let activeLoanCount = 0;
  let overdueLoanCount = 0;

  const loanSummaries = loans.map((loan) => {
    const summary = interestService.getLoanFinancialSummary(loan);
    const overdue = interestService.isLoanOverdue(loan);

    totalLent += loan.principal;
    totalReceived += summary.totalPaid;
    totalOutstanding += summary.remaining;
    totalInterestAccrued += summary.accruedInterest;

    if (loan.status !== "PAID") activeLoanCount += 1;
    if (overdue) overdueLoanCount += 1;

    return { loan, summary, overdue };
  });

  const activeBorrowerIds = new Set(
    loanSummaries.filter((entry) => entry.loan.status !== "PAID").map((entry) => String(entry.loan.borrower))
  );

  const recentLoans = await Loan.find({ lender: lenderId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("borrower", "name phone");

  const recentRepayments = await Transaction.find({ lender: lenderId, type: "REPAYMENT" })
    .sort({ date: -1 })
    .limit(5)
    .populate("borrower", "name phone");

  const topOutstandingBorrowers = await getTopOutstandingBorrowers(lenderId, loanSummaries);

  return sendSuccess(res, 200, "Dashboard data fetched successfully", {
    totals: {
      totalLent: round2(totalLent),
      totalReceived: round2(totalReceived),
      totalOutstanding: round2(totalOutstanding),
      totalInterestAccrued: round2(totalInterestAccrued),
    },
    counts: {
      totalBorrowers: borrowerCount,
      activeBorrowers: activeBorrowerIds.size,
      totalLoans: loans.length,
      activeLoans: activeLoanCount,
      overdueLoans: overdueLoanCount,
    },
    recentLoans,
    recentRepayments,
    topOutstandingBorrowers,
  });
});

/**
 * Groups outstanding balances by borrower and returns the top 5,
 * sorted from highest outstanding amount to lowest.
 */
const getTopOutstandingBorrowers = async (lenderId, loanSummaries) => {
  const outstandingByBorrower = new Map();

  for (const { loan, summary } of loanSummaries) {
    if (summary.remaining <= 0) continue;
    const key = String(loan.borrower);
    outstandingByBorrower.set(key, round2((outstandingByBorrower.get(key) || 0) + summary.remaining));
  }

  const sorted = [...outstandingByBorrower.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const Borrower = require("../models/Borrower");
  const results = [];
  for (const [borrowerId, outstanding] of sorted) {
    const borrower = await Borrower.findOne({ _id: borrowerId, lender: lenderId }).select("name phone");
    if (borrower) {
      results.push({ borrower, outstanding });
    }
  }
  return results;
};

module.exports = { getDashboard };
