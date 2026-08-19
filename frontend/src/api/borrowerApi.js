import client from "./client";

// GET /api/borrowers?search= -> { count, borrowers }
export const getBorrowers = (search) =>
  client
    .get("/borrowers", { params: search ? { search } : {} })
    .then((res) => res.data);

// GET /api/borrowers/:id -> { borrower }
export const getBorrowerById = (id) =>
  client.get(`/borrowers/${id}`).then((res) => res.data);

// GET /api/borrowers/:id/summary -> { borrower, loans, transactions, totals }
export const getBorrowerSummary = (id) =>
  client.get(`/borrowers/${id}/summary`).then((res) => res.data);

// POST /api/borrowers  { name, phone, email, address, notes } -> { borrower }
export const createBorrower = (payload) =>
  client.post("/borrowers", payload).then((res) => res.data);

// PUT /api/borrowers/:id -> { borrower }
export const updateBorrower = (id, payload) =>
  client.put(`/borrowers/${id}`, payload).then((res) => res.data);

// DELETE /api/borrowers/:id -> {}
export const deleteBorrower = (id) =>
  client.delete(`/borrowers/${id}`).then((res) => res.data);
