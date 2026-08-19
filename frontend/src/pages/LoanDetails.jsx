import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteLoan, getLoanById, recordRepayment } from "../api/loanApi";
import { getBorrowerById } from "../api/borrowerApi";
import { usePageHeader } from "../components/layout/AppLayout";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import RepaymentForm from "../components/loans/RepaymentForm";
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

const LoanDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loan, setLoan] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [borrower, setBorrower] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getLoanById(id);
      setLoan(res.loan);
      setTransactions(res.transactions || []);
      try {
        const borrowerRes = await getBorrowerById(res.loan.borrower);
        setBorrower(borrowerRes.borrower);
      } catch {
        setBorrower(null);
      }
    } catch (err) {
      setError(err.message || "Unable to load loan details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  usePageHeader(borrower ? `${borrower.name}'s Loan` : "Loan Details");

  const handleRepayment = async (values) => {
    const res = await recordRepayment(id, values);
    setLoan(res.loan);
    setShowRepaymentModal(false);
    load();
  };

  const handleDelete = async () => {
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteLoan(id);
      navigate(borrower ? `/borrowers/${borrower._id}` : "/loans", { replace: true });
    } catch (err) {
      setDeleteError(err.message || "Could not delete loan.");
      setDeleting(false);
    }
  };

  if (loading) return <LoadingState label="Loading loan..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!loan) return null;

  return (
    <div className="page">
      <div className="detail-header">
        <div className="detail-header-info">
          <h2>{borrower ? borrower.name : "Borrower"}</h2>
          <p className="detail-header-sub">
            Loan created {formatDate(loan.loanCreationDate)}
            {loan.description ? ` · ${loan.description}` : ""}
          </p>
        </div>
        <div className="detail-header-actions">
          <Badge tone={statusTone(loan.status)}>{LOAN_STATUS_LABELS[loan.status] || loan.status}</Badge>
          <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteConfirm(true)}>
            Delete
          </button>
          {loan.status !== "PAID" && (
            <button type="button" className="btn btn-primary" onClick={() => setShowRepaymentModal(true)}>
              Record Repayment
            </button>
          )}
        </div>
      </div>

      <section className="panel">
        <div className="summary-grid">
          <div className="stat-card">
            <p className="stat-card-label">Principal</p>
            <p className="stat-card-value">{formatCurrency(loan.principal)}</p>
          </div>
          <div className="stat-card stat-card-interest">
            <p className="stat-card-label">Interest</p>
            <p className="stat-card-value">{formatCurrency(loan.accruedInterest)}</p>
          </div>
          <div className="stat-card">
            <p className="stat-card-label">Total Due</p>
            <p className="stat-card-value">{formatCurrency(loan.totalDue)}</p>
          </div>
          <div className="stat-card stat-card-outstanding">
            <p className="stat-card-label">Remaining</p>
            <p className="stat-card-value">{formatCurrency(loan.remaining)}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Loan Details</h2>
        </div>
        <div className="summary-row">
          <span className="summary-row-label">Paid</span>
          <span className="summary-row-value">{formatCurrency(loan.totalPaid)}</span>
        </div>
        <div className="summary-row" style={{ paddingLeft: 20, fontSize: "0.9em", opacity: 0.8 }}>
          <span className="summary-row-label">└ Principal Paid</span>
          <span className="summary-row-value">{formatCurrency(loan.principalPaid)}</span>
        </div>
        <div className="summary-row" style={{ paddingLeft: 20, fontSize: "0.9em", opacity: 0.8 }}>
          <span className="summary-row-label">└ Interest Paid</span>
          <span className="summary-row-value">{formatCurrency(loan.interestPaid)}</span>
        </div>
        <div className="summary-row" style={{ paddingLeft: 20, fontSize: "0.9em", opacity: 0.8 }}>
          <span className="summary-row-label">└ Remaining Principal</span>
          <span className="summary-row-value">{formatCurrency(loan.outstandingPrincipal)}</span>
        </div>
        <div className="summary-row" style={{ paddingLeft: 20, fontSize: "0.9em", opacity: 0.8 }}>
          <span className="summary-row-label">└ Remaining Interest</span>
          <span className="summary-row-value">{formatCurrency(loan.outstandingInterest)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-row-label">Interest Type</span>
          <span className="summary-row-value">{INTEREST_TYPE_LABELS[loan.interestType] || loan.interestType}</span>
        </div>
        <div className="summary-row">
          <span className="summary-row-label">Interest Rate</span>
          <span className="summary-row-value">
            {loan.interestRate}% / {RATE_PERIOD_LABELS[loan.ratePeriod] || loan.ratePeriod}
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-row-label">Interest Start Date</span>
          <span className="summary-row-value">{formatDate(loan.interestStartDate)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-row-label">Due Date</span>
          <span className="summary-row-value">{formatDate(loan.dueDate)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-row-label">Payment Allocation</span>
          <span className="summary-row-value">
            {PAYMENT_ALLOCATION_LABELS[loan.paymentAllocation] || loan.paymentAllocation}
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-row-label">Status</span>
          <span className="summary-row-value">
            <Badge tone={statusTone(loan.status)}>{LOAN_STATUS_LABELS[loan.status] || loan.status}</Badge>
          </span>
        </div>
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

      <Modal open={showRepaymentModal} title="Record Repayment" onClose={() => setShowRepaymentModal(false)}>
        <RepaymentForm
          remaining={loan.remaining}
          onSubmit={handleRepayment}
          onCancel={() => setShowRepaymentModal(false)}
        />
      </Modal>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete loan?"
        message={deleteError || "Are you sure you want to delete this loan? This cannot be undone."}
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

export default LoanDetails;
