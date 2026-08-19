require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const authRoutes = require("./routes/authRoutes");
const borrowerRoutes = require("./routes/borrowerRoutes");
const loanRoutes = require("./routes/loanRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

// Connect to MongoDB before starting the server
connectDB();

const app = express();

// --- Core middleware ---

// Allow requests from the configured frontend origin(s). If CLIENT_ORIGIN
// is not set, allow all origins (useful for local development).
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim())
  : true;

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Health check ---
app.get("/", (req, res) => {
  res.json({ success: true, message: "Hisab-Kitab API is running" });
});

// --- API routes ---
app.use("/api/auth", authRoutes);
app.use("/api/borrowers", borrowerRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/dashboard", dashboardRoutes);

// --- Error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Hisab-Kitab server running on port ${PORT}`);
});

module.exports = app;
