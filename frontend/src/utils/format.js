// Indian Rupee formatting, e.g. 250000 -> "₹2,50,000" and 1200.5 -> "₹1,200.50"
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatCurrency = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return "₹0";
  return currencyFormatter.format(num);
};

// e.g. "2026-08-12" -> "12 Aug 2026"
export const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Converts an <input type="date"> friendly value (YYYY-MM-DD)
export const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export const daysOverdue = (dueDate) => {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = now.setHours(0, 0, 0, 0) - due.setHours(0, 0, 0, 0);
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
};

export const INTEREST_TYPE_LABELS = {
  SIMPLE: "Simple Interest",
  COMPOUND: "Compound Interest",
};

export const RATE_PERIOD_LABELS = {
  DAILY: "Daily",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export const PAYMENT_ALLOCATION_LABELS = {
  INTEREST_FIRST: "Interest First",
  PRINCIPAL_FIRST: "Principal First",
};

export const TRANSACTION_TYPE_LABELS = {
  LOAN_DISBURSED: "Money Given",
  REPAYMENT: "Payment Received",
  INTEREST_ACCRUED: "Interest",
};

export const LOAN_STATUS_LABELS = {
  ACTIVE: "Active",
  PAID: "Paid",
  OVERDUE: "Overdue",
};
