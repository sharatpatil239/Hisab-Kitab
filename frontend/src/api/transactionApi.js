import client from "./client";

// GET /api/transactions?borrowerId=&loanId=&type= -> { count, transactions }
export const getTransactions = (filters = {}) =>
  client.get("/transactions", { params: filters }).then((res) => res.data);

// GET /api/transactions/:id -> { transaction }
export const getTransactionById = (id) =>
  client.get(`/transactions/${id}`).then((res) => res.data);
