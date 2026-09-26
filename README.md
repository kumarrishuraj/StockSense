# StockSense: Modular Inventory Management

StockSense replaces paper registers and scattered spreadsheets with one inventory system for **inventory managers** and **warehouse staff**. It tracks stock per product **and location** across multiple warehouses. It runs receipts, delivery orders, internal transfers and inventory adjustments through a single stock engine, and every quantity it moves is recorded in a searchable ledger.

Built for the **Odoo × LPU Jalandhar Hackathon 2026**.

---

## Contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Architecture](#architecture)
4. [Folder structure](#folder-structure)
5. [Quick start](#quick-start)
6. [Backend setup](#backend-setup)
7. [Frontend setup](#frontend-setup)
8. [Environment variables](#environment-variables)
9. [Database and demo data](#database-and-demo-data)
10. [Demo credentials](#demo-credentials)
11. [API overview](#api-overview)
12. [Demo workflow](#demo-workflow)
13. [Testing](#testing)
14. [Team and branches](#team-and-branches)
15. [Known limitations](#known-limitations)

---

## Features

| Area | What you can do |
|---|---|
| **Authentication** | Sign up (Inventory Manager / Warehouse Staff), log in, log out, forgot password → 6-digit OTP → reset password, change password, edit profile. JWT sessions; passwords hashed with bcrypt. Changing or resetting a password signs out older sessions. |
| **Dashboard** | Live KPIs: total products, low stock, out of stock, pending receipts, pending deliveries, internal transfers. Filters: document type, status, warehouse, location, category. Recent operations with tabs, low-stock list with one-click "receive more", stock summary by status/warehouse/category, and a 14-day activity chart (with a table view). |
| **Products** | Create, edit, delete (unused) or deactivate (has history). Unique SKU (case-insensitive). Category, unit of measure, reorder level, description, optional initial stock at a chosen location. Search by name/SKU; filter by category, warehouse, location and stock status. Product page shows stock by location and recent movements. |
| **Categories** | Create, rename, delete. Deletion is refused while products still use the category. |
| **Warehouses & locations** | Multiple warehouses, each with any number of locations (e.g. Main Store, Production Rack, Dispatch). Create, edit, delete when unused. Stock per warehouse and per location. |
| **Receipts** | Supplier, reference (auto `MAIN/IN/00001` or your own), warehouse, destination location, date, product lines. **Draft → Validate**: validating increases stock. |
| **Delivery orders** | Customer, source location, product lines. **Draft → Pick → Pack → Validate**: picking checks availability, validating decreases stock. You can't deliver more than is on the shelf. |
| **Internal transfers** | Source warehouse/location → destination warehouse/location. Validating moves the stock; **total stock is unchanged**. |
| **Inventory adjustments** | Product + location, system quantity shown live, counted quantity, **difference = counted − system** calculated automatically, reason, date. Save as draft or apply immediately. |
| **Move history (stock ledger)** | Every validated movement: date, product, SKU, operation, reference, from, to, quantity (+/−), user, status. Search, filter (operation, product, warehouse, location, date range), sort, paginate, export CSV. |
| **Alerts & search** | Low-stock and out-of-stock badges everywhere (always icon + label, not colour alone). Notification menu with stock alerts and open work. Global search (press `/`) across products, SKUs and document references. |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, lucide-react icons, hand-written CSS design system (no UI framework) |
| Backend | Python 3.10+ (tested on 3.13), FastAPI, SQLAlchemy 2.0, Pydantic 2 |
| Database | SQLite (file `backend/stocksense.db`, created automatically) |
| Auth | JWT (PyJWT, HS256), bcrypt password hashing, OTP stored as an HMAC hash |
| Tests | pytest + FastAPI TestClient (57 backend tests) |

---

## Architecture

```
 Browser (React SPA)                                    FastAPI (backend/app)
┌──────────────────────────────┐   /api/*  (Vite proxy)  ┌───────────────────────────────────┐
│ pages/  → components/        │ ──────────────────────▶ │ routers/     HTTP + validation    │
│ services/api.js (fetch, JWT) │ ◀────────────────────── │ services/                         │
│ context/ (auth, toasts,      │         JSON            │   operations_service  workflows   │
│          reference data)     │                         │   stock_service  ◀── the ONLY     │
└──────────────────────────────┘                         │                      code that    │
                                                         │                      changes stock│
                                                         │   dashboard_service  KPIs         │
                                                         │   auth_service  JWT/bcrypt/OTP    │
                                                         │ models.py  (SQLAlchemy)           │
                                                         └───────────────┬───────────────────┘
                                                                         ▼
                                                                  SQLite database
```

### The stock engine (`backend/app/services/stock_service.py`)

All inventory changes go through one module: `increase_stock`, `decrease_stock`, `transfer_stock`, `adjust_stock`, `ensure_available`, plus read helpers such as `product_totals` and `stock_status`. Each call updates the `stock` row for **product + location** and appends a `stock_movements` ledger row. The frontend never calculates stock itself.

Consistency guarantees:

- **One transaction per operation.** Routers commit once at the end. If any line of a receipt, delivery, transfer or adjustment fails, nothing is saved: no stock change, no ledger row, no status change.
- **No negative stock.** Decreases run as `UPDATE … WHERE quantity >= requested`, so two people can't spend the same stock at once. A database `CHECK (quantity >= 0)` constraint backs this up.
- **No double validation.** Status changes are an atomic "claim" (`UPDATE … WHERE status = 'draft'`), so a document validated twice at the same moment changes stock only once.
- Quantities are stored with 3 decimals, so 0.1 + 0.2 + 0.3 is exactly 0.6.

Low stock means `on hand ≤ reorder level`; out of stock means `on hand = 0`.

These guarantees were checked against the running server: 10 parallel validations of one receipt resulted in 1 success and 9 × 409. Five parallel 30-unit deliveries against 100 in stock resulted in 3 successes and 2 refusals, with a final stock of 10.

### Data model

`users`, `password_reset_otps`, `categories`, `products`, `warehouses`, `locations`, `stock` (product × location), `receipts` + `receipt_items`, `deliveries` + `delivery_items`, `transfers` + `transfer_items`, `inventory_adjustments`, `stock_movements` (the ledger).

---

## Folder structure

```
StockSense/
├── backend/
│   ├── app/
│   │   ├── main.py            app, routers, error handlers, startup (create tables, auto-seed)
│   │   ├── config.py          environment settings
│   │   ├── database.py        engine, session, get_db
│   │   ├── models.py          SQLAlchemy models
│   │   ├── schemas.py         Pydantic request/response models + validation
│   │   ├── serializers.py     ORM → response models
│   │   ├── seed.py            demo data (python -m app.seed)
│   │   ├── routers/           auth, products, categories, warehouses (+locations), inventory
│   │   │                      (+stock-movements), receipts, deliveries, transfers, adjustments, dashboard (+search)
│   │   └── services/          stock_service, operations_service, dashboard_service, auth_service
│   ├── tests/                 pytest suite
│   ├── requirements.txt
│   └── .env.example
├── src/
│   ├── components/
│   │   ├── common/            Button, Modal, Table, Badge, Alert, Field, Pagination, …
│   │   ├── layout/            Layout, Sidebar, Navbar, GlobalSearch, NotificationsMenu, route guards
│   │   ├── dashboard/         StatCard, FilterBar, RecentOperations, LowStockList, StockHealth, ActivityChart
│   │   ├── operations/        OperationList, OperationDetail, LineItemsEditor, LocationPicker, StatusSteps
│   │   └── products/          ProductForm, ProductSearch
│   ├── pages/                 auth, dashboard, products, categories, warehouses, receipts, deliveries,
│   │                          transfers, adjustments, move-history, profile, settings
│   ├── services/              api.js + one service per API area
│   ├── context/ hooks/ utils/
│   ├── App.jsx                routes
│   └── main.jsx
├── vite.config.js             dev/preview proxy: /api → backend
├── .env.example               frontend settings
└── package.json
```

---

## Quick start

Prerequisites: **Python 3.10+** and **Node.js 20.19+ or 22.12+** (required by Vite 8). Use two terminals.

```bash
# Terminal 1 (backend)
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2 (frontend, from the repository root)
npm install
npm run dev
```

Open **http://localhost:5173** and log in with `admin@stocksense.io` / `Demo@1234`.

On the first start the backend creates `backend/stocksense.db` and loads the demo data.

| URL | What |
|---|---|
| http://localhost:5173 | Frontend |
| http://localhost:8000 | API |
| http://localhost:8000/docs | Interactive API docs (Swagger). Click **Authorize** and paste a token from `/auth/login`. |

---

## Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate                       # Windows PowerShell/cmd
# source .venv/bin/activate                  # macOS / Linux
pip install -r requirements.txt
copy .env.example .env                       # optional (macOS/Linux: cp); defaults work locally
uvicorn app.main:app --reload --port 8000
```

On Windows, if PowerShell blocks `activate`, run `Set-ExecutionPolicy -Scope Process RemoteSigned` first. You can also skip activation and call `.venv\Scripts\python -m uvicorn app.main:app --reload`.

## Frontend setup

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to http://127.0.0.1:8000
npm run build      # production build in dist/
npm run preview    # serve dist/ (same /api proxy)
npm run lint
```

---

## Environment variables

No environment variables are required for local development. Copy an `.env.example` only if you need to change something, and never commit a real `.env`.

**Backend (`backend/.env`)**, see `backend/.env.example`:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | SQLite file `backend/stocksense.db` | SQLAlchemy URL |
| `JWT_SECRET` | insecure dev placeholder (a warning is logged) | **Set for any shared deployment.** `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `720` | Session length |
| `OTP_EXPIRE_MINUTES` / `OTP_MAX_ATTEMPTS` | `10` / `5` | Password-reset code lifetime and allowed wrong attempts |
| `OTP_DEV_MODE` | `true` | Show the OTP in the app and server log (see [Known limitations](#known-limitations)) |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Only needed when the browser calls the API directly |
| `AUTO_SEED` | `true` | Load demo data on startup when the database has no users |

**Frontend (`.env.local`)**, see `.env.example`:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `/api` | API base URL used by the browser |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:8000` | Where the Vite proxy forwards `/api` |

---

## Database and demo data

Tables are created automatically at startup, so no migration step is needed.

```bash
cd backend
python -m app.seed           # seed an empty database
python -m app.seed --reset   # wipe everything and reload the demo data (stop the server first)
```

The demo data is created by running real receipts, transfers, deliveries and adjustments through the stock engine, so the ledger always matches stock:

- **Categories:** Raw Materials, Finished Goods, Components, Packaging
- **Warehouses:** Main Warehouse `MAIN` (Main Store, Production Rack, Dispatch) and North Distribution Center `NDC` (Main Store, Finished Goods)
- **Products (9):** Steel Sheet, Aluminum Rod, Copper Wire, Motor Assembly, Packaging Box, Ball Bearing 6204, Water Pump Unit, Packing Tape, Hydraulic Seal Kit
- **Two weeks of history:** 4 receipts, 2 transfers, 2 deliveries, 1 adjustment (14 ledger entries)
- **Open work:** 2 draft receipts, 1 draft and 1 picked delivery, 1 draft transfer, 1 draft adjustment
- **Starting dashboard:** 9 products, 2 low stock (Water Pump Unit, Packaging Box), 2 out of stock (Steel Sheet, Hydraulic Seal Kit)

**Steel Sheet deliberately starts at 0 kg** so the demo below begins from an empty shelf.

---

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Inventory Manager | `admin@stocksense.io` | `Demo@1234` |
| Warehouse Staff | `staff@stocksense.io` | `Demo@1234` |

The login page also has a **Use demo** button that fills these in.

---

## API overview

Every endpoint except `/auth/signup`, `/auth/login`, `/auth/forgot-password`, `/auth/verify-otp`, `/auth/reset-password`, `/` and `/health` needs `Authorization: Bearer <token>`. Errors come back as `{"detail": "human readable message"}`. Validation errors (422) also include a field list.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/signup`, `POST /auth/login`, `GET/PUT /auth/me`, `POST /auth/change-password`, `POST /auth/forgot-password`, `POST /auth/verify-otp`, `POST /auth/reset-password` |
| Products | `GET/POST /products`, `GET/PUT/DELETE /products/{id}` (filters: `search`, `category_id`, `warehouse_id`, `location_id`, `stock_status`, `include_inactive`) |
| Categories | `GET/POST /categories`, `PUT/DELETE /categories/{id}` |
| Warehouses | `GET/POST /warehouses`, `GET/PUT/DELETE /warehouses/{id}` |
| Locations | `GET/POST /locations`, `GET/PUT/DELETE /locations/{id}` |
| Inventory | `GET /inventory` (stock per product × location), `GET /inventory/{product_id}` |
| Ledger | `GET /stock-movements` (`search`, `operation`, `product_id`, `warehouse_id`, `location_id`, `date_from`, `date_to`, `sort`, `order`, `page`, `page_size`) |
| Receipts | `GET/POST /receipts`, `GET /receipts/{id}`, `POST /receipts/{id}/validate`, `POST /receipts/{id}/cancel` |
| Deliveries | `GET/POST /deliveries`, `GET /deliveries/{id}`, `POST /deliveries/{id}/pick`, `/pack`, `/validate`, `/cancel` |
| Transfers | `GET/POST /transfers`, `GET /transfers/{id}`, `POST /transfers/{id}/validate`, `/cancel` |
| Adjustments | `GET/POST /adjustments`, `GET /adjustments/{id}`, `POST /adjustments/{id}/validate`, `/cancel` |
| Dashboard | `GET /dashboard/stats`, `/recent-operations`, `/low-stock`, `/stock-summary`, `/activity`, and `GET /search?q=` |

Document lists accept `status` (`draft`, `picked`, `packed`, `done`, `cancelled`, or `pending` for any open status), `warehouse_id`, `location_id`, `product_id`, `category_id`, `search`, `date_from`, `date_to`.

Status codes: `201` created, `400` business rule (e.g. insufficient stock), `401` not logged in, `404` not found, `409` conflict (duplicate SKU/reference, already validated), `422` invalid input.

---

## Demo workflow

This is the scenario the app is built and tested around. It needs no database editing.

| Step | Where | Action | Result |
|---|---|---|---|
| 1 | Login | **Use demo** → Log in | Dashboard |
| 2 | Dashboard | Check KPIs | 9 products · 2 low · **2 out of stock** (Steel Sheet 0 kg) |
| 3–4 | Dashboard → **Receive goods** | Supplier *Tata Steel*, Main Warehouse / Main Store, Steel Sheet **100 kg** → *Create draft receipt* → **Validate receipt** | Steel Sheet = **100 kg** |
| 5 | Operations → Internal Transfers → *New transfer* | Main Store → Production Rack, Steel Sheet **30 kg** → **Validate transfer** | Main Store **70**, Production Rack **30**, total **100** |
| 6–7 | Operations → Delivery Orders → *New delivery* | Customer *Kirloskar Pumps*, source Production Rack, Steel Sheet **20 kg** → **Pick** → **Pack** → **Validate** | Production Rack **10 kg** |
| 8 | Operations → Inventory Adjustments → *New adjustment* | Main Warehouse / Production Rack, Steel Sheet: system **10**, counted **7** → difference **−3** → **Apply adjustment** | Production Rack **7 kg** (total 77 kg) |
| 9 | Operations → Move History | Search `RM-STL-001` | Receipt +100, Transfer 30, Delivery −20, Adjustment −3 |

Extra things worth showing: try delivering 50 kg from the Production Rack (a clear "Insufficient stock… available 7 kg" message appears), the low-stock notification bell, global search (`/`), and forgot password with the on-screen development OTP.

To run the demo again: stop the backend, run `python -m app.seed --reset`, and start it again.

---

## Testing

### Backend: 57 automated tests

```bash
cd backend
.venv\Scripts\python -m pytest -q
```

Tests run against a throwaway database. They cover:

- **auth:** signup, login, bad credentials, protected routes, the OTP flow including attempt limits and single use, token revocation after a password change
- **products:** CRUD, duplicate SKU, initial stock through the ledger, delete vs deactivate, search and filters, stock status thresholds
- **categories, warehouses and locations:** CRUD and safe-delete rules
- **the full demo scenario**
- **stock rules:** receipts increase stock, deliveries decrease it, transfers keep the total, adjustments set the counted value
- **refusals:** negative stock, invalid quantities, double validation, out-of-order delivery steps, cancelled documents
- **atomicity:** a multi-line operation where one line fails changes nothing
- **dashboard:** statistics, ledger filtering, sorting and pagination
- **seed data:** every stock row equals the sum of its ledger movements

### Frontend

```bash
npm run lint
npm run build
```

The UI was also exercised end-to-end in a real browser (headless Microsoft Edge via Playwright, not committed). The run covered the full demo workflow above, the error cases, login/logout, signup, the forgot-password OTP flow, product/category/warehouse/location management, dashboard filters, CSV export, profile and password change, settings, and a 390 px phone layout with no horizontal scrolling.

---

## Team and branches

`main` is the shared integration branch. Work was split into feature branches:

| Branch | Area |
|---|---|
| `backend` | FastAPI skeleton: database config, first models, stock calculation service |
| `dashboard` | React/Vite app structure and dashboard layout |
| `auth-products` | Login/signup, product and warehouse pages |
| `inventory` | Receipt, delivery, transfer, adjustment and move-history pages |
| `integration` | All of the above merged (history preserved) and completed into the working system described here |

Workflow: `git fetch origin && git merge origin/main` before starting, commit meaningful steps, push your own branch, and open a pull request into `main`.

Note for branch owners: the `auth-products` and `inventory` pages lived under `frontend/`, which was outside the Vite app, so they were moved into `src/pages/...` on `integration`. Merge `integration` (or `main`, once it has been merged there) into your branch before continuing work.

---

## Known limitations

- **No email/SMS provider is connected.** With `OTP_DEV_MODE=true` (the default), the password-reset code is shown on the verification screen and printed in the backend log. To send real codes, implement `deliver_otp` in `backend/app/services/auth_service.py` and set `OTP_DEV_MODE=false`.
- Roles (manager/staff) are stored and displayed, but all logged-in users currently have the same permissions.
- There is no stock reservation: picking a delivery checks availability but doesn't hold the stock. Validation re-checks, so stock can never go negative.
- There are no database migrations (Alembic). After a schema change, reset the development database with `python -m app.seed --reset`.
- Quantities are shown per unit of measure. There is no unit conversion (e.g. kg ↔ g) and no stock valuation (prices).
