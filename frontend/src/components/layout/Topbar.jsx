import { useAuth } from "../../context/AuthContext";

const Topbar = ({ title, onMenuClick, actions }) => {
  const { lender } = useAuth();

  const initials = lender?.name
    ? lender.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="menu-toggle"
          onClick={onMenuClick}
          aria-label="Toggle navigation"
        >
          ☰
        </button>
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-right">
        {actions}
        <div className="topbar-lender">
          <span className="topbar-avatar">{initials}</span>
          <span className="topbar-lender-name">{lender?.name}</span>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
