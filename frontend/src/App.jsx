import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Borrowers from "./pages/Borrowers";
import BorrowerDetails from "./pages/BorrowerDetails";
import Loans from "./pages/Loans";
import LoanDetails from "./pages/LoanDetails";
import Transactions from "./pages/Transactions";
import Overdue from "./pages/Overdue";
import Profile from "./pages/Profile";

// Sends an already-logged-in lender straight to the dashboard instead of
// showing the login/register screens again.
const RedirectIfAuthenticated = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
};

const AppRoutes = () => (
  <Routes>
    <Route
      path="/login"
      element={
        <RedirectIfAuthenticated>
          <Login />
        </RedirectIfAuthenticated>
      }
    />
    <Route
      path="/register"
      element={
        <RedirectIfAuthenticated>
          <Register />
        </RedirectIfAuthenticated>
      }
    />

    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/borrowers" element={<Borrowers />} />
        <Route path="/borrowers/:id" element={<BorrowerDetails />} />
        <Route path="/loans" element={<Loans />} />
        <Route path="/loans/:id" element={<LoanDetails />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/overdue" element={<Overdue />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Route>

    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
