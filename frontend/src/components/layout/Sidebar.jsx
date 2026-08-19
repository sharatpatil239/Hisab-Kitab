import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/borrowers", label: "Borrowers" },
  { to: "/loans", label: "Loans" },
  { to: "/transactions", label: "Transactions" },
  { to: "/overdue", label: "Overdue" },
  { to: "/profile", label: "Profile" },
];

const Sidebar = ({ open, onNavigate }) => {
  const { logout } = useAuth();

  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand">Hisab-Kitab</div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
            onClick={onNavigate}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <button type="button" className="sidebar-logout" onClick={logout}>
        Logout
      </button>
    </aside>
  );
};

export default Sidebar;
