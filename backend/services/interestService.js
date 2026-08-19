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
 * ASSUMPTION (documented on purpose so it's easy to change later):
 * Interest is calculated on the loan's ORIGINAL principal amount,
 * for the elapsed time between the loan's interestStartDate and the
 * date we are calculating "as of". This mirrors how a simple lending
 * notebook (a "hisab-kitab") is normally kept - the interest keeps
 * accruing on the sanctioned amount until the loan is fully closed,
 * regardless of partial payments. Partial payments instead reduce
 * how much of that interest (and principal) is still *outstanding*,
 * via the paymentAllocation rule.
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
 * Calculates simple interest.
 * Formula: Interest = Principal * dailyRate * numberOfDays
 */
const calculateSimpleInterest = (principal, rate, ratePeriod, days) => {
  const dailyRate = getDailyRateDecimal(rate, ratePeriod);
  return principal * dailyRate * days;
};

/**
 * Calculates compound interest.
 * We compound once per "period" (daily/monthly/yearly), matching the
 * loan's configured ratePeriod, over the elapsed number of full periods.
 * Formula: Amount = Principal * (1 + rate/100) ^ numberOfPeriods
 *          Interest = Amount - Principal
 */
const calculateCompoundInterest = (principal, rate, ratePeriod, days) => {
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
  return amount - principal;
};

/**
 * Calculates the total accrued interest for a loan, as of a given date
 * (defaults to now). This is based purely on the loan's stored interest
 * configuration - never on a manually entered number.
 *
 * @param {object} loan - a Loan mongoose document (or plain object) with
 *   principal, interestType, interestRate, ratePeriod, interestStartDate
 * @param {Date} [asOfDate] - defaults to the current date/time
 * @returns {number} accrued interest, rounded to 2 decimal places
 */
const calculateAccruedInterest = (loan, asOfDate = new Date()) => {
  if (loan.status === "PAID") {
    return loan.interestPaid || 0;
  }
  const days = getElapsedDays(loan.interestStartDate, asOfDate);
  if (days <= 0) return 0;

  let interest;
  if (loan.interestType === "SIMPLE") {
    interest = calculateSimpleInterest(
      loan.principal,
      loan.interestRate,
      loan.ratePeriod,
      days
    );
  } else if (loan.interestType === "COMPOUND") {
    interest = calculateCompoundInterest(
      loan.principal,
      loan.interestRate,
      loan.ratePeriod,
      days
    );
  } else {
    throw new Error(`Unknown interest type: ${loan.interestType}`);
  }

  return round2(interest);
};

/**
 * Builds a full financial summary for a loan: principal, accrued
 * interest, total due, total paid, and remaining balance.
 *
 * @param {object} loan - a Loan mongoose document
 * @param {Date} [asOfDate]
 */
const getLoanFinancialSummary = (loan, asOfDate = new Date()) => {
  const accruedInterest = calculateAccruedInterest(loan, asOfDate);
  const totalDue = round2(loan.principal + accruedInterest);
  const totalPaid = round2((loan.principalPaid || 0) + (loan.interestPaid || 0));
  const remaining = round2(totalDue - totalPaid);

  const outstandingInterest = round2(accruedInterest - (loan.interestPaid || 0));
  const outstandingPrincipal = round2(loan.principal - (loan.principalPaid || 0));

  return {
    principal: round2(loan.principal),
    accruedInterest,
    totalDue,
    totalPaid,
    remaining: remaining < 0 ? 0 : remaining,
    outstandingInterest: outstandingInterest < 0 ? 0 : outstandingInterest,
    outstandingPrincipal: outstandingPrincipal < 0 ? 0 : outstandingPrincipal,
  };
};

/**
 * Given a repayment amount, figures out how much of it should be
 * applied to outstanding interest vs outstanding principal, based on
 * the loan's paymentAllocation rule (INTEREST_FIRST or PRINCIPAL_FIRST).
 *
 * @param {object} loan - a Loan mongoose document
 * @param {number} paymentAmount - amount the borrower is paying now
 * @param {Date} [asOfDate] - date the payment is made
 * @returns {{ interestComponent: number, principalComponent: number }}
 */
const allocateRepayment = (loan, paymentAmount, asOfDate = new Date()) => {
  const summary = getLoanFinancialSummary(loan, asOfDate);
  let remainingPayment = paymentAmount;
  let interestComponent = 0;
  let principalComponent = 0;

  if (loan.paymentAllocation === "INTEREST_FIRST") {
    interestComponent = Math.min(remainingPayment, summary.outstandingInterest);
    remainingPayment = round2(remainingPayment - interestComponent);
    principalComponent = Math.min(remainingPayment, summary.outstandingPrincipal);
  } else {
    // PRINCIPAL_FIRST
    principalComponent = Math.min(remainingPayment, summary.outstandingPrincipal);
    remainingPayment = round2(remainingPayment - principalComponent);
    interestComponent = Math.min(remainingPayment, summary.outstandingInterest);
  }

  return {
    interestComponent: round2(interestComponent),
    principalComponent: round2(principalComponent),
  };
};

/**
 * Determines whether a loan should be considered overdue as of a
 * given date: its due date has passed and it still has money owed.
 */
const isLoanOverdue = (loan, asOfDate = new Date()) => {
  if (loan.status === "PAID") return false;
  const summary = getLoanFinancialSummary(loan, asOfDate);
  return new Date(asOfDate) > new Date(loan.dueDate) && summary.remaining > 0;
};

module.exports = {
  calculateAccruedInterest,
  getLoanFinancialSummary,
  allocateRepayment,
  isLoanOverdue,
  getElapsedDays,
};
