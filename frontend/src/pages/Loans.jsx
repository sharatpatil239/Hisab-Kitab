import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createLoan, getLoans } from "../api/loanApi";
import { getBorrowers } from "../api/borrowerApi";
import { usePageHeader } from "../components/layout/AppLayout";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import CreateLoanForm from "../components/loans/CreateLoanForm";
import {
  formatCurrency,
  formatDate,
  INTEREST_TYPE_LABELS,
  LOAN_STATUS_LABELS,
  RATE_PERIOD_LABELS,
} from "../utils/format";

const FILTERS = [
  { key: "", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "PAID", label: "Paid" },
  { key: "OVERDUE", label: "Overdue" },
];

const statusTone = (status) => {
  if (status === "PAID") return "paid";
  if (status === "OVERDUE") return "overdue";
  return "active";
};

const Loans = () => {
  const navigate = useNavigate();

  const [loans, setLoans] = useState([]);
  const [borrowers, setBorrowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState("");

  const load = useCallback(async (status) => {
    setLoading(true);
    setError("");
    try {
      const [loansRes, borrowersRes] = await Promise.all([
        getLoans(status ? { status } : {}),
        getBorrowers(),
      ]);
      setLoans(loansRes.loans || []);
      setBorrowers(borrowersRes.borrowers || []);
    } catch (err) {
      setError(err.message || "Unable to load loans. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(statusFilter);
  }, [load, statusFilter]);

  usePageHeader(
    "Loans",
    <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
      + Create Loan
    </button>
  );

  const borrowerNameById = useMemo(() => {
    const map = {};
    borrowers.forEach((b) => {
      map[b._id] = b.name;
    });
    return map;
  }, [borrowers]);

  const visibleLoans = useMemo(() => {
    if (!search.trim()) return loans;
    const term = search.trim().toLowerCase();
    return loans.filter((loan) => (borrowerNameById[loan.borrower] || "").toLowerCase().includes(term));
  }, [loans, search, borrowerNameById]);

  const handleCreate = async (values) => {
    await createLoan({ ...values, borrowerId: selectedBorrowerId });
    setShowCreateModal(false);
    setSelectedBorrowerId("");
    load(statusFilter);
  };

  return (
    <div className="page">
      <div className="toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="Search loans by borrower name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-chips">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`filter-chip ${statusFilter === f.key ? "filter-chip-active" : ""}`}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <LoadingState label="Loading loans..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => load(statusFilter)} />}

      {!loading && !error && visibleLoans.length === 0 && (
        <EmptyState
          title="No loans yet"
          subtitle={search ? "Try a different borrower name." : "Create a loan to start tracking a lend."}
          action={
            !search && (
              <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                Create Loan
              </button>
            )
          }
        />
      )}

      {!loading && !error && visibleLoans.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Borrower</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Total Due</th>
                <th>Total Paid</th>
                <th>Total Outstanding</th>
                <th>Type</th>
                <th>Rate</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleLoans.map((loan) => (
                <tr
                  key={loan.id}
                  className={`row-clickable ${loan.status === "OVERDUE" ? "row-overdue" : ""}`}
                  onClick={() => navigate(`/loans/${loan.id}`)}
                >
                  <td>{borrowerNameById[loan.borrower] || "—"}</td>
                  <td>{formatCurrency(loan.principal)}</td>
                  <td>{formatCurrency(loan.accruedInterest)}</td>
                  <td>{formatCurrency(loan.totalDue)}</td>
                  <td>{formatCurrency(loan.totalPaid ?? 0)}</td>
                  <td>
                    <strong>{formatCurrency(loan.totalOutstanding ?? loan.remaining ?? 0)}</strong>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                      Principal: {formatCurrency(loan.outstandingPrincipal ?? 0)} · Interest: {formatCurrency(loan.outstandingInterest ?? 0)}
                    </div>
                  </td>
                  <td>{INTEREST_TYPE_LABELS[loan.interestType]}</td>
                  <td>
                    {loan.interestRate}% / {RATE_PERIOD_LABELS[loan.ratePeriod]}
                  </td>
                  <td>{formatDate(loan.dueDate)}</td>
                  <td>
                    <Badge tone={statusTone(loan.status)}>{LOAN_STATUS_LABELS[loan.status] || loan.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showCreateModal}
        title="Create Loan"
        onClose={() => {
          setShowCreateModal(false);
          setSelectedBorrowerId("");
        }}
        wide
      >
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label htmlFor="borrowerSelect">Borrower</label>
          <select
            id="borrowerSelect"
            value={selectedBorrowerId}
            onChange={(e) => setSelectedBorrowerId(e.target.value)}
          >
            <option value="">Select a borrower</option>
            {borrowers.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name} · {b.phone}
              </option>
            ))}
          </select>
        </div>

        {selectedBorrowerId ? (
          <CreateLoanForm
            onSubmit={handleCreate}
            onCancel={() => {
              setShowCreateModal(false);
              setSelectedBorrowerId("");
            }}
          />
        ) : (
          <p className="form-hint">Choose a borrower above to continue.</p>
        )}
      </Modal>
    </div>
  );
};

export default Loans;
