import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTransactions } from "../api/transactionApi";
import { getBorrowers } from "../api/borrowerApi";
import { getLoans } from "../api/loanApi";
import { usePageHeader } from "../components/layout/AppLayout";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import Badge from "../components/common/Badge";
import { formatCurrency, formatDate, TRANSACTION_TYPE_LABELS } from "../utils/format";

const TYPE_FILTERS = [
  { key: "", label: "All" },
  { key: "LOAN_DISBURSED", label: "Money Given" },
  { key: "REPAYMENT", label: "Payment Received" },
  { key: "INTEREST_ACCRUED", label: "Interest" },
];

const typeTone = (type) => {
  if (type === "REPAYMENT") return "received";
  if (type === "LOAN_DISBURSED") return "given";
  return "interest";
};

const signedAmount = (txn) => (txn.type === "REPAYMENT" ? `-${formatCurrency(txn.amount)}` : `+${formatCurrency(txn.amount)}`);

const Transactions = () => {
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [borrowers, setBorrowers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [typeFilter, setTypeFilter] = useState("");
  const [borrowerFilter, setBorrowerFilter] = useState("");

  const load = useCallback(async (filters) => {
    setLoading(true);
    setError("");
    try {
      const [txnRes, borrowersRes, loansRes] = await Promise.all([
        getTransactions(filters),
        getBorrowers(),
        getLoans(),
      ]);
      setTransactions(txnRes.transactions || []);
      setBorrowers(borrowersRes.borrowers || []);
      setLoans(loansRes.loans || []);
    } catch (err) {
      setError(err.message || "Unable to load transactions. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const filters = {};
    if (typeFilter) filters.type = typeFilter;
    if (borrowerFilter) filters.borrowerId = borrowerFilter;
    load(filters);
  }, [load, typeFilter, borrowerFilter]);

  usePageHeader("Transactions");

  const borrowerNameById = useMemo(() => {
    const map = {};
    borrowers.forEach((b) => {
      map[b._id] = b.name;
    });
    return map;
  }, [borrowers]);

  const loanLabelById = useMemo(() => {
    const map = {};
    loans.forEach((l) => {
      map[l.id] = formatCurrency(l.principal);
    });
    return map;
  }, [loans]);

  return (
    <div className="page">
      <div className="toolbar">
        <select value={borrowerFilter} onChange={(e) => setBorrowerFilter(e.target.value)}>
          <option value="">All borrowers</option>
          {borrowers.map((b) => (
            <option key={b._id} value={b._id}>
              {b.name}
            </option>
          ))}
        </select>
        <div className="filter-chips">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`filter-chip ${typeFilter === f.key ? "filter-chip-active" : ""}`}
              onClick={() => setTypeFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <LoadingState label="Loading transactions..." />}
      {!loading && error && (
        <ErrorState
          message={error}
          onRetry={() => load(typeFilter || borrowerFilter ? { type: typeFilter || undefined, borrowerId: borrowerFilter || undefined } : {})}
        />
      )}

      {!loading && !error && transactions.length === 0 && <EmptyState title="No transactions yet" />}

      {!loading && !error && transactions.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Borrower</th>
                <th>Loan</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Allocation Breakdown</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr
                  key={txn._id}
                  className="row-clickable"
                  onClick={() => navigate(`/loans/${txn.loan}`)}
                >
                  <td>{formatDate(txn.date)}</td>
                  <td>{borrowerNameById[txn.borrower] || "—"}</td>
                  <td>{loanLabelById[txn.loan] || "—"}</td>
                  <td>
                    <Badge tone={typeTone(txn.type)}>{TRANSACTION_TYPE_LABELS[txn.type] || txn.type}</Badge>
                  </td>
                  <td>{signedAmount(txn)}</td>
                  <td>
                    {txn.type === "REPAYMENT" ? (
                      <span style={{ fontSize: 13 }}>
                        Principal: {formatCurrency(txn.principalComponent ?? 0)} · Interest: {formatCurrency(txn.interestComponent ?? 0)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{txn.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Transactions;
