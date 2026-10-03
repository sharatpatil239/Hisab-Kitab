import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteBorrower, getBorrowerSummary, updateBorrower } from "../api/borrowerApi";
import { createLoan } from "../api/loanApi";
import { usePageHeader } from "../components/layout/AppLayout";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import BorrowerForm from "../components/borrowers/BorrowerForm";
import CreateLoanForm from "../components/loans/CreateLoanForm";
import TransactionList from "../components/transactions/TransactionList";
import {
  formatCurrency,
  formatDate,
  INTEREST_TYPE_LABELS,
  LOAN_STATUS_LABELS,
  PAYMENT_ALLOCATION_LABELS,
  RATE_PERIOD_LABELS,
} from "../utils/format";

const statusTone = (status) => {
  if (status === "PAID") return "paid";
  if (status === "OVERDUE") return "overdue";
  return "active";
};

const BorrowerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getBorrowerSummary(id);
      setData(res);
    } catch (err) {
      setError(err.message || "Unable to load borrower details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  usePageHeader(data?.borrower?.name || "Borrower");

  const handleEdit = async (values) => {
    const res = await updateBorrower(id, values);
    setData((prev) => ({ ...prev, borrower: res.borrower }));
    setShowEditModal(false);
  };

  const handleDelete = async () => {
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteBorrower(id);
      navigate("/borrowers", { replace: true });
    } catch (err) {
      setDeleteError(err.message || "Could not delete borrower.");
      setDeleting(false);
    }
  };

  const handleCreateLoan = async (values) => {
    await createLoan({ ...values, borrowerId: id });
    setShowLoanModal(false);
    load();
  };

  if (loading) return <LoadingState label="Loading borrower..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const { borrower, loans, transactions, totals } = data;

  return (
    <div className="page">
      <div className="detail-header">
        <div className="detail-header-info">
          <h2>{borrower.name}</h2>
          <p className="detail-header-sub">
            Phone: {borrower.phone}
            {borrower.email ? ` · ${borrower.email}` : ""}
          </p>
        </div>
        <div className="detail-header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(true)}>
            Edit
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteConfirm(true)}>
            Delete
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setShowLoanModal(true)}>
            + Create Loan
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="stat-card stat-card-lent">
          <p className="stat-card-label">Total Principal Lent</p>
          <p className="stat-card-value">{formatCurrency(totals.totalPrincipalLent ?? totals.totalLent ?? 0)}</p>
        </div>
        <div className="stat-card stat-card-interest">
          <p className="stat-card-label">Total Interest Accrued</p>
          <p className="stat-card-value">{formatCurrency(totals.totalInterestAccrued ?? 0)}</p>
        </div>
        <div className="stat-card stat-card-received">
          <p className="stat-card-label">Total Repaid</p>
          <p className="stat-card-value">{formatCurrency(totals.totalRepaid ?? totals.totalPaid ?? 0)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Outstanding Principal</p>
          <p className="stat-card-value">{formatCurrency(totals.outstandingPrincipal ?? 0)}</p>
        </div>
        <div className="stat-card stat-card-interest">
          <p className="stat-card-label">Outstanding Interest</p>
          <p className="stat-card-value">{formatCurrency(totals.outstandingInterest ?? 0)}</p>
        </div>
        <div className="stat-card stat-card-outstanding">
          <p className="stat-card-label">Total Outstanding</p>
          <p className="stat-card-value">{formatCurrency(totals.totalOutstanding ?? 0)}</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Loans</h2>
        </div>
        {loans.length === 0 ? (
          <EmptyState
            title="No loans yet"
            action={
              <button type="button" className="btn btn-primary" onClick={() => setShowLoanModal(true)}>
                Create Loan
              </button>
            }
          />
        ) : (
          <div className="card-grid">
            {loans.map((loan) => (
              <div key={loan.id} className="loan-card" onClick={() => navigate(`/loans/${loan.id}`)}>
                <div className="loan-card-top">
                  <div>
                    <strong>{formatCurrency(loan.principal)}</strong>
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginLeft: 6 }}>
                      ({PAYMENT_ALLOCATION_LABELS[loan.paymentAllocation] || loan.paymentAllocation})
                    </span>
                  </div>
                  <Badge tone={statusTone(loan.status)}>{LOAN_STATUS_LABELS[loan.status] || loan.status}</Badge>
                </div>
                <div className="loan-card-grid">
                  <div className="loan-card-grid-item">
                    <span className="loan-card-grid-label">Outstanding Principal</span>
                    <span>{formatCurrency(loan.outstandingPrincipal ?? 0)}</span>
                  </div>
                  <div className="loan-card-grid-item">
                    <span className="loan-card-grid-label">Outstanding Interest</span>
                    <span>{formatCurrency(loan.outstandingInterest ?? 0)}</span>
                  </div>
                  <div className="loan-card-grid-item">
                    <span className="loan-card-grid-label">Total Outstanding</span>
                    <span style={{ fontWeight: 700, color: "var(--color-warning)" }}>
                      {formatCurrency(loan.totalOutstanding ?? loan.remaining ?? 0)}
                    </span>
                  </div>
                  <div className="loan-card-grid-item">
                    <span className="loan-card-grid-label">Total Repaid</span>
                    <span>{formatCurrency(loan.totalPaid ?? 0)}</span>
                  </div>
                  <div className="loan-card-grid-item">
                    <span className="loan-card-grid-label">Interest Accrued</span>
                    <span>{formatCurrency(loan.accruedInterest ?? 0)}</span>
                  </div>
                  <div className="loan-card-grid-item">
                    <span className="loan-card-grid-label">Due Date</span>
                    <span>{formatDate(loan.dueDate)}</span>
                  </div>
                </div>
                <div className="loan-card-grid-item">
                  <span className="loan-card-grid-label">Interest Type</span>
                  <span>
                    {INTEREST_TYPE_LABELS[loan.interestType]} · {loan.interestRate}% / {RATE_PERIOD_LABELS[loan.ratePeriod]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Transaction History</h2>
        </div>
        {transactions.length === 0 ? (
          <EmptyState title="No transactions yet" />
        ) : (
          <TransactionList transactions={transactions} />
        )}
      </section>

      <Modal open={showEditModal} title="Edit Borrower" onClose={() => setShowEditModal(false)}>
        <BorrowerForm
          initialValues={borrower}
          onSubmit={handleEdit}
          onCancel={() => setShowEditModal(false)}
          submitLabel="Save Changes"
        />
      </Modal>

      <Modal open={showLoanModal} title={`Create Loan for ${borrower.name}`} onClose={() => setShowLoanModal(false)} wide>
        <CreateLoanForm onSubmit={handleCreateLoan} onCancel={() => setShowLoanModal(false)} />
      </Modal>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete borrower?"
        message={deleteError || `Are you sure you want to delete ${borrower.name}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteError("");
        }}
      />
    </div>
  );
};

export default BorrowerDetails;
