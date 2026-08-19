# Hisab-Kitab Backend

A digital lending and account-management (ledger) backend for a lender who
gives money to multiple borrowers. Built with Node.js, Express, and MongoDB
(Mongoose). This is **backend only** — no frontend is included.

## Tech stack

- Node.js + Express
- MongoDB + Mongoose
- JWT authentication
- bcrypt password hashing
- dotenv for config
- CORS enabled

---

## 1. Install dependencies

```bash
cd hisab-kitab-backend
npm install
```

## 2. Configure environment variables

Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

`.env` variables:

| Variable | Description |
|---|---|
| `MONGO_URI` | Your MongoDB connection string |
| `PORT` | Port the server runs on (default 5000) |
| `JWT_SECRET` | A long random string used to sign JWTs |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `CLIENT_ORIGIN` | Your frontend's URL, for CORS (comma-separated for multiple) |

## 3. Run the server

```bash
# development (auto-restarts on file changes)
npm run dev

# production
npm start
```

The server starts on `http://localhost:5000` by default. Visit
`http://localhost:5000/` to see a health-check response.

---

## Project structure

```
backend/
├── config/db.js                 → MongoDB connection
├── controllers/                 → route handler logic
├── middleware/                  → auth + error handling
├── models/                      → Mongoose schemas (Lender, Borrower, Loan, Transaction)
├── routes/                      → Express routers, mounted under /api
├── services/interestService.js  → ALL interest math lives here
├── utils/                       → small shared helpers/validators
└── server.js                    → app entry point
```

## How interest is calculated (important)

All interest math lives in `services/interestService.js` — controllers never
calculate interest themselves.

Interest accrues on a loan's **original principal**, from `interestStartDate`
to the date you ask about (today, by default), using the loan's configured
`interestType` (`SIMPLE` or `COMPOUND`), `interestRate`, and `ratePeriod`
(`DAILY`, `MONTHLY`, `YEARLY`).

- **Simple interest**: `Interest = Principal × dailyRate × daysElapsed`
- **Compound interest**: compounds once per configured period
  (`Amount = Principal × (1 + rate)^periods`, `Interest = Amount − Principal`)

When a repayment comes in, it's split between "outstanding interest" and
"outstanding principal" according to the loan's `paymentAllocation` setting
(`INTEREST_FIRST` by default, or `PRINCIPAL_FIRST`). This split is stored on
the transaction and tracked cumulatively on the loan (`interestPaid`,
`principalPaid`), so nothing is ever overwritten — every past transaction
stays exactly as it was recorded.

---

## Authentication

Every route except `/api/auth/register` and `/api/auth/login` requires a
JWT in the `Authorization` header:

```
Authorization: Bearer <your_token>
```

All data (borrowers, loans, transactions) is automatically scoped to the
logged-in lender — one lender can never see another lender's data.

---

## API Reference & Examples

### Auth

**Register** — `POST /api/auth/register`
```json
{
  "name": "Amit Sharma",
  "email": "amit@example.com",
  "phone": "9876543210",
  "password": "secret123"
}
```
Response `201`:
```json
{
  "success": true,
  "message": "Lender registered successfully",
  "token": "eyJhbGciOi...",
  "lender": { "id": "...", "name": "Amit Sharma", "email": "amit@example.com", "phone": "9876543210" }
}
```

**Login** — `POST /api/auth/login`
```json
{ "email": "amit@example.com", "password": "secret123" }
```

**Get my profile** — `GET /api/auth/me` (protected)

---

### Borrowers

| Method | Route | Description |
|---|---|---|
| POST | `/api/borrowers` | Add a borrower |
| GET | `/api/borrowers?search=rahul` | List / search my borrowers |
| GET | `/api/borrowers/:id` | Get one borrower |
| PUT | `/api/borrowers/:id` | Update a borrower |
| DELETE | `/api/borrowers/:id` | Delete a borrower (blocked if they have loans) |
| GET | `/api/borrowers/:id/summary` | Full account view: borrower + all loans + full transaction history + totals |

**Add borrower** — `POST /api/borrowers`
```json
{ "name": "Rahul Verma", "phone": "9999999999", "email": "rahul@example.com" }
```

---

### Loans

| Method | Route | Description |
|---|---|---|
| POST | `/api/loans` | Create a loan for a borrower |
| GET | `/api/loans?borrowerId=&status=` | List my loans (optionally filtered) |
| GET | `/api/loans/overdue` | List only overdue loans |
| GET | `/api/loans/:id` | Get one loan's full financial summary + transactions |
| PUT | `/api/loans/:id` | Update editable loan fields |
| DELETE | `/api/loans/:id` | Delete a loan (blocked if repayments exist) |
| POST | `/api/loans/:id/repayments` | Record a repayment |

**Create loan** — `POST /api/loans`
```json
{
  "borrowerId": "64f0c2...",
  "principal": 20000,
  "interestType": "SIMPLE",
  "interestRate": 12,
  "ratePeriod": "YEARLY",
  "interestStartDate": "2026-08-12",
  "dueDate": "2027-02-12",
  "description": "Personal loan",
  "paymentAllocation": "INTEREST_FIRST"
}
```

Response includes a live-calculated summary:
```json
{
  "success": true,
  "message": "Loan created successfully",
  "loan": {
    "id": "...",
    "principal": 20000,
    "accruedInterest": 0,
    "totalDue": 20000,
    "totalPaid": 0,
    "remaining": 20000,
    "status": "ACTIVE",
    "...": "..."
  }
}
```

**Record a repayment** — `POST /api/loans/:id/repayments`
```json
{ "amount": 5000, "description": "First installment" }
```
Response:
```json
{
  "success": true,
  "message": "Repayment recorded successfully",
  "transaction": {
    "type": "REPAYMENT",
    "amount": 5000,
    "interestComponent": 1200,
    "principalComponent": 3800,
    "remainingBalanceAfter": 16200
  },
  "loan": { "remaining": 16200, "status": "ACTIVE", "...": "..." }
}
```

---

### Transactions (ledger)

| Method | Route | Description |
|---|---|---|
| GET | `/api/transactions?borrowerId=&loanId=&type=` | List transactions, optionally filtered |
| GET | `/api/transactions/:id` | Get one transaction |

---

### Dashboard

**`GET /api/dashboard`** returns:
```json
{
  "success": true,
  "totals": {
    "totalLent": 120000,
    "totalReceived": 45000,
    "totalOutstanding": 78500,
    "totalInterestAccrued": 3500
  },
  "counts": {
    "totalBorrowers": 8,
    "activeBorrowers": 5,
    "totalLoans": 10,
    "activeLoans": 6,
    "overdueLoans": 2
  },
  "recentLoans": [ "..." ],
  "recentRepayments": [ "..." ],
  "topOutstandingBorrowers": [
    { "borrower": { "name": "Rahul Verma", "phone": "..." }, "outstanding": 16200 }
  ]
}
```

---

## Error response format

All errors follow the same shape:
```json
{ "success": false, "message": "Loan not found" }
```

## Business rules enforced

- A borrower can have multiple independent loans; interest settings live on
  the loan, never on the borrower.
- Repayments never overwrite history — every repayment creates a permanent
  `Transaction` record, and loans track cumulative `principalPaid` /
  `interestPaid` instead of a single mutable balance.
- A loan is `PAID` once its remaining balance hits zero, and `OVERDUE` once
  its due date has passed while money is still owed.
- Every borrower/loan/transaction query is scoped to `req.lender._id` —
  lenders can only ever see their own data.
