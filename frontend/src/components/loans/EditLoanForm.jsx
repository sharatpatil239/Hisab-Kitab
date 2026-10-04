import { useState } from "react";
import { toDateInputValue } from "../../utils/format";

const EditLoanForm = ({ loan, transactions = [], onSubmit, onCancel, submitLabel = "Save Changes" }) => {
  const hasRepayments =
    (loan.principalPaid && loan.principalPaid > 0) ||
    (loan.interestPaid && loan.interestPaid > 0) ||
    (Array.isArray(transactions) && transactions.some((t) => t.type === "REPAYMENT")) ||
    (Array.isArray(loan.repayments) && loan.repayments.length > 0);

  const [form, setForm] = useState({
    principal: loan.principal !== undefined ? String(loan.principal) : "",
    interestType: loan.interestType || "SIMPLE",
    interestRate: loan.interestRate !== undefined ? String(loan.interestRate) : "",
    ratePeriod: loan.ratePeriod || "YEARLY",
    interestStartDate: toDateInputValue(loan.interestStartDate),
    dueDate: toDateInputValue(loan.dueDate),
    paymentAllocation: loan.paymentAllocation || "INTEREST_FIRST",
    description: loan.description || "",
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const setInterestType = (value) => {
    if (hasRepayments) return;
    setForm((prev) => ({ ...prev, interestType: value }));
  };

  const setPaymentAllocation = (value) => {
    if (hasRepayments) return;
    setForm((prev) => ({ ...prev, paymentAllocation: value }));
  };

  const validate = () => {
    if (!form.dueDate) return "Due date is required.";

    if (!hasRepayments) {
      const principalNum = Number(form.principal);
      const rateNum = Number(form.interestRate);

      if (!form.principal || Number.isNaN(principalNum) || principalNum <= 0) {
        return "Principal amount must be a positive number.";
      }
      if (form.interestRate === "" || Number.isNaN(rateNum) || rateNum < 0) {
        return "Interest rate must be a non-negative number.";
      }
      if (!form.interestStartDate) return "Interest start date is required.";

      const creation = loan.loanCreationDate
        ? new Date(toDateInputValue(loan.loanCreationDate))
        : new Date(form.interestStartDate);
      const start = new Date(form.interestStartDate);
      const due = new Date(form.dueDate);

      if (start < creation) {
        return "Interest start date cannot be before loan disbursement date.";
      }
      if (due < start) {
        return "Due date cannot be before interest start date.";
      }
    } else {
      const start = new Date(toDateInputValue(loan.interestStartDate));
      const due = new Date(form.dueDate);
      if (due < start) {
        return "Due date cannot be before the interest start date.";
      }
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const payload = {
        dueDate: form.dueDate,
        description: form.description.trim() || undefined,
      };

      if (!hasRepayments) {
        payload.principal = Number(form.principal);
        payload.interestType = form.interestType;
        payload.interestRate = Number(form.interestRate);
        payload.ratePeriod = form.ratePeriod;
        payload.interestStartDate = form.interestStartDate;
        payload.paymentAllocation = form.paymentAllocation;
      }

      await onSubmit(payload);
    } catch (err) {
      setError(err.message || "Could not update loan. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {error && <div className="form-error">{error}</div>}

      {hasRepayments ? (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--radius)",
            background: "var(--color-warning-bg)",
            color: "var(--color-warning)",
            fontSize: "13px",
            fontWeight: "500",
            marginBottom: "12px",
            lineHeight: "1.4",
          }}
        >
          🔒 <strong>Financial terms are protected</strong> because repayments have already been recorded on this loan.
          Original principal, interest rate, rate period, interest type, interest start date, and repayment allocation cannot be altered.
          You may still update the due date and description.
        </div>
      ) : (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius)",
            background: "var(--color-info-bg)",
            color: "var(--color-primary)",
            fontSize: "13px",
            marginBottom: "12px",
          }}
        >
          No repayments recorded yet. All loan financial terms and settings may be modified.
        </div>
      )}

      <div className="form-section">
        <div className="form-section-title">Loan Details</div>
        <div className="form-group">
          <label htmlFor="edit-principal">
            Principal Amount (₹) {hasRepayments && <span style={{ opacity: 0.6 }}>(Locked)</span>}
          </label>
          <input
            id="edit-principal"
            name="principal"
            type="number"
            min="0.01"
            step="0.01"
            value={form.principal}
            onChange={handleChange}
            disabled={hasRepayments}
            style={hasRepayments ? { background: "var(--color-bg)", cursor: "not-allowed", opacity: 0.7 } : {}}
          />
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Interest Settings</div>

        <div className="radio-group" style={hasRepayments ? { opacity: 0.7, pointerEvents: "none" } : {}}>
          <label className={`radio-option ${form.interestType === "SIMPLE" ? "radio-option-selected" : ""}`}>
            <span className="radio-option-label">
              <input
                type="radio"
                name="interestType"
                checked={form.interestType === "SIMPLE"}
                onChange={() => setInterestType("SIMPLE")}
                disabled={hasRepayments}
              />
              Simple Interest
            </span>
          </label>

          <label className={`radio-option ${form.interestType === "COMPOUND" ? "radio-option-selected" : ""}`}>
            <span className="radio-option-label">
              <input
                type="radio"
                name="interestType"
                checked={form.interestType === "COMPOUND"}
                onChange={() => setInterestType("COMPOUND")}
                disabled={hasRepayments}
              />
              Compound Interest
            </span>
          </label>
        </div>

        <div className="form-row" style={{ marginTop: 16 }}>
          <div className="form-group">
            <label htmlFor="edit-interestRate">
              Interest Rate (%) {hasRepayments && <span style={{ opacity: 0.6 }}>(Locked)</span>}
            </label>
            <input
              id="edit-interestRate"
              name="interestRate"
              type="number"
              min="0"
              step="0.01"
              value={form.interestRate}
              onChange={handleChange}
              disabled={hasRepayments}
              style={hasRepayments ? { background: "var(--color-bg)", cursor: "not-allowed", opacity: 0.7 } : {}}
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-ratePeriod">
              Rate Period {hasRepayments && <span style={{ opacity: 0.6 }}>(Locked)</span>}
            </label>
            <select
              id="edit-ratePeriod"
              name="ratePeriod"
              value={form.ratePeriod}
              onChange={handleChange}
              disabled={hasRepayments}
              style={hasRepayments ? { background: "var(--color-bg)", cursor: "not-allowed", opacity: 0.7 } : {}}
            >
              <option value="DAILY">Daily</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="edit-interestStartDate">
              Interest Start Date {hasRepayments && <span style={{ opacity: 0.6 }}>(Locked)</span>}
            </label>
            <input
              id="edit-interestStartDate"
              name="interestStartDate"
              type="date"
              value={form.interestStartDate}
              onChange={handleChange}
              disabled={hasRepayments}
              style={hasRepayments ? { background: "var(--color-bg)", cursor: "not-allowed", opacity: 0.7 } : {}}
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-dueDate">Due Date</label>
            <input
              id="edit-dueDate"
              name="dueDate"
              type="date"
              value={form.dueDate}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="edit-paymentAllocation">
            Payment Allocation {hasRepayments && <span style={{ opacity: 0.6 }}>(Locked)</span>}
          </label>
          <select
            id="edit-paymentAllocation"
            name="paymentAllocation"
            value={form.paymentAllocation}
            onChange={(e) => setPaymentAllocation(e.target.value)}
            disabled={hasRepayments}
            style={hasRepayments ? { background: "var(--color-bg)", cursor: "not-allowed", opacity: 0.7 } : {}}
          >
            <option value="INTEREST_FIRST">Interest First</option>
            <option value="PRINCIPAL_FIRST">Principal First</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="edit-description">Description / Notes</label>
        <textarea
          id="edit-description"
          name="description"
          rows={2}
          value={form.description}
          onChange={handleChange}
          placeholder="Optional"
        />
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default EditLoanForm;
