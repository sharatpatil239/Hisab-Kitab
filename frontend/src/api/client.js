import axios from "axios";

// Base URL of the backend API. Configure via VITE_API_URL in .env
// (see .env.example). Falls back to localhost:5000 for local dev.
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const client = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the stored JWT to every outgoing request, per the backend's
// `Authorization: Bearer <token>` auth middleware.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("hisabkitab_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// This is set from AuthContext so the interceptor can trigger a logout
// + redirect whenever the backend says the token is invalid/expired.
let onUnauthorized = null;
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      (error.request && !error.response
        ? "Unable to reach the server. Please check your connection."
        : "Something went wrong. Please try again.");

    if (status === 401 && onUnauthorized) {
      onUnauthorized();
    }

    return Promise.reject({ status, message, raw: error });
  }
);

export default client;
