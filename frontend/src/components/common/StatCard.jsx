const StatCard = ({ label, value, tone = "neutral" }) => {
  return (
    <div className={`stat-card stat-card-${tone}`}>
      <p className="stat-card-label">{label}</p>
      <p className="stat-card-value">{value}</p>
    </div>
  );
};

export default StatCard;
