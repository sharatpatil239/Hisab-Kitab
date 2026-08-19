import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboard } from "../api/dashboardApi";
import { usePageHeader } from "../components/layout/AppLayout";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import StatCard from "../components/common/StatCard";
import Badge from "../components/common/Badge";
import { formatCurrency, formatDate, LOAN_STATUS_LABELS } from "../utils/format";

const statusTone = (status) => {
  if (status === "PAID") return "paid";
  if (status === "OVERDUE") return "overdue";
  return "active";
};

const Dashboard = () => {
  usePageHeader("Dashboard");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getDashboard();
      setData(res);
    } catch (err) {
      setError(err.message || "Unable to load dashboard. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const { totals, counts, recentLoans, recentRepayments, topOutstandingBorrowers } = data;

  return (
    <div className="page">
      <div className="stat-grid">
        <StatCard label="Total Lent" value={formatCurrency(totals.totalLent)} tone="lent" />
        <StatCard label="Total Received" value={formatCurrency(totals.totalReceived)} tone="received" />
        <StatCard label="Outstanding" value={formatCurrency(totals.totalOutstanding)} tone="outstanding" />
        <StatCard label="Interest Accrued" value={formatCurrency(totals.totalInterestAccrued)} tone="interest" />
      </div>

      <div className="stat-grid stat-grid-secondary">
        <StatCard label="Active Borrowers" value={counts.activeBorrowers} />
        <StatCard label="Total Borrowers" value={counts.totalBorrowers} />
        <StatCard label="Active Loans" value={counts.activeLoans} />
        <StatCard label="Overdue Loans" value={counts.overdueLoans} tone={counts.overdueLoans > 0 ? "overdue" : "neutral"} />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Recent Loans</h2>
            <Link to="/loans" className="panel-link">View all</Link>
          </div>
          {recentLoans?.length ? (
            <ul className="list-simple">
              {recentLoans.map((loan) => (
                <li key={loan._id} className="list-simple-item">
                  <Link to={`/loans/${loan._id}`} className="list-simple-main">
                    <span className="list-simple-title">{loan.borrower?.name || "Borrower"}</span>
                    <span className="list-simple-sub">{formatCurrency(loan.principal)} · {formatDate(loan.loanCreationDate)}</span>
                  </Link>
                  <Badge tone={statusTone(loan.status)}>{LOAN_STATUS_LABELS[loan.status] || loan.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No loans yet" />
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Recent Repayments</h2>
            <Link to="/transactions" className="panel-link">View all</Link>
          </div>
          {recentRepayments?.length ? (
            <ul className="list-simple">
              {recentRepayments.map((txn) => (
                <li key={txn._id} className="list-simple-item">
                  <span className="list-simple-main">
                    <span className="list-simple-title">{txn.borrower?.name || "Borrower"}</span>
                    <span className="list-simple-sub">{formatDate(txn.date)}</span>
                  </span>
                  <span className="amount amount-received">-{formatCurrency(txn.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No repayments recorded yet" />
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Overdue Loans</h2>
            <Link to="/overdue" className="panel-link">View all</Link>
          </div>
          {counts.overdueLoans > 0 ? (
            <p className="panel-note">
              You have <strong>{counts.overdueLoans}</strong> overdue loan{counts.overdueLoans > 1 ? "s" : ""}. Review them
              on the Overdue page.
            </p>
          ) : (
            <EmptyState title="Great! You have no overdue loans." />
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Top Outstanding Borrowers</h2>
          </div>
          {topOutstandingBorrowers?.length ? (
            <ul className="list-simple">
              {topOutstandingBorrowers.map((entry) => (
                <li key={entry.borrower._id} className="list-simple-item">
                  <Link to={`/borrowers/${entry.borrower._id}`} className="list-simple-main">
                    <span className="list-simple-title">{entry.borrower.name}</span>
                    <span className="list-simple-sub">{entry.borrower.phone}</span>
                  </Link>
                  <span className="amount amount-outstanding">{formatCurrency(entry.outstanding)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No outstanding balances" />
          )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
