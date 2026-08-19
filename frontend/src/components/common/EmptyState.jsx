const EmptyState = ({ title, subtitle, action }) => {
  return (
    <div className="state-block empty-state">
      <p className="empty-state-title">{title}</p>
      {subtitle && <p className="empty-state-subtitle">{subtitle}</p>}
      {action}
    </div>
  );
};

export default EmptyState;
