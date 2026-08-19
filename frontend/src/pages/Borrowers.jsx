import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBorrower, getBorrowers } from "../api/borrowerApi";
import { usePageHeader } from "../components/layout/AppLayout";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import EmptyState from "../components/common/EmptyState";
import Modal from "../components/common/Modal";
import BorrowerForm from "../components/borrowers/BorrowerForm";

const Borrowers = () => {
  const navigate = useNavigate();

  const [borrowers, setBorrowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const load = useCallback(async (searchTerm) => {
    setLoading(true);
    setError("");
    try {
      const res = await getBorrowers(searchTerm);
      setBorrowers(res.borrowers || []);
    } catch (err) {
      setError(err.message || "Unable to load borrowers. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce search so we don't fire a request on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      load(search.trim() || undefined);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  usePageHeader(
    "Borrowers",
    <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>
      + Add Borrower
    </button>
  );

  const handleCreate = async (values) => {
    const res = await createBorrower(values);
    setShowAddModal(false);
    setBorrowers((prev) => [res.borrower, ...prev]);
    navigate(`/borrowers/${res.borrower._id}`);
  };

  return (
    <div className="page">
      <div className="toolbar">
        <input
          type="search"
          className="search-input"
          placeholder="Search borrowers by name, phone, or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <LoadingState label="Loading borrowers..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => load(search.trim() || undefined)} />}

      {!loading && !error && borrowers.length === 0 && (
        <EmptyState
          title={search ? "No borrowers match your search" : "No borrowers yet"}
          subtitle={search ? "Try a different name, phone, or email." : "Add your first borrower to get started."}
          action={
            !search && (
              <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                + Add Your First Borrower
              </button>
            )
          }
        />
      )}

      {!loading && !error && borrowers.length > 0 && (
        <div className="card-grid">
          {borrowers.map((borrower) => (
            <button
              key={borrower._id}
              type="button"
              className="borrower-card"
              onClick={() => navigate(`/borrowers/${borrower._id}`)}
            >
              <div className="borrower-card-name">{borrower.name}</div>
              <div className="borrower-card-detail">{borrower.phone}</div>
              {borrower.email && <div className="borrower-card-detail">{borrower.email}</div>}
            </button>
          ))}
        </div>
      )}

      <Modal open={showAddModal} title="Add Borrower" onClose={() => setShowAddModal(false)}>
        <BorrowerForm onSubmit={handleCreate} onCancel={() => setShowAddModal(false)} submitLabel="Add Borrower" />
      </Modal>
    </div>
  );
};

export default Borrowers;
