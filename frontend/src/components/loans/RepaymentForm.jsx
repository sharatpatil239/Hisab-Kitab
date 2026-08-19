import { useState } from "react";
import { formatCurrency } from "../../utils/format";

const TODAY = new Date().toISOString().slice(0, 10);

const RepaymentForm = ({ remaining, onSubmit, onCancel }) => {
  const [form, setForm] = useState({ amount: "", date: TODAY, description: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const amountNum = Number(form.amount);
  const validAmount = form.amount !== "" && !Number.isNaN(amountNum) && amountNum > 0;
  const afterPayment = validAmount ? Math.max(remaining - amountNum, 0) : remaining;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validAmount) {
      setError("Enter a valid repayment amount.");
      return;
    }
    if (amountNum > remaining) {
      setError(`Repayment amount cannot exceed the remaining balance of ${formatCurrency(remaining)}.`);
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await onSubmit({
        amount: amountNum,
        date: form.date || undefined,
        description: form.description.trim() || undefined,
      });
    } catch (err) {
      setError(err.message || "Could not record repayment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {error && <div className="form-error">{error}</div>}

      <div className="repayment-preview">
        <div className="repayment-preview-row">
          <span>Current Outstanding</span>
          <strong>{formatCurrency(remaining)}</strong>
        </div>
        <div className="repayment-preview-row">
          <span>Repayment</span>
          <strong>{validAmount ? formatCurrency(amountNum) : "—"}</strong>
        </div>
        <div className="repayment-preview-row">
          <span>After Payment</span>
          <strong>{formatCurrency(afterPayment)}</strong>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="amount">Amount (₹)</label>
        <input
          id="amount"
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          value={form.amount}
          onChange={handleChange}
          placeholder="e.g. 5000"
        />
      </div>

      <div className="form-group">
        <label htmlFor="date">Date</label>
        <input id="date" name="date" type="date" value={form.date} onChange={handleChange} />
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <input
          id="description"
          name="description"
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
          {submitting ? "Recording..." : "Record Repayment"}
        </button>
      </div>
    </form>
  );
};

export default RepaymentForm;
