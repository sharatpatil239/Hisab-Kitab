# Hisab-Kitab Frontend

A React frontend for the Hisab-Kitab digital lending ledger backend. Built with
Create React App, React Router, and Axios.

## 1. Install dependencies

```bash
cd frontend
npm install
```

## 2. Configure the backend URL

Copy the example env file and point it at your running backend:

```bash
cp .env.example .env
```

`.env`:

```
REACT_APP_API_URL=http://localhost:5000/api
```

Create React App only exposes environment variables prefixed with
`REACT_APP_`, and only reads `.env` at build/start time — restart `npm start`
after changing it.

## 3. Run the backend

This frontend expects the Hisab-Kitab backend (Express + MongoDB) to already
be running — see that project's own README for `npm install` / `npm run dev`
instructions. By default it runs on `http://localhost:5000`.

## 4. Run the frontend

```bash
npm start
```

Opens on `http://localhost:3000`.

## Available pages

| Route | Description |
|---|---|
| `/login` | Log in with email + password |
| `/register` | Create a new lender account |
| `/dashboard` | Totals, recent activity, top outstanding borrowers |
| `/borrowers` | Search/list borrowers, add a borrower |
| `/borrowers/:id` | Borrower account summary, loans, full transaction history, edit/delete |
| `/loans` | All loans with search + status filters, create a loan |
| `/loans/:id` | Loan financial summary, transaction history, record a repayment, delete |
| `/transactions` | Full ledger with borrower/type filters |
| `/overdue` | Loans past due date with money still outstanding |
| `/profile` | Logged-in lender's profile (`GET /api/auth/me`) |

## How the frontend talks to the backend

- All requests go through a single Axios instance (`src/api/client.js`) with
  the base URL from `REACT_APP_API_URL`.
- The JWT returned on login/register is stored in `localStorage` and attached
  to every request as `Authorization: Bearer <token>`, matching the backend's
  `protect` middleware.
- A response interceptor watches for `401` responses and automatically logs
  the lender out and redirects to `/login` (covers expired/invalid tokens).
- The frontend never recalculates interest, balances, or repayment
  allocation — every number shown (accrued interest, total due, remaining
  balance, principal/interest split on a repayment) comes directly from the
  backend's response.

## API modules (`src/api/`)

- `authApi.js` — register, login, get profile
- `borrowerApi.js` — CRUD + account summary (`/borrowers/:id/summary`)
- `loanApi.js` — CRUD, overdue list, record repayment
- `transactionApi.js` — list/get transactions
- `dashboardApi.js` — dashboard totals/counts/recent activity

## Known backend/frontend interaction notes

- `GET /api/loans`, `GET /api/loans/overdue`, and `GET /api/loans/:id` do
  **not** populate the borrower's name — only the borrower's id. The Loans,
  Overdue, and Transactions pages fetch the borrower list separately and
  build a local id → name lookup rather than assuming a populated field.
- Deleting a borrower is blocked by the backend if they still have loan
  records, and deleting a loan is blocked if it already has repayments — the
  frontend surfaces whatever error message the backend returns rather than
  duplicating that rule.
