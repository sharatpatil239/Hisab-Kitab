import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOverdueLoans } from "../api/loanApi";
import { getBorrowers } from "../api/borrowerApi";
import { usePageHeader } from "../components/layout/AppLayout";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import { formatCurrency, formatDate, daysOverdue } from "../utils/format";

const Overdue = () => {
  const navigate = useNavigate();

  const [loans, setLoans] = useState([]);
  const [borrowers, setBorrowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overdueRes, borrowersRes] = await Promise.all([getOverdueLoans(), getBorrowers()]);
      setLoans(overdueRes.loans || []);
      setBorrowers(borrowersRes.borrowers || []);
    } catch (err) {
      setError(err.message || "Unable to load overdue loans. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePageHeader("Overdue Loans");

  const borrowerNameById = useMemo(() => {
    const map = {};
    borrowers.forEach((b) => {
      map[b._id] = b.name;
    });
    return map;
  }, [borrowers]);

  if (loading) return <LoadingState label="Loading overdue loans..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  if (loans.length === 0) {
    return (
      <div className="page">
        <EmptyState title="Great! You have no overdue loans." />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Borrower</th>
              <th>Loan Amount</th>
              <th>Interest</th>
              <th>Total Outstanding</th>
              <th>Due Date</th>
              <th>Days Overdue</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id} className="row-clickable row-overdue" onClick={() => navigate(`/loans/${loan.id}`)}>
                <td>{borrowerNameById[loan.borrower] || "—"}</td>
                <td>{formatCurrency(loan.principal)}</td>
                <td>{formatCurrency(loan.accruedInterest)}</td>
                <td>
                  <strong>{formatCurrency(loan.totalOutstanding ?? loan.remaining ?? 0)}</strong>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                    Principal: {formatCurrency(loan.outstandingPrincipal ?? 0)} · Interest: {formatCurrency(loan.outstandingInterest ?? 0)}
                  </div>
                </td>
                <td>{formatDate(loan.dueDate)}</td>
                <td className="overdue-days">{daysOverdue(loan.dueDate)} days</td>
                <td>{loan.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Overdue;
