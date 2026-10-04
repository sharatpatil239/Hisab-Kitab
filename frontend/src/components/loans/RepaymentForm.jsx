import { useEffect, useState } from "react";
import { getRepaymentPreview } from "../../api/loanApi";
import Badge from "../common/Badge";
import { formatCurrency, PAYMENT_ALLOCATION_LABELS, toDateInputValue } from "../../utils/format";

const TODAY = new Date().toISOString().slice(0, 10);

const RepaymentForm = ({ loan, remaining, onSubmit, onCancel }) => {
  const totalOutstanding = loan?.totalOutstanding ?? loan?.remaining ?? remaining ?? 0;
  const loanId = loan?.id || loan?._id;
  const allocationRule = loan?.paymentAllocation || "INTEREST_FIRST";
  const allocationLabel = PAYMENT_ALLOCATION_LABELS[allocationRule] || allocationRule;

  const [form, setForm] = useState({ amount: "", date: TODAY, description: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [successResult, setSuccessResult] = useState(null);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const amountNum = Number(form.amount);
  const validAmount = form.amount !== "" && !Number.isNaN(amountNum) && amountNum > 0;

  // Fetch live preview from backend whenever amount or date changes
  useEffect(() => {
    if (!loanId || !validAmount) {
      setPreview(null);
      setPreviewError("");
      setPreviewLoading(false);
      return;
    }

    setPreviewError("");
    setPreviewLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await getRepaymentPreview(loanId, {
          amount: amountNum,
          date: form.date || undefined,
        });
        setPreview(res);
        setPreviewError("");
      } catch (err) {
        setPreview(null);
        setPreviewError(err.message || "Unable to calculate repayment preview.");
      } finally {
        setPreviewLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [loanId, form.amount, form.date, amountNum, validAmount, totalOutstanding]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validAmount) {
      setError("Enter a valid repayment amount.");
      return;
    }

    if (!form.date) {
      setError("Repayment date is required.");
      return;
    }
    if (form.date > TODAY) {
      setError("Repayment date cannot be in the future.");
      return;
    }
    if (loan?.loanCreationDate && form.date < toDateInputValue(loan.loanCreationDate)) {
      setError("Repayment date cannot be before the loan creation date.");
      return;
    }
    if (loan?.interestStartDate && form.date < toDateInputValue(loan.interestStartDate)) {
      setError("Repayment date cannot be before the interest start date.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const res = await onSubmit({
        amount: amountNum,
        date: form.date || undefined,
        description: form.description.trim() || undefined,
      });
      if (res?.allocation) {
        setSuccessResult(res);
      } else {
        onCancel();
      }
    } catch (err) {
      setError(err.message || "Could not record repayment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // If repayment was successfully recorded, show actual allocation breakdown
  if (successResult) {
    const { allocation } = successResult;
    return (
      <div className="form" style={{ gap: 16 }}>
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius)",
            background: "var(--color-success-bg)",
            color: "var(--color-accent)",
            fontWeight: 600,
          }}
        >
          ✓ Repayment recorded successfully!
        </div>

        <div className="repayment-preview">
          <div className="repayment-preview-row">
            <span>Amount paid:</span>
            <strong>{formatCurrency(allocation?.amountPaid ?? amountNum)}</strong>
          </div>
          <div className="repayment-preview-row">
            <span>Amount applied to interest:</span>
            <strong>{formatCurrency(allocation?.appliedToInterest ?? 0)}</strong>
          </div>
          <div className="repayment-preview-row">
            <span>Amount applied to principal:</span>
            <strong>{formatCurrency(allocation?.appliedToPrincipal ?? 0)}</strong>
          </div>
          <div style={{ margin: "6px 0", borderTop: "1px dashed var(--color-border)" }} />
          <div className="repayment-preview-row">
            <span>Remaining interest:</span>
            <strong>{formatCurrency(allocation?.remainingInterest ?? 0)}</strong>
          </div>
          <div className="repayment-preview-row">
            <span>Remaining principal:</span>
            <strong>{formatCurrency(allocation?.remainingPrincipal ?? 0)}</strong>
          </div>
          <div className="repayment-preview-row" style={{ fontWeight: 700 }}>
            <span>Remaining total outstanding:</span>
            <strong style={{ color: "var(--color-warning)" }}>
              {formatCurrency(allocation?.remainingTotalOutstanding ?? 0)}
            </strong>
          </div>
          {allocation?.excessAmount > 0 && (
            <div className="repayment-preview-row" style={{ color: "var(--color-accent)", marginTop: 4 }}>
              <span>Excess Amount:</span>
              <strong>{formatCurrency(allocation.excessAmount)}</strong>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onCancel}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {error && <div className="form-error">{error}</div>}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 12px",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
        }}
      >
        <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          Loan Repayment Allocation Rule:
        </span>
        <Badge tone="neutral">{allocationLabel}</Badge>
      </div>

      <div className="form-group">
        <label htmlFor="amount">Repayment Amount (₹)</label>
        <input
          id="amount"
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          value={form.amount}
          onChange={handleChange}
          placeholder="e.g. 20000"
          autoFocus
        />
      </div>

      <div className="form-group">
        <label htmlFor="date">Date</label>
        <input id="date" name="date" type="date" value={form.date} onChange={handleChange} max={TODAY} />
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

      {previewError && <div className="form-error">{previewError}</div>}

      {/* Backend calculated preview */}
      {preview ? (
        <div className="repayment-preview">
          <div className="repayment-preview-row">
            <span>Repayment Amount:</span>
            <strong>{formatCurrency(preview.repaymentAmount)}</strong>
          </div>

          <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--color-border)" }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-muted)", marginBottom: 4 }}>
              Payment Allocation:
            </div>
            <div className="repayment-preview-row" style={{ paddingLeft: 12 }}>
              <span>Interest:</span>
              <strong>{formatCurrency(preview.allocation?.appliedToInterest ?? 0)}</strong>
            </div>
            <div className="repayment-preview-row" style={{ paddingLeft: 12 }}>
              <span>Principal:</span>
              <strong>{formatCurrency(preview.allocation?.appliedToPrincipal ?? 0)}</strong>
            </div>
            {preview.allocation?.excessAmount > 0 && (
              <div className="repayment-preview-row" style={{ paddingLeft: 12, color: "var(--color-accent)" }}>
                <span>Excess Amount:</span>
                <strong>{formatCurrency(preview.allocation.excessAmount)}</strong>
              </div>
            )}
          </div>

          <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--color-border)" }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-muted)", marginBottom: 4 }}>
              Remaining After Payment:
            </div>
            <div className="repayment-preview-row" style={{ paddingLeft: 12 }}>
              <span>Interest:</span>
              <strong>{formatCurrency(preview.remainingAfter?.remainingInterest ?? 0)}</strong>
            </div>
            <div className="repayment-preview-row" style={{ paddingLeft: 12 }}>
              <span>Principal:</span>
              <strong>{formatCurrency(preview.remainingAfter?.remainingPrincipal ?? 0)}</strong>
            </div>
            <div className="repayment-preview-row" style={{ paddingLeft: 12, marginTop: 4, fontWeight: 700 }}>
              <span>Total Outstanding:</span>
              <strong style={{ color: "var(--color-warning)" }}>
                {formatCurrency(preview.remainingAfter?.remainingTotalOutstanding ?? 0)}
              </strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="repayment-preview">
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 4, fontWeight: 600 }}>
            Current Balance Before Payment:
          </div>
          {loan?.outstandingPrincipal !== undefined && (
            <div className="repayment-preview-row">
              <span>Outstanding Principal:</span>
              <strong>{formatCurrency(loan.outstandingPrincipal ?? 0)}</strong>
            </div>
          )}
          {loan?.outstandingInterest !== undefined && (
            <div className="repayment-preview-row">
              <span>Outstanding Interest:</span>
              <strong>{formatCurrency(loan.outstandingInterest ?? 0)}</strong>
            </div>
          )}
          <div className="repayment-preview-row">
            <span>Total Outstanding:</span>
            <strong style={{ color: "var(--color-warning)" }}>
              {formatCurrency(totalOutstanding)}
            </strong>
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
            Enter an amount above to preview how it will be allocated to interest and principal.
          </div>
        </div>
      )}

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || previewLoading || !validAmount}
        >
          {submitting ? "Recording..." : "Record Repayment"}
        </button>
      </div>
    </form>
  );
};

export default RepaymentForm;
