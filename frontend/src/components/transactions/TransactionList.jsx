import Badge from "../common/Badge";
import { formatCurrency, formatDate, TRANSACTION_TYPE_LABELS } from "../../utils/format";

const typeTone = (type) => {
  if (type === "REPAYMENT") return "received";
  if (type === "LOAN_DISBURSED") return "given";
  return "interest";
};

const signedAmount = (txn) => {
  // Money given (disbursed) and interest accrued increase what's owed;
  // repayments reduce it. Reflect that with +/- for quick scanning.
  if (txn.type === "REPAYMENT") return `-${formatCurrency(txn.amount)}`;
  return `+${formatCurrency(txn.amount)}`;
};

const TransactionList = ({ transactions, showBorrower = false, showLoan = false, borrowerNames = {} }) => {
  if (!transactions?.length) return null;

  return (
    <ul className="list-simple">
      {transactions.map((txn) => (
        <li key={txn._id} className="list-simple-item">
          <span className="list-simple-main">
            <span className="list-simple-title">
              {TRANSACTION_TYPE_LABELS[txn.type] || txn.type}
              {showBorrower && borrowerNames[txn.borrower] ? ` · ${borrowerNames[txn.borrower]}` : ""}
            </span>
            <span className="list-simple-sub">
              {formatDate(txn.date)}
              {txn.description ? ` · ${txn.description}` : ""}
            </span>
          </span>
          <span className="amount" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge tone={typeTone(txn.type)}>{TRANSACTION_TYPE_LABELS[txn.type] || txn.type}</Badge>
            {signedAmount(txn)}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default TransactionList;
