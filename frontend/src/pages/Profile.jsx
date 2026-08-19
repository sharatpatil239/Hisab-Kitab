import { useEffect, useState } from "react";
import { getMe } from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import { usePageHeader } from "../components/layout/AppLayout";
import LoadingState from "../components/common/LoadingState";
import ErrorState from "../components/common/ErrorState";
import { formatDate } from "../utils/format";

const Profile = () => {
  usePageHeader("Profile");
  const { logout } = useAuth();

  const [lender, setLender] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getMe();
      setLender(res.lender);
    } catch (err) {
      setError(err.message || "Unable to load your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState label="Loading profile..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!lender) return null;

  return (
    <div className="page">
      <div className="profile-card">
        <div className="profile-row">
          <span className="profile-row-label">Name</span>
          <span>{lender.name}</span>
        </div>
        <div className="profile-row">
          <span className="profile-row-label">Email</span>
          <span>{lender.email}</span>
        </div>
        <div className="profile-row">
          <span className="profile-row-label">Phone</span>
          <span>{lender.phone}</span>
        </div>
        <div className="profile-row">
          <span className="profile-row-label">Member Since</span>
          <span>{formatDate(lender.createdAt)}</span>
        </div>
      </div>

      <button type="button" className="btn btn-secondary" onClick={logout} style={{ marginTop: 20 }}>
        Logout
      </button>
    </div>
  );
};

export default Profile;
