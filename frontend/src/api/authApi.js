import client from "./client";

// POST /api/auth/register  { name, email, phone, password } -> { token, lender }
export const registerLender = (payload) =>
  client.post("/auth/register", payload).then((res) => res.data);

// POST /api/auth/login  { email, password } -> { token, lender }
export const loginLender = (payload) =>
  client.post("/auth/login", payload).then((res) => res.data);

// GET /api/auth/me -> { lender }
export const getMe = () => client.get("/auth/me").then((res) => res.data);
