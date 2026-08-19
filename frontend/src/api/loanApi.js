import client from "./client";

// GET /api/loans?borrowerId=&status= -> { count, loans }
export const getLoans = (filters = {}) =>
  client.get("/loans", { params: filters }).then((res) => res.data);

// GET /api/loans/overdue -> { count, loans }
export const getOverdueLoans = () =>
  client.get("/loans/overdue").then((res) => res.data);

// GET /api/loans/:id -> { loan, transactions }
export const getLoanById = (id) =>
  client.get(`/loans/${id}`).then((res) => res.data);

// POST /api/loans  -> { loan }
export const createLoan = (payload) =>
  client.post("/loans", payload).then((res) => res.data);

// PUT /api/loans/:id -> { loan }
export const updateLoan = (id, payload) =>
  client.put(`/loans/${id}`, payload).then((res) => res.data);

// DELETE /api/loans/:id -> {}
export const deleteLoan = (id) =>
  client.delete(`/loans/${id}`).then((res) => res.data);

// POST /api/loans/:id/repayments  { amount, date, description } -> { transaction, loan }
export const recordRepayment = (id, payload) =>
  client.post(`/loans/${id}/repayments`, payload).then((res) => res.data);
