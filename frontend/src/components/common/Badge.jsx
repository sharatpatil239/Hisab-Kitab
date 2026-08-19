// tone: "active" | "paid" | "overdue" | "given" | "received" | "interest" | "neutral"
const Badge = ({ children, tone = "neutral" }) => {
  return <span className={`badge badge-${tone}`}>{children}</span>;
};

export default Badge;
