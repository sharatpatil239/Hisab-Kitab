import { useState } from "react";

const BorrowerForm = ({ initialValues, onSubmit, onCancel, submitLabel = "Save" }) => {
  const [form, setForm] = useState({
    name: initialValues?.name || "",
    phone: initialValues?.phone || "",
    email: initialValues?.email || "",
    address: initialValues?.address || "",
    notes: initialValues?.notes || "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Borrower name is required.");
    if (!form.phone.trim()) return setError("Borrower phone number is required.");

    setError("");
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message || "Could not save borrower. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" value={form.name} onChange={handleChange} placeholder="Borrower's full name" />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" value={form.phone} onChange={handleChange} placeholder="10-digit phone number" />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="Optional" />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="address">Address</label>
        <input id="address" name="address" value={form.address} onChange={handleChange} placeholder="Optional" />
      </div>

      <div className="form-group">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={3} value={form.notes} onChange={handleChange} placeholder="Optional" />
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

export default BorrowerForm;
