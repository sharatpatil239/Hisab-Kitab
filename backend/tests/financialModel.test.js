const assert = require("assert");
const interestService = require("../services/interestService");
const { round2 } = require("../utils/helpers");

/**
 * ============================================================================
 * HISAB-KITAB FINANCIAL CALCULATION MODEL TEST SUITE
 * ============================================================================
 * Tests business rules A through G and additional edge cases:
 *
 * Case A: ₹20,000 principal, ₹165,000 outstanding interest, ₹20,000 payment, INTEREST_FIRST
 * Case B: ₹20,000 principal, ₹5,000 interest, ₹15,000 payment, PRINCIPAL_FIRST
 * Case C: Payment that completely clears a loan
 * Case D: Payment larger than total outstanding (excess handling without negative values)
 * Case E: Early full repayment before due date (freezes interest, no future accrual)
 * Case F: Overdue loan continuing to accrue interest past due date
 * Case G: Partial principal repayment reducing future interest base
 * Case H: Compound interest consistency with fractional compounding periods
 * Case I: Monetary rounding precision across calculations
 * ============================================================================
 */

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error(`        ${err.message}`);
    failedTests++;
  }
}

console.log("\n=======================================================");
console.log("RUNNING FINANCIAL CALCULATION MODEL TESTS");
console.log("=======================================================\n");

// ----------------------------------------------------------------------------
// TEST A: INTEREST_FIRST Repayment Allocation
// ----------------------------------------------------------------------------
runTest("Test A: Rs 20,000 principal, Rs 165,000 interest, Rs 20,000 payment, INTEREST_FIRST", () => {
  const loan = {
    principal: 20000,
    principalPaid: 0,
    interestPaid: 0,
    interestRate: 10,
    ratePeriod: "MONTHLY",
    interestType: "SIMPLE",
    interestStartDate: new Date("2024-01-01"),
    dueDate: new Date("2025-01-01"),
    paymentAllocation: "INTEREST_FIRST",
    status: "ACTIVE",
    interestAccrued: 165000,
    lastInterestDate: new Date("2024-01-01"),
  };

  const paymentDate = new Date("2024-01-01");
  const summaryBefore = interestService.getLoanFinancialSummary(loan, paymentDate);

  assert.strictEqual(summaryBefore.outstandingPrincipal, 20000, "Outstanding principal before payment must be 20,000");
  assert.strictEqual(summaryBefore.outstandingInterest, 165000, "Outstanding interest before payment must be 165,000");
  assert.strictEqual(summaryBefore.totalOutstanding, 185000, "Total outstanding before payment must be 185,000");

  const allocation = interestService.allocateRepayment(loan, 20000, paymentDate);

  assert.strictEqual(allocation.interestComponent, 20000, "Expected interest paid = 20,000");
  assert.strictEqual(allocation.principalComponent, 0, "Expected principal paid = 0");
  assert.strictEqual(allocation.excessAmount, 0, "Expected excess amount = 0");

  // Apply allocation to loan state
  loan.interestPaid += allocation.interestComponent;
  loan.principalPaid += allocation.principalComponent;

  const summaryAfter = interestService.getLoanFinancialSummary(loan, paymentDate);

  assert.strictEqual(summaryAfter.outstandingInterest, 145000, "Expected remaining interest = 145,000");
  assert.strictEqual(summaryAfter.outstandingPrincipal, 20000, "Expected remaining principal = 20,000");
  assert.strictEqual(summaryAfter.totalOutstanding, 165000, "Expected total outstanding after payment = 165,000");
});

// ----------------------------------------------------------------------------
// TEST B: PRINCIPAL_FIRST Repayment Allocation
// ----------------------------------------------------------------------------
runTest("Test B: Rs 20,000 principal, Rs 5,000 interest, Rs 15,000 payment, PRINCIPAL_FIRST", () => {
  const loan = {
    principal: 20000,
    principalPaid: 0,
    interestPaid: 0,
    interestRate: 12,
    ratePeriod: "YEARLY",
    interestType: "SIMPLE",
    interestStartDate: new Date("2024-01-01"),
    dueDate: new Date("2025-01-01"),
    paymentAllocation: "PRINCIPAL_FIRST",
    status: "ACTIVE",
    interestAccrued: 5000,
    lastInterestDate: new Date("2024-01-01"),
  };

  const paymentDate = new Date("2024-01-01");
  const summaryBefore = interestService.getLoanFinancialSummary(loan, paymentDate);

  assert.strictEqual(summaryBefore.outstandingPrincipal, 20000, "Outstanding principal before payment must be 20,000");
  assert.strictEqual(summaryBefore.outstandingInterest, 5000, "Outstanding interest before payment must be 5,000");

  const allocation = interestService.allocateRepayment(loan, 15000, paymentDate);

  assert.strictEqual(allocation.principalComponent, 15000, "Expected principal paid = 15,000");
  assert.strictEqual(allocation.interestComponent, 0, "Expected interest paid = 0");
  assert.strictEqual(allocation.excessAmount, 0, "Expected excess = 0");

  // Apply allocation
  loan.principalPaid += allocation.principalComponent;
  loan.interestPaid += allocation.interestComponent;

  const summaryAfter = interestService.getLoanFinancialSummary(loan, paymentDate);

  assert.strictEqual(summaryAfter.outstandingPrincipal, 5000, "Expected remaining principal = 5,000");
  assert.strictEqual(summaryAfter.outstandingInterest, 5000, "Expected remaining interest = 5,000");
  assert.strictEqual(summaryAfter.totalOutstanding, 10000, "Expected remaining total = 10,000");
});

// ----------------------------------------------------------------------------
// TEST C: Payment that completely clears a loan
// ----------------------------------------------------------------------------
runTest("Test C: Payment that completely clears a loan", () => {
  const loan = {
    principal: 10000,
    principalPaid: 0,
    interestPaid: 0,
    interestRate: 10,
    ratePeriod: "MONTHLY",
    interestType: "SIMPLE",
    interestStartDate: new Date("2024-01-01"),
    dueDate: new Date("2025-01-01"),
    paymentAllocation: "INTEREST_FIRST",
    status: "ACTIVE",
    interestAccrued: 1500,
    lastInterestDate: new Date("2024-01-01"),
  };

  const paymentDate = new Date("2024-01-01");
  const summaryBefore = interestService.getLoanFinancialSummary(loan, paymentDate);
  const totalDue = summaryBefore.totalOutstanding; // 11,500

  assert.strictEqual(totalDue, 11500, "Total due should be 11,500");

  const allocation = interestService.allocateRepayment(loan, 11500, paymentDate);

  assert.strictEqual(allocation.interestComponent, 1500, "Interest component should be exactly 1,500");
  assert.strictEqual(allocation.principalComponent, 10000, "Principal component should be exactly 10,000");
  assert.strictEqual(allocation.excessAmount, 0, "Excess amount should be 0");

  // Update loan
  loan.interestPaid += allocation.interestComponent;
  loan.principalPaid += allocation.principalComponent;
  const remaining = round2(summaryBefore.totalOutstanding - (allocation.principalComponent + allocation.interestComponent));
  if (remaining <= 0) {
    loan.status = "PAID";
  }

  assert.strictEqual(loan.status, "PAID", "Loan status must become PAID");

  const summaryAfter = interestService.getLoanFinancialSummary(loan, paymentDate);
  assert.strictEqual(summaryAfter.remaining, 0, "Remaining total must be 0");
  assert.strictEqual(summaryAfter.totalOutstanding, 0, "Total outstanding must be 0");
  assert.strictEqual(summaryAfter.outstandingPrincipal, 0, "Outstanding principal must be 0");
  assert.strictEqual(summaryAfter.outstandingInterest, 0, "Outstanding interest must be 0");
});

// ----------------------------------------------------------------------------
// TEST D: Payment larger than total outstanding (safe excess handling)
// ----------------------------------------------------------------------------
runTest("Test D: Payment larger than total outstanding", () => {
  const loan = {
    principal: 10000,
    principalPaid: 0,
    interestPaid: 0,
    interestRate: 12,
    ratePeriod: "YEARLY",
    interestType: "SIMPLE",
    interestStartDate: new Date("2024-01-01"),
    dueDate: new Date("2025-01-01"),
    paymentAllocation: "INTEREST_FIRST",
    status: "ACTIVE",
    interestAccrued: 2000,
    lastInterestDate: new Date("2024-01-01"),
  };

  const paymentDate = new Date("2024-01-01");
  const summaryBefore = interestService.getLoanFinancialSummary(loan, paymentDate);
  assert.strictEqual(summaryBefore.totalOutstanding, 12000, "Total outstanding should be 12,000");

  // Borrower pays 15,000 (3,000 excess)
  const allocation = interestService.allocateRepayment(loan, 15000, paymentDate);

  assert.strictEqual(allocation.interestComponent, 2000, "Interest component should cap at 2,000");
  assert.strictEqual(allocation.principalComponent, 10000, "Principal component should cap at 10,000");
  assert.strictEqual(allocation.excessAmount, 3000, "Excess amount must be exactly 3,000");

  // Update loan
  loan.interestPaid += allocation.interestComponent;
  loan.principalPaid += allocation.principalComponent;
  loan.status = "PAID";

  const summaryAfter = interestService.getLoanFinancialSummary(loan, paymentDate);

  assert.strictEqual(summaryAfter.remaining, 0, "Remaining must be 0 (no negative values)");
  assert.strictEqual(summaryAfter.outstandingPrincipal, 0, "Outstanding principal must be 0");
  assert.strictEqual(summaryAfter.outstandingInterest, 0, "Outstanding interest must be 0");
  assert.ok(summaryAfter.remaining >= 0, "Remaining balance must never be negative");
});

// ----------------------------------------------------------------------------
// TEST E: Early full repayment before due date
// ----------------------------------------------------------------------------
runTest("Test E: Early full repayment before due date", () => {
  // 1 year loan with simple interest
  // Created Jan 1, 2024, due Dec 31, 2024 (365 days)
  // Repaid in full early on March 1, 2024 (60 days elapsed)
  const startDate = new Date("2024-01-01T00:00:00.000Z");
  const dueDate = new Date("2024-12-31T00:00:00.000Z");
  const earlyPayoffDate = new Date("2024-03-01T00:00:00.000Z"); // 60 days later

  const loan = {
    principal: 100000,
    principalPaid: 0,
    interestPaid: 0,
    interestRate: 12, // 12% per year
    ratePeriod: "YEARLY",
    interestType: "SIMPLE",
    interestStartDate: startDate,
    dueDate: dueDate,
    paymentAllocation: "INTEREST_FIRST",
    status: "ACTIVE",
    repayments: [],
  };

  // Check financial summary at early payoff date
  const summaryAtPayoff = interestService.getLoanFinancialSummary(loan, earlyPayoffDate);
  const daysAtPayoff = interestService.getElapsedDays(startDate, earlyPayoffDate);
  assert.strictEqual(daysAtPayoff, 60, "Elapsed days should be 60");

  // Expected interest for 60 days: 100000 * (0.12/365) * 60 = 1972.60
  const expectedAccruedInterest = round2(100000 * (0.12 / 365) * 60);
  assert.strictEqual(summaryAtPayoff.accruedInterest, expectedAccruedInterest, "Accrued interest on March 1 should match 60 days");

  // Pay in full on March 1
  const payoffAmount = summaryAtPayoff.totalOutstanding;
  const allocation = interestService.allocateRepayment(loan, payoffAmount, earlyPayoffDate);

  loan.interestPaid = allocation.interestComponent;
  loan.principalPaid = allocation.principalComponent;
  loan.status = "PAID";
  loan.interestAccrued = summaryAtPayoff.accruedInterest;
  loan.lastInterestDate = earlyPayoffDate;
  loan.repayments.push({
    date: earlyPayoffDate,
    amount: payoffAmount,
    principalPaid: allocation.principalComponent,
    interestPaid: allocation.interestComponent,
  });

  // Verify financial summary on the original due date (Dec 31, 2024)
  const summaryAtDueDate = interestService.getLoanFinancialSummary(loan, dueDate);

  assert.strictEqual(summaryAtDueDate.outstandingPrincipal, 0, "Outstanding principal on due date must remain 0");
  assert.strictEqual(summaryAtDueDate.outstandingInterest, 0, "Outstanding interest on due date must remain 0");
  assert.strictEqual(summaryAtDueDate.totalOutstanding, 0, "Total outstanding on due date must remain 0");
  assert.strictEqual(summaryAtDueDate.accruedInterest, expectedAccruedInterest, "Accrued interest must remain frozen at early payoff amount");
  assert.strictEqual(loan.status, "PAID", "Loan status must remain PAID");
});

// ----------------------------------------------------------------------------
// TEST F: Overdue loan continuing to accrue interest past due date
// ----------------------------------------------------------------------------
runTest("Test F: Overdue loan continuing to accrue interest past due date", () => {
  const startDate = new Date("2024-01-01T00:00:00.000Z");
  const dueDate = new Date("2024-02-01T00:00:00.000Z"); // 31 days
  const overdueDate = new Date("2024-03-02T00:00:00.000Z"); // 61 days (30 days past due date)

  const loan = {
    principal: 50000,
    principalPaid: 0,
    interestPaid: 0,
    interestRate: 10, // 10% per month (approx 30 days)
    ratePeriod: "MONTHLY",
    interestType: "SIMPLE",
    interestStartDate: startDate,
    dueDate: dueDate,
    paymentAllocation: "INTEREST_FIRST",
    status: "ACTIVE",
    repayments: [],
  };

  // On due date (31 days)
  const summaryOnDueDate = interestService.getLoanFinancialSummary(loan, dueDate);
  const isOverdueAtDue = interestService.isLoanOverdue(loan, dueDate);
  assert.strictEqual(isOverdueAtDue, false, "Loan should not be overdue on or before due date");

  // On overdue date (61 days)
  const isOverdueAfter = interestService.isLoanOverdue(loan, overdueDate);
  assert.strictEqual(isOverdueAfter, true, "Loan must be identified as overdue after due date");

  const summaryOverdue = interestService.getLoanFinancialSummary(loan, overdueDate);
  const expectedOverdueInterest = round2(50000 * (0.10 / 30) * 61);

  assert.strictEqual(summaryOverdue.accruedInterest, expectedOverdueInterest, "Interest must continue accruing for all 61 days");
  assert.ok(summaryOverdue.accruedInterest > summaryOnDueDate.accruedInterest, "Interest on overdue date must be higher than interest on due date");
});

// ----------------------------------------------------------------------------
// TEST G: Partial principal repayment reducing future interest base
// ----------------------------------------------------------------------------
runTest("Test G: Partial principal repayment reducing future interest base", () => {
  const startDate = new Date("2024-01-01T00:00:00.000Z");
  const paymentDate = new Date("2024-01-31T00:00:00.000Z"); // 30 days
  const futureDate = new Date("2024-03-01T00:00:00.000Z"); // 60 days total from start (30 days after payment)

  const loan = {
    principal: 20000,
    principalPaid: 0,
    interestPaid: 0,
    interestRate: 12, // 12% per year
    ratePeriod: "YEARLY",
    interestType: "SIMPLE",
    interestStartDate: startDate,
    dueDate: new Date("2024-12-31T00:00:00.000Z"),
    paymentAllocation: "PRINCIPAL_FIRST",
    status: "ACTIVE",
    repayments: [],
  };

  // 1. Accrual before payment (Day 0 to Day 30 on 20,000)
  const summaryDay30 = interestService.getLoanFinancialSummary(loan, paymentDate);
  const expectedInterestP1 = round2(20000 * (0.12 / 365) * 30); // 197.26
  assert.strictEqual(summaryDay30.accruedInterest, expectedInterestP1, "Interest for first 30 days should be 197.26");

  // 2. Borrower pays 15,000 under PRINCIPAL_FIRST
  const allocation = interestService.allocateRepayment(loan, 15000, paymentDate);
  assert.strictEqual(allocation.principalComponent, 15000, "Principal paid should be 15,000");
  assert.strictEqual(allocation.interestComponent, 0, "Interest paid should be 0");

  loan.principalPaid += allocation.principalComponent;
  loan.interestPaid += allocation.interestComponent;
  loan.interestAccrued = summaryDay30.accruedInterest;
  loan.lastInterestDate = paymentDate;
  loan.repayments.push({
    date: paymentDate,
    amount: 15000,
    principalPaid: 15000,
    interestPaid: 0,
  });

  // 3. Check financial state at Day 60 (30 days later)
  const summaryDay60 = interestService.getLoanFinancialSummary(loan, futureDate);

  // Interval 1: 30 days on 20,000 = 197.26
  // Interval 2: 30 days on 5,000 = round2(5000 * (0.12 / 365) * 30) = 49.32
  // Total expected accrued interest = 197.26 + 49.32 = 246.58
  const expectedInterestP2 = round2(5000 * (0.12 / 365) * 30);
  const expectedTotalInterest = round2(expectedInterestP1 + expectedInterestP2); // 246.58

  assert.strictEqual(summaryDay60.outstandingPrincipal, 5000, "Outstanding principal on Day 60 must be 5,000");
  assert.strictEqual(summaryDay60.accruedInterest, expectedTotalInterest, "Total accrued interest must be 246.58 (reduced base for period 2)");

  // Counterfactual check: If full 20,000 had wrongly continued accruing:
  const wrongInterest = round2(20000 * (0.12 / 365) * 60); // 394.52
  assert.notStrictEqual(summaryDay60.accruedInterest, wrongInterest, "Must NOT continue accruing on the full 20,000 principal");
  assert.strictEqual(summaryDay60.outstandingInterest, expectedTotalInterest, "Outstanding interest must match accrued since 0 interest was paid");
  assert.strictEqual(summaryDay60.totalOutstanding, round2(5000 + expectedTotalInterest), "Total outstanding must equal 5,000 + 246.58 = 5246.58");
});

// ----------------------------------------------------------------------------
// TEST H: Compound Interest with Fractional Compounding Periods
// ----------------------------------------------------------------------------
runTest("Test H: Compound interest consistency with fractional compounding periods", () => {
  const principal = 10000;
  const rate = 10; // 10%
  const ratePeriod = "MONTHLY"; // 30 days per period

  // Exactly 1 period (30 days): 10,000 * (1 + 0.10)^1 - 10000 = 1000
  const interest1Period = interestService.calculateCompoundInterest(principal, rate, ratePeriod, 30);
  assert.strictEqual(interest1Period, 1000.00, "1 period compound interest should be exactly 1000");

  // Exactly 2 periods (60 days): 10,000 * (1.10)^2 - 10000 = 2100
  const interest2Periods = interestService.calculateCompoundInterest(principal, rate, ratePeriod, 60);
  assert.strictEqual(interest2Periods, 2100.00, "2 periods compound interest should be exactly 2100");

  // Fractional period (45 days = 1.5 periods): 10,000 * (1.10)^1.5 - 10000
  // (1.10)^1.5 = 1.1536897
  // Interest = 1536.90
  const interestFractional = interestService.calculateCompoundInterest(principal, rate, ratePeriod, 45);
  const expectedFractional = round2(10000 * (Math.pow(1.10, 1.5) - 1));
  assert.strictEqual(interestFractional, expectedFractional, "Fractional compounding should smoothly evaluate 1.5 periods to 1536.90");
});

// ----------------------------------------------------------------------------
// TEST I: Consistent Monetary Rounding and Float Protection
// ----------------------------------------------------------------------------
runTest("Test I: Floating-point precision and rounding protection", () => {
  // Simulate values that typically trigger floating point issues like 164999.99999997
  const val1 = 0.1 + 0.2; // 0.30000000000000004 in raw JS
  assert.strictEqual(round2(val1), 0.3, "round2 should correctly round 0.1 + 0.2 to 0.3");

  const trickyVal = 165000 - 0.00000003;
  assert.strictEqual(round2(trickyVal), 165000, "round2 should eliminate tiny fractional float artifacts");

  const testLoan = {
    principal: 20000,
    principalPaid: 0,
    interestPaid: 0,
    interestRate: 7.33,
    ratePeriod: "YEARLY",
    interestType: "SIMPLE",
    interestStartDate: new Date("2024-01-01"),
    dueDate: new Date("2025-01-01"),
    paymentAllocation: "INTEREST_FIRST",
    status: "ACTIVE",
  };
  const summary = interestService.getLoanFinancialSummary(testLoan, new Date("2024-07-15"));

  // Check all fields are rounded to at most 2 decimal places
  const checkDecimals = (num) => {
    const str = num.toString();
    const parts = str.split(".");
    return parts.length === 1 || parts[1].length <= 2;
  };

  assert.ok(checkDecimals(summary.principal), "principal must have <= 2 decimals");
  assert.ok(checkDecimals(summary.accruedInterest), "accruedInterest must have <= 2 decimals");
  assert.ok(checkDecimals(summary.totalDue), "totalDue must have <= 2 decimals");
  assert.ok(checkDecimals(summary.outstandingPrincipal), "outstandingPrincipal must have <= 2 decimals");
  assert.ok(checkDecimals(summary.outstandingInterest), "outstandingInterest must have <= 2 decimals");
  assert.ok(checkDecimals(summary.totalOutstanding), "totalOutstanding must have <= 2 decimals");
});

console.log("\n=======================================================");
console.log(`TEST SUMMARY: ${passedTests} passed, ${failedTests} failed`);
console.log("=======================================================\n");

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
