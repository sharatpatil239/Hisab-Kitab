import { useState } from "react";

const TODAY = new Date().toISOString().slice(0, 10);

const CreateLoanForm = ({ onSubmit, onCancel, submitLabel = "Create Loan" }) => {
  const [form, setForm] = useState({
    principal: "",
    interestType: "SIMPLE",
    interestRate: "",
    ratePeriod: "YEARLY",
    interestStartDate: TODAY,
    dueDate: "",
    paymentAllocation: "INTEREST_FIRST",
    description: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const setInterestType = (value) => setForm((prev) => ({ ...prev, interestType: value }));
  const setPaymentAllocation = (value) => setForm((prev) => ({ ...prev, paymentAllocation: value }));

  const validate = () => {
    const principalNum = Number(form.principal);
    const rateNum = Number(form.interestRate);

    if (!form.principal || Number.isNaN(principalNum) || principalNum <= 0) {
      return "Principal amount must be a positive number.";
    }
    if (form.interestRate === "" || Number.isNaN(rateNum) || rateNum < 0) {
      return "Interest rate must be a non-negative number.";
    }
    if (!form.interestStartDate) return "Interest start date is required.";
    if (!form.dueDate) return "Due date is required.";
    if (new Date(form.dueDate) < new Date(form.interestStartDate)) {
      return "Due date cannot be before the interest start date.";
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
      await onSubmit({
        principal: Number(form.principal),
        interestType: form.interestType,
        interestRate: Number(form.interestRate),
        ratePeriod: form.ratePeriod,
        interestStartDate: form.interestStartDate,
        dueDate: form.dueDate,
        paymentAllocation: form.paymentAllocation,
        description: form.description.trim() || undefined,
      });
    } catch (err) {
      setError(err.message || "Could not create loan. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {error && <div className="form-error">{error}</div>}

      <div className="form-section">
        <div className="form-section-title">Loan Details</div>
        <div className="form-group">
          <label htmlFor="principal">Principal Amount (₹)</label>
          <input
            id="principal"
            name="principal"
            type="number"
            min="0.01"
            step="0.01"
            value={form.principal}
            onChange={handleChange}
            placeholder="e.g. 20000"
          />
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Interest Settings</div>

        <div className="radio-group">
          <label className={`radio-option ${form.interestType === "SIMPLE" ? "radio-option-selected" : ""}`}>
            <span className="radio-option-label">
              <input
                type="radio"
                name="interestType"
                checked={form.interestType === "SIMPLE"}
                onChange={() => setInterestType("SIMPLE")}
              />
              Simple Interest
            </span>
            <span className="radio-option-desc">
              Interest is calculated based on the principal according to the configured period.
            </span>
          </label>

          <label className={`radio-option ${form.interestType === "COMPOUND" ? "radio-option-selected" : ""}`}>
            <span className="radio-option-label">
              <input
                type="radio"
                name="interestType"
                checked={form.interestType === "COMPOUND"}
                onChange={() => setInterestType("COMPOUND")}
              />
              Compound Interest
            </span>
            <span className="radio-option-desc">
              Interest accumulates according to the configured compounding rules.
            </span>
          </label>
        </div>

        <div className="form-row" style={{ marginTop: 16 }}>
          <div className="form-group">
            <label htmlFor="interestRate">Interest Rate (%)</label>
            <input
              id="interestRate"
              name="interestRate"
              type="number"
              min="0"
              step="0.01"
              value={form.interestRate}
              onChange={handleChange}
              placeholder="e.g. 12"
            />
          </div>
          <div className="form-group">
            <label htmlFor="ratePeriod">Rate Period</label>
            <select id="ratePeriod" name="ratePeriod" value={form.ratePeriod} onChange={handleChange}>
              <option value="DAILY">Daily</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="interestStartDate">Interest Start Date</label>
            <input
              id="interestStartDate"
              name="interestStartDate"
              type="date"
              value={form.interestStartDate}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="dueDate">Due Date</label>
            <input id="dueDate" name="dueDate" type="date" value={form.dueDate} onChange={handleChange} />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="paymentAllocation">Payment Allocation</label>
          <select
            id="paymentAllocation"
            name="paymentAllocation"
            value={form.paymentAllocation}
            onChange={(e) => setPaymentAllocation(e.target.value)}
          >
            <option value="INTEREST_FIRST">Interest First</option>
            <option value="PRINCIPAL_FIRST">Principal First</option>
          </select>
          <span className="form-hint">
            Determines how repayments are split between outstanding interest and principal.
          </span>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="description">Description / Notes</label>
        <textarea
          id="description"
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
          {submitting ? "Creating..." : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default CreateLoanForm;
