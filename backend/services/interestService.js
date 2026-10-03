const { round2 } = require("../utils/helpers");

/**
 * =============================================================
 * INTEREST CALCULATION SERVICE
 * =============================================================
 *
 * This is the ONLY place in the app where interest math happens.
 * Controllers should never calculate interest themselves - they
 * should call the functions here.
 *
 * FINANCIAL MODEL RULES:
 * 1. Original principal is fixed at loan creation and never changes.
 * 2. Outstanding principal decreases ONLY when a repayment is allocated
 *    to principal.
 * 3. Future interest accrues ONLY on the remaining outstanding principal.
 *    Paid principal never generates future interest.
 * 4. Under INTEREST_FIRST allocation, repayments pay outstanding interest
 *    first, and any remainder pays down principal. If all payment goes
 *    to interest, outstanding principal remains unchanged.
 * 5. Under PRINCIPAL_FIRST allocation, repayments pay down outstanding
 *    principal first, and any remainder pays interest.
 * 6. Overdue loans continue accruing interest past their due date until
 *    fully paid. Due date determines overdue status, not accrual cutoff.
 * 7. Early repayment fully clears the loan (PAID) and stops any further
 *    interest accrual.
 * 8. Payments >= total outstanding fully settle the loan (remaining = 0,
 *    status = PAID) and safely return any excess amount without negative
 *    balances.
 * 9. Compound interest uses fractional compounding periods (days / daysPerPeriod)
 *    so interest accrues smoothly day by day.
 * 10. All monetary figures are consistently rounded to 2 decimal places.
 * =============================================================
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Converts an interest rate + period into a daily rate (as a decimal,
 * e.g. 12% per year -> 0.12/365 per day).
 * @param {number} rate - the numeric rate, e.g. 12 for "12%"
 * @param {"DAILY"|"MONTHLY"|"YEARLY"} period
 */
const getDailyRateDecimal = (rate, period) => {
  const rateDecimal = rate / 100;
  switch (period) {
    case "DAILY":
      return rateDecimal;
    case "MONTHLY":
      // Approximate a month as 30 days
      return rateDecimal / 30;
    case "YEARLY":
      return rateDecimal / 365;
    default:
      throw new Error(`Unknown rate period: ${period}`);
  }
};

/**
 * Returns how many whole days have elapsed between two dates.
 * Never returns a negative number.
 */
const getElapsedDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / MS_PER_DAY);
};

/**
 * Calculates simple interest for a given principal and elapsed days.
 * Formula: Interest = Principal * dailyRate * numberOfDays
 */
const calculateSimpleInterest = (principal, rate, ratePeriod, days) => {
  if (principal <= 0 || days <= 0 || rate <= 0) return 0;
  const dailyRate = getDailyRateDecimal(rate, ratePeriod);
  return round2(principal * dailyRate * days);
};

/**
 * Calculates compound interest using fractional compounding periods.
 *
 * Formula:
 *   numberOfPeriods = days / daysPerPeriod
 *   Amount = Principal * (1 + rateDecimal) ^ numberOfPeriods
 *   Interest = Amount - Principal
 *
 * Note: Fractional compounding allows smooth, fair daily interest accrual between
 * discrete periods (e.g. 45 days at a monthly rate yields 1.5 compounding periods).
 */
const calculateCompoundInterest = (principal, rate, ratePeriod, days) => {
  if (principal <= 0 || days <= 0 || rate <= 0) return 0;
  const rateDecimal = rate / 100;
  let daysPerPeriod;
  switch (ratePeriod) {
    case "DAILY":
      daysPerPeriod = 1;
      break;
    case "MONTHLY":
      daysPerPeriod = 30;
      break;
    case "YEARLY":
      daysPerPeriod = 365;
      break;
    default:
      throw new Error(`Unknown rate period: ${ratePeriod}`);
  }

  const numberOfPeriods = days / daysPerPeriod;
  const amount = principal * Math.pow(1 + rateDecimal, numberOfPeriods);
  return round2(amount - principal);
};

/**
 * Helper to calculate interest for an interval based on interestType.
 */
const calculatePeriodInterest = (principal, interestType, rate, ratePeriod, days) => {
  if (principal <= 0 || days <= 0) return 0;
  if (interestType === "SIMPLE") {
    return calculateSimpleInterest(principal, rate, ratePeriod, days);
  }
  if (interestType === "COMPOUND") {
    return calculateCompoundInterest(principal, rate, ratePeriod, days);
  }
  throw new Error(`Unknown interest type: ${interestType}`);
};

/**
 * Calculates the total accrued interest for a loan as of a given date (defaults to now).
 * Correctly accounts for reduced outstanding principal over time so paid-off principal
 * does not continue accruing interest.
 *
 * @param {object} loan - Loan mongoose document or plain object
 * @param {Date} [asOfDate] - defaults to now
 * @returns {number} accrued interest, rounded to 2 decimal places
 */
const calculateAccruedInterest = (loan, asOfDate = new Date()) => {
  // If loan is already fully settled/closed, freeze accrued interest at interestPaid
  if (loan.status === "PAID") {
    return round2(loan.interestPaid || 0);
  }

  const targetDate = new Date(asOfDate);
  const startDate = new Date(loan.interestStartDate);

  // Case 1: Loan has recorded repayments schedule
  if (Array.isArray(loan.repayments) && loan.repayments.length > 0) {
    if (targetDate < startDate) return 0;

    const sorted = [...loan.repayments]
      .filter((r) => r.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let totalInterest = 0;
    let currentPrincipal = round2(loan.principal);
    let currentDate = startDate;

    for (const rep of sorted) {
      const repDate = new Date(rep.date);
      if (repDate > currentDate && currentDate < targetDate) {
        const periodEnd = repDate < targetDate ? repDate : targetDate;
        const days = getElapsedDays(currentDate, periodEnd);
        if (days > 0 && currentPrincipal > 0) {
          totalInterest = round2(
            totalInterest +
              calculatePeriodInterest(
                currentPrincipal,
                loan.interestType,
                loan.interestRate,
                loan.ratePeriod,
                days
              )
          );
        }
        currentDate = periodEnd;
      }
      if (repDate <= targetDate) {
        currentPrincipal = Math.max(0, round2(currentPrincipal - (rep.principalPaid || 0)));
      }
    }

    if (targetDate > currentDate && currentPrincipal > 0) {
      const days = getElapsedDays(currentDate, targetDate);
      if (days > 0) {
        totalInterest = round2(
          totalInterest +
            calculatePeriodInterest(
              currentPrincipal,
              loan.interestType,
              loan.interestRate,
              loan.ratePeriod,
              days
            )
        );
      }
    }

    return round2(totalInterest);
  }

  // Case 2: Loan has checkpoint fields (interestAccrued and lastInterestDate)
  if (loan.lastInterestDate && loan.interestAccrued !== undefined && loan.interestAccrued !== null) {
    const lastDate = new Date(loan.lastInterestDate);
    const baseAccrued = round2(loan.interestAccrued || 0);
    const currentPrincipal = Math.max(0, round2(loan.principal - (loan.principalPaid || 0)));

    if (currentPrincipal <= 0 || targetDate <= lastDate) {
      return baseAccrued;
    }

    const days = getElapsedDays(lastDate, targetDate);
    if (days <= 0) return baseAccrued;

    const interestSinceLast = calculatePeriodInterest(
      currentPrincipal,
      loan.interestType,
      loan.interestRate,
      loan.ratePeriod,
      days
    );
    return round2(baseAccrued + interestSinceLast);
  }

  // Case 3: Explicit interestAccrued without lastInterestDate
  if (loan.interestAccrued !== undefined && loan.interestAccrued !== null) {
    return round2(loan.interestAccrued);
  }

  // Case 4: Standard single interval (e.g. loan with no prior principal repayments or checkpoints)
  if (targetDate <= startDate) return 0;

  const currentPrincipal = Math.max(0, round2(loan.principal - (loan.principalPaid || 0)));
  const days = getElapsedDays(startDate, targetDate);
  if (days <= 0 || currentPrincipal <= 0) return 0;

  const basePrincipal = loan.principalPaid > 0 ? currentPrincipal : loan.principal;
  const interest = calculatePeriodInterest(
    basePrincipal,
    loan.interestType,
    loan.interestRate,
    loan.ratePeriod,
    days
  );
  return round2(interest);
};

/**
 * Builds a full financial summary for a loan:
 * - original principal
 * - accrued interest
 * - total due
 * - total paid
 * - outstanding principal
 * - outstanding interest
 * - total outstanding / remaining
 *
 * @param {object} loan - a Loan mongoose document or plain object
 * @param {Date} [asOfDate]
 */
const getLoanFinancialSummary = (loan, asOfDate = new Date()) => {
  // If loan is already PAID in full:
  if (loan.status === "PAID") {
    const accruedInterest = round2(loan.interestPaid || 0);
    const principalPaid = round2(
      loan.principalPaid !== undefined && loan.principalPaid !== null
        ? loan.principalPaid
        : loan.principal
    );
    const interestPaid = round2(loan.interestPaid || 0);
    const totalPaid = round2(principalPaid + interestPaid);

    return {
      principal: round2(loan.principal),
      accruedInterest,
      totalDue: totalPaid,
      totalPaid,
      remaining: 0,
      totalOutstanding: 0,
      outstandingInterest: 0,
      outstandingPrincipal: 0,
    };
  }

  const accruedInterest = calculateAccruedInterest(loan, asOfDate);
  const outstandingPrincipal = Math.max(0, round2(loan.principal - (loan.principalPaid || 0)));
  const outstandingInterest = Math.max(0, round2(accruedInterest - (loan.interestPaid || 0)));
  const totalOutstanding = round2(outstandingPrincipal + outstandingInterest);

  const totalDue = round2(loan.principal + accruedInterest);
  const totalPaid = round2((loan.principalPaid || 0) + (loan.interestPaid || 0));

  return {
    principal: round2(loan.principal),
    accruedInterest,
    totalDue,
    totalPaid,
    remaining: totalOutstanding,
    totalOutstanding,
    outstandingInterest,
    outstandingPrincipal,
  };
};

/**
 * Given a repayment amount, determines the allocation between outstanding interest
 * and outstanding principal based on paymentAllocation rule.
 * Handles full payments and excess amounts safely without negative numbers.
 *
 * @param {object} loan - a Loan mongoose document or plain object
 * @param {number} paymentAmount - amount the borrower is paying
 * @param {Date} [asOfDate] - date the payment is made
 * @returns {{ interestComponent: number, principalComponent: number, excessAmount: number }}
 */
const allocateRepayment = (loan, paymentAmount, asOfDate = new Date()) => {
  const summary = getLoanFinancialSummary(loan, asOfDate);
  const amount = Number(paymentAmount);

  if (Number.isNaN(amount) || amount <= 0) {
    return {
      interestComponent: 0,
      principalComponent: 0,
      excessAmount: 0,
    };
  }

  let remainingPayment = round2(amount);
  let interestComponent = 0;
  let principalComponent = 0;

  if (loan.paymentAllocation === "INTEREST_FIRST") {
    interestComponent = Math.min(remainingPayment, summary.outstandingInterest);
    remainingPayment = round2(remainingPayment - interestComponent);
    principalComponent = Math.min(remainingPayment, summary.outstandingPrincipal);
    remainingPayment = round2(remainingPayment - principalComponent);
  } else {
    // PRINCIPAL_FIRST
    principalComponent = Math.min(remainingPayment, summary.outstandingPrincipal);
    remainingPayment = round2(remainingPayment - principalComponent);
    interestComponent = Math.min(remainingPayment, summary.outstandingInterest);
    remainingPayment = round2(remainingPayment - interestComponent);
  }

  const excessAmount = Math.max(0, remainingPayment);

  return {
    interestComponent: round2(interestComponent),
    principalComponent: round2(principalComponent),
    excessAmount: round2(excessAmount),
  };
};

/**
 * Determines whether a loan should be considered overdue as of a given date:
 * its due date has passed and it still has money owed.
 */
const isLoanOverdue = (loan, asOfDate = new Date()) => {
  if (loan.status === "PAID") return false;
  const summary = getLoanFinancialSummary(loan, asOfDate);
  return new Date(asOfDate) > new Date(loan.dueDate) && summary.totalOutstanding > 0;
};

module.exports = {
  calculateSimpleInterest,
  calculateCompoundInterest,
  calculateAccruedInterest,
  getLoanFinancialSummary,
  allocateRepayment,
  isLoanOverdue,
  getElapsedDays,
  getDailyRateDecimal,
};
