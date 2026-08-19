import client from "./client";

// GET /api/dashboard -> { totals, counts, recentLoans, recentRepayments, topOutstandingBorrowers }
export const getDashboard = () =>
  client.get("/dashboard").then((res) => res.data);
