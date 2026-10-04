const assert = require("assert");
const interestService = require("../services/interestService");
const { round2 } = require("../utils/helpers");

/**
 * ============================================================================
 * HISAB-KITAB DATE VALIDATION, OVERDUE CONSISTENCY & LOAN TERM PROTECTION TESTS
 * ============================================================================
 * Tests required by TASK 8:
 * - valid loan dates
 * - invalid loan dates
 * - future repayment
 * - repayment before interest start
 * - ACTIVE loan
 * - OVERDUE loan
 * - PAID loan
 * - overdue filtering
 * - early full repayment
 * - editing loan after repayment
 * - editing loan before repayment
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
console.log("RUNNING DATE VALIDATION, OVERDUE STATUS & EDIT PROTECTION TESTS");
console.log("=======================================================\n");

// Helper to simulate date validation logic from createLoan
function validateLoanDates(loanCreationDate, interestStartDate, dueDate) {
  const creationDate = loanCreationDate ? new Date(loanCreationDate) : new Date(interestStartDate);
  const startDate = new Date(interestStartDate);
  const endDate = new Date(dueDate);

  if (Number.isNaN(startDate.getTime())) return "A valid interestStartDate is required";
  if (Number.isNaN(endDate.getTime())) return "A valid dueDate is required";
  if (loanCreationDate && Number.isNaN(creationDate.getTime())) return "A valid loanCreationDate is required";

  if (creationDate > startDate) {
    return "interestStartDate cannot be before loanCreationDate";
  }
  if (startDate > endDate) {
    return "dueDate cannot be before interestStartDate";
  }
  if (creationDate > endDate) {
    return "dueDate cannot be before loanCreationDate";
  }
  return null; // Valid
}

// Helper to simulate repayment date validation logic
function validateRepaymentDateRule(loan, paymentDate, priorRepayments = []) {
  const pDate = new Date(paymentDate);
  const now = new Date();

  if (Number.isNaN(pDate.getTime())) return "A valid repayment date is required";

  if (pDate.getTime() > now.getTime()) {
    return "Repayment date cannot be in the future";
  }

  if (loan.loanCreationDate && pDate < new Date(loan.loanCreationDate)) {
    return "Repayment date cannot be before the loan creation date";
  }

  if (loan.interestStartDate && pDate < new Date(loan.interestStartDate)) {
    return "Repayment date cannot be before the interest start date";
  }

  // Check chronological order against prior repayments
  let lastRepaymentDate = null;
  for (const r of priorRepayments) {
    if (r.date) {
      const rDate = new Date(r.date);
      if (!lastRepaymentDate || rDate > lastRepaymentDate) {
        lastRepaymentDate = rDate;
      }
    }
  }

  if (lastRepaymentDate && pDate < lastRepaymentDate) {
    return `Repayment date cannot be earlier than previous repayment date (${lastRepaymentDate.toISOString().slice(0, 10)})`;
  }

  return null; // Valid
}

// Helper to simulate loan editing validation logic
function validateLoanEdit(loan, proposedUpdate, hasRepayments) {
  const PROTECTED_FINANCIAL_FIELDS = [
    "principal",
    "interestType",
    "interestRate",
    "ratePeriod",
    "interestStartDate",
    "paymentAllocation",
  ];

  const toDateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);

  if (hasRepayments) {
    const attemptedChanges = [];
    for (const field of PROTECTED_FINANCIAL_FIELDS) {
      if (proposedUpdate[field] !== undefined) {
        const propVal = field === "interestStartDate" ? toDateOnly(proposedUpdate[field]) : proposedUpdate[field];
        const currVal = field === "interestStartDate" ? toDateOnly(loan[field]) : loan[field];
        if (propVal !== currVal) {
          attemptedChanges.push(field);
        }
      }
    }

    if (attemptedChanges.length > 0) {
      return {
        allowed: false,
        error: `Cannot modify financial terms (${attemptedChanges.join(", ")}) after repayments have been recorded on this loan.`,
      };
    }
  } else {
    // Before repayments: financial fields can be edited with date checks
    if (proposedUpdate.interestStartDate) {
      const newStart = new Date(proposedUpdate.interestStartDate);
      const creation = loan.loanCreationDate ? new Date(loan.loanCreationDate) : newStart;
      const targetDue = proposedUpdate.dueDate ? new Date(proposedUpdate.dueDate) : new Date(loan.dueDate);

      if (newStart < creation) {
        return { allowed: false, error: "interestStartDate cannot be before loanCreationDate" };
      }
      if (newStart > targetDue) {
        return { allowed: false, error: "dueDate cannot be before interestStartDate" };
      }
    }
  }

  if (proposedUpdate.dueDate) {
    const targetStart = proposedUpdate.interestStartDate
      ? new Date(proposedUpdate.interestStartDate)
      : new Date(loan.interestStartDate);
    if (new Date(proposedUpdate.dueDate) < targetStart) {
      return { allowed: false, error: "dueDate cannot be before interestStartDate" };
    }
  }

  return { allowed: true, error: null };
}

// ----------------------------------------------------------------------------
// 1. VALID LOAN DATES
// ----------------------------------------------------------------------------
runTest("1. Valid loan dates: creation <= interestStartDate <= dueDate", () => {
  // Case A: Same-day disbursement and interest start
  const err1 = validateLoanDates("2024-01-01", "2024-01-01", "2024-12-31");
  assert.strictEqual(err1, null, "Same-day creation and interest start date should be valid");

  // Case B: Interest starts later than creation (e.g. grace period)
  const err2 = validateLoanDates("2024-01-01", "2024-02-01", "2024-12-31");
  assert.strictEqual(err2, null, "Interest starting after disbursement date should be allowed");

  // Case C: Due date equals interest start date
  const err3 = validateLoanDates("2024-01-01", "2024-01-01", "2024-01-01");
  assert.strictEqual(err3, null, "Due date equal to interest start date should be valid");
});

// ----------------------------------------------------------------------------
// 2. INVALID LOAN DATES
// ----------------------------------------------------------------------------
runTest("2. Invalid loan dates: reject invalid combinations with clear errors", () => {
  // Case A: Interest start before loan creation date
  const err1 = validateLoanDates("2024-02-01", "2024-01-01", "2024-12-31");
  assert.strictEqual(err1, "interestStartDate cannot be before loanCreationDate");

  // Case B: Due date before interest start date
  const err2 = validateLoanDates("2024-01-01", "2024-05-01", "2024-04-01");
  assert.strictEqual(err2, "dueDate cannot be before interestStartDate");

  // Case C: Due date before loan creation date
  const err3 = validateLoanDates("2024-05-01", "2024-05-01", "2024-04-01");
  assert.ok(err3 !== null, "Due date before creation date must be rejected");
});

// ----------------------------------------------------------------------------
// 3. FUTURE REPAYMENT
// ----------------------------------------------------------------------------
runTest("3. Future repayment: reject repayment date in the future", () => {
  const loan = {
    loanCreationDate: new Date("2024-01-01"),
    interestStartDate: new Date("2024-01-01"),
    dueDate: new Date("2025-01-01"),
  };

  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days in future
  const err = validateRepaymentDateRule(loan, futureDate);
  assert.strictEqual(err, "Repayment date cannot be in the future");

  const today = new Date();
  const validTodayErr = validateRepaymentDateRule(loan, today);
  assert.strictEqual(validTodayErr, null, "Today's repayment date should be valid");
});

// ----------------------------------------------------------------------------
// 4. REPAYMENT BEFORE INTEREST START / OUT OF ORDER
// ----------------------------------------------------------------------------
runTest("4. Repayment before interest start / chronological violation", () => {
  const loan = {
    loanCreationDate: new Date("2024-01-01"),
    interestStartDate: new Date("2024-02-01"),
    dueDate: new Date("2024-12-31"),
  };

  // Repayment before interest start date
  const errBeforeStart = validateRepaymentDateRule(loan, new Date("2024-01-15"));
  assert.strictEqual(errBeforeStart, "Repayment date cannot be before the interest start date");

  // Repayment on or after interest start date
  const errValidDate = validateRepaymentDateRule(loan, new Date("2024-02-05"));
  assert.strictEqual(errValidDate, null, "Repayment on or after interest start date should be allowed");

  // Repayment earlier than previous repayment date
  const priorRepayments = [{ date: new Date("2024-03-15"), amount: 5000 }];
  const errOutOfOrder = validateRepaymentDateRule(loan, new Date("2024-03-10"), priorRepayments);
  assert.ok(errOutOfOrder.includes("cannot be earlier than previous repayment date"), "Out of order repayment must be rejected");

  // Repayment on or after previous repayment date
  const validSecondPayment = validateRepaymentDateRule(loan, new Date("2024-03-15"), priorRepayments);
  assert.strictEqual(validSecondPayment, null, "Same day or later repayment should be allowed");
});

// ----------------------------------------------------------------------------
// 5. ACTIVE LOAN STATUS
// ----------------------------------------------------------------------------
runTest("5. ACTIVE loan: totalOutstanding > 0 and today <= due date", () => {
  const loan = {
    principal: 10000,
    principalPaid: 0,
    interestPaid: 0,
    interestRate: 10,
    ratePeriod: "MONTHLY",
    interestType: "SIMPLE",
    interestStartDate: new Date("2024-01-01"),
    dueDate: new Date("2024-12-31"),
    paymentAllocation: "INTEREST_FIRST",
    status: "ACTIVE",
  };

  // As of 2024-06-01 (before dueDate):
  const asOf = new Date("2024-06-01");
  const effectiveStatus = interestService.getEffectiveLoanStatus(loan, asOf);
  assert.strictEqual(effectiveStatus, "ACTIVE", "Loan with remaining balance before due date must be ACTIVE");
  assert.strictEqual(interestService.isLoanOverdue(loan, asOf), false);
});

// ----------------------------------------------------------------------------
// 6. OVERDUE LOAN STATUS
// ----------------------------------------------------------------------------
runTest("6. OVERDUE loan: totalOutstanding > 0 and today > due date", () => {
  const loan = {
    principal: 10000,
    principalPaid: 0,
    interestPaid: 0,
    interestRate: 10,
    ratePeriod: "MONTHLY",
    interestType: "SIMPLE",
    interestStartDate: new Date("2024-01-01"),
    dueDate: new Date("2024-06-01"),
    paymentAllocation: "INTEREST_FIRST",
    status: "ACTIVE", // Currently stored as ACTIVE in DB
  };

  // As of 2024-06-02 (1 day past dueDate):
  const overdueDate = new Date("2024-06-02");
  const effectiveStatus = interestService.getEffectiveLoanStatus(loan, overdueDate);
  assert.strictEqual(effectiveStatus, "OVERDUE", "Loan past due date with remaining balance must be OVERDUE");
  assert.strictEqual(interestService.isLoanOverdue(loan, overdueDate), true);
});

// ----------------------------------------------------------------------------
// 7. PAID LOAN STATUS
// ----------------------------------------------------------------------------
runTest("7. PAID loan: totalOutstanding = 0", () => {
  // Case A: Loan explicitly marked PAID
  const loanA = {
    principal: 10000,
    principalPaid: 10000,
    interestPaid: 500,
    interestRate: 10,
    ratePeriod: "MONTHLY",
    interestType: "SIMPLE",
    interestStartDate: new Date("2024-01-01"),
    dueDate: new Date("2024-06-01"),
    paymentAllocation: "INTEREST_FIRST",
    status: "PAID",
  };

  const statusA = interestService.getEffectiveLoanStatus(loanA, new Date("2024-08-01"));
  assert.strictEqual(statusA, "PAID", "Loan with status PAID must remain PAID even past due date");
  assert.strictEqual(interestService.isLoanOverdue(loanA, new Date("2024-08-01")), false);

  // Case B: Loan whose remaining principal & interest reach 0
  const loanB = {
    principal: 10000,
    principalPaid: 10000,
    interestPaid: 1000,
    interestRate: 10,
    ratePeriod: "MONTHLY",
    interestType: "SIMPLE",
    interestStartDate: new Date("2024-01-01"),
    dueDate: new Date("2024-06-01"),
    paymentAllocation: "INTEREST_FIRST",
    status: "ACTIVE", // Stored as ACTIVE in DB before refresh
    interestAccrued: 1000,
    lastInterestDate: new Date("2024-03-01"),
  };

  const statusB = interestService.getEffectiveLoanStatus(loanB, new Date("2024-07-01"));
  assert.strictEqual(statusB, "PAID", "Loan with 0 outstanding balance must evaluate to PAID");
});

// ----------------------------------------------------------------------------
// 8. OVERDUE FILTERING REFRESH CONSISTENCY
// ----------------------------------------------------------------------------
runTest("8. Overdue filtering: loan becoming overdue today appears under OVERDUE immediately", () => {
  const asOfToday = new Date("2024-06-02");

  // In database, both loans currently have status: 'ACTIVE'
  const loansInDB = [
    {
      id: "loan-1",
      principal: 10000,
      principalPaid: 0,
      interestPaid: 0,
      interestRate: 10,
      ratePeriod: "MONTHLY",
      interestType: "SIMPLE",
      interestStartDate: new Date("2024-01-01"),
      dueDate: new Date("2024-06-01"), // Became overdue yesterday!
      status: "ACTIVE", // Stale in DB
    },
    {
      id: "loan-2",
      principal: 10000,
      principalPaid: 0,
      interestPaid: 0,
      interestRate: 10,
      ratePeriod: "MONTHLY",
      interestType: "SIMPLE",
      interestStartDate: new Date("2024-01-01"),
      dueDate: new Date("2024-12-31"), // Still active
      status: "ACTIVE",
    },
  ];

  // Old buggy approach: filter by status BEFORE refreshing:
  const queryStatus = "OVERDUE";
  const oldBuggyFiltered = loansInDB.filter((l) => l.status === queryStatus);
  assert.strictEqual(oldBuggyFiltered.length, 0, "Demonstrates old bug: DB filter before refresh missed loan-1");

  // New fixed approach: refresh loan statuses FIRST using centralized logic, THEN filter:
  const refreshedLoans = loansInDB.map((loan) => {
    const effective = interestService.getEffectiveLoanStatus(loan, asOfToday);
    return { ...loan, status: effective };
  });

  const overdueList = refreshedLoans.filter((l) => l.status === "OVERDUE");
  assert.strictEqual(overdueList.length, 1, "Refreshed filter must include loan-1 in OVERDUE list");
  assert.strictEqual(overdueList[0].id, "loan-1");

  const activeList = refreshedLoans.filter((l) => l.status === "ACTIVE");
  assert.strictEqual(activeList.length, 1, "Refreshed filter must only include loan-2 in ACTIVE list");
  assert.strictEqual(activeList[0].id, "loan-2");
});

// ----------------------------------------------------------------------------
// 9. EARLY FULL REPAYMENT
// ----------------------------------------------------------------------------
runTest("9. Early full repayment: immediately changes effective status to PAID", () => {
  const loan = {
    principal: 50000,
    principalPaid: 0,
    interestPaid: 0,
    interestRate: 12,
    ratePeriod: "YEARLY",
    interestType: "SIMPLE",
    interestStartDate: new Date("2024-01-01"),
    dueDate: new Date("2024-12-31"),
    paymentAllocation: "INTEREST_FIRST",
    status: "ACTIVE",
    repayments: [],
  };

  const earlyPayoffDate = new Date("2024-03-01");
  const summaryBefore = interestService.getLoanFinancialSummary(loan, earlyPayoffDate);
  const fullAmount = summaryBefore.totalOutstanding;

  // Repayment is made in full
  const allocation = interestService.allocateRepayment(loan, fullAmount, earlyPayoffDate);
  loan.interestPaid += allocation.interestComponent;
  loan.principalPaid += allocation.principalComponent;
  loan.interestAccrued = summaryBefore.accruedInterest;
  loan.lastInterestDate = earlyPayoffDate;
  loan.status = "PAID";
  loan.repayments.push({
    date: earlyPayoffDate,
    amount: fullAmount,
    principalPaid: allocation.principalComponent,
    interestPaid: allocation.interestComponent,
  });

  // Effective status immediately evaluates to PAID
  const effectiveAtPayoff = interestService.getEffectiveLoanStatus(loan, earlyPayoffDate);
  assert.strictEqual(effectiveAtPayoff, "PAID", "Status must immediately be PAID on payoff");

  // And remains PAID on the original due date without any accrued interest increase
  const summaryAtDue = interestService.getLoanFinancialSummary(loan, new Date("2024-12-31"));
  const effectiveAtDue = interestService.getEffectiveLoanStatus(loan, new Date("2024-12-31"));
  assert.strictEqual(effectiveAtDue, "PAID", "Status must remain PAID on due date");
  assert.strictEqual(summaryAtDue.remaining, 0, "Remaining balance must be 0");
});

// ----------------------------------------------------------------------------
// 10. EDITING LOAN AFTER REPAYMENT
// ----------------------------------------------------------------------------
runTest("10. Editing loan after repayment: protect financial terms from modification", () => {
  const loan = {
    principal: 20000,
    principalPaid: 5000,
    interestPaid: 1000,
    interestType: "SIMPLE",
    interestRate: 12,
    ratePeriod: "YEARLY",
    interestStartDate: new Date("2024-01-01"),
    dueDate: new Date("2024-12-31"),
    paymentAllocation: "INTEREST_FIRST",
    description: "Initial description",
  };

  const hasRepayments = true;

  // A: Attempting to change principal
  const resPrincipal = validateLoanEdit(loan, { principal: 25000 }, hasRepayments);
  assert.strictEqual(resPrincipal.allowed, false);
  assert.ok(resPrincipal.error.includes("principal"));

  // B: Attempting to change interest rate
  const resRate = validateLoanEdit(loan, { interestRate: 15 }, hasRepayments);
  assert.strictEqual(resRate.allowed, false);
  assert.ok(resRate.error.includes("interestRate"));

  // C: Attempting to change rate period
  const resPeriod = validateLoanEdit(loan, { ratePeriod: "MONTHLY" }, hasRepayments);
  assert.strictEqual(resPeriod.allowed, false);
  assert.ok(resPeriod.error.includes("ratePeriod"));

  // D: Attempting to change interest type
  const resType = validateLoanEdit(loan, { interestType: "COMPOUND" }, hasRepayments);
  assert.strictEqual(resType.allowed, false);
  assert.ok(resType.error.includes("interestType"));

  // E: Attempting to change interest start date
  const resStartDate = validateLoanEdit(loan, { interestStartDate: "2024-02-01" }, hasRepayments);
  assert.strictEqual(resStartDate.allowed, false);
  assert.ok(resStartDate.error.includes("interestStartDate"));

  // F: Attempting to change payment allocation
  const resAlloc = validateLoanEdit(loan, { paymentAllocation: "PRINCIPAL_FIRST" }, hasRepayments);
  assert.strictEqual(resAlloc.allowed, false);
  assert.ok(resAlloc.error.includes("paymentAllocation"));

  // G: Non-financial fields (description) and dueDate remain editable
  const resValidEdit = validateLoanEdit(
    loan,
    { description: "Updated notes", dueDate: "2025-06-30" },
    hasRepayments
  );
  assert.strictEqual(resValidEdit.allowed, true, "Description and due date must remain editable");
  assert.strictEqual(resValidEdit.error, null);
});

// ----------------------------------------------------------------------------
// 11. EDITING LOAN BEFORE REPAYMENT
// ----------------------------------------------------------------------------
runTest("11. Editing loan before repayment: financial terms can be updated with date validation", () => {
  const loan = {
    loanCreationDate: new Date("2024-01-01"),
    principal: 20000,
    principalPaid: 0,
    interestPaid: 0,
    interestType: "SIMPLE",
    interestRate: 12,
    ratePeriod: "YEARLY",
    interestStartDate: new Date("2024-01-01"),
    dueDate: new Date("2024-12-31"),
    paymentAllocation: "INTEREST_FIRST",
    description: "Initial description",
  };

  const hasRepayments = false;

  // A: Modifying financial terms before repayment succeeds
  const resValid = validateLoanEdit(
    loan,
    {
      principal: 25000,
      interestRate: 15,
      ratePeriod: "MONTHLY",
      interestType: "COMPOUND",
      interestStartDate: "2024-01-15",
      paymentAllocation: "PRINCIPAL_FIRST",
      dueDate: "2024-11-30",
    },
    hasRepayments
  );
  assert.strictEqual(resValid.allowed, true, "Financial terms can be modified before repayments");
  assert.strictEqual(resValid.error, null);

  // B: Modifying dates to invalid ordering before repayment is rejected
  const resInvalidDate = validateLoanEdit(
    loan,
    {
      interestStartDate: "2024-01-15",
      dueDate: "2024-01-10", // dueDate before interestStartDate
    },
    hasRepayments
  );
  assert.strictEqual(resInvalidDate.allowed, false, "Invalid date ordering on edit must be rejected");
  assert.strictEqual(resInvalidDate.error, "dueDate cannot be before interestStartDate");
});

console.log("\n=======================================================");
console.log(`TEST SUMMARY: ${passedTests} passed, ${failedTests} failed`);
console.log("=======================================================\n");

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
