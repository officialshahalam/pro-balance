# Pro-Balance: Financial Reporting App for CAs

## Context

A CA needs a tool to manage client financial data and generate Balance Sheet + P&L reports. Reports start as **Projected** (estimated figures) and get marked **Actual** at year-end. When finalized, closing values auto-carry-forward to the next FY's opening values.

**Current state:**
- Backend: Express.js + TypeScript + Prisma + PostgreSQL (only User model + signup exist)
- Frontend: Fresh Next.js 16 + Tailwind CSS (no pages/components yet)
- No login, no password hashing, no financial models

---

## Database Schema

### Enums

```
ReportType: BALANCE_SHEET | PROFIT_AND_LOSS
ReportStatus: PROJECTED | ACTUAL
ExpenseType: DIRECT | INDIRECT
```

### Models

**User** (existing — add `password_hash`, make `email @unique`, add `clients` relation)

**Client** — `user_id` (FK), `name`, `pan?`, `gstin?`, `phone?`, `email?`, `address?`, `firm_type?`

**FinancialYear** — `client_id` (FK), `label` ("2025-26"), `start_date`, `end_date`. Unique on `[client_id, label]`

**RevenueHead** — `financial_year_id` (FK), `name`, `amount` (Decimal 15,2), `sort_order`
- Dynamic heads: "Sales Revenue", "Service Income", etc.

**PurchaseInventory** — `financial_year_id` (FK, unique — one per FY), `opening_stock`, `purchases`, `closing_stock` (all Decimal 15,2)
- Opening stock linked from previous FY's closing stock via carry-forward

**ExpenseHead** — `financial_year_id` (FK), `name`, `amount` (Decimal 15,2), `type` (DIRECT/INDIRECT), `sort_order`
- Finance costs auto-computed from loans, not stored here

**FixedAsset** — `financial_year_id` (FK), `name`, `category`, `opening_wdv`, `additions`, `deletions`, `depreciation_rate` (Decimal 5,2), `sort_order`
- Computed at report time: `depreciation = (opening_wdv + additions - deletions) * rate / 100`
- Computed: `closing_wdv = opening_wdv + additions - deletions - depreciation`

**CapitalAccount** — `financial_year_id` (FK, unique — one per FY), `opening_balance`, `additions`, `drawings`
- Computed: `closing = opening + net_profit + additions - drawings`

**Loan** — `financial_year_id` (FK), `name`, `opening_balance`, `interest_rate`, `emi`, `tenure_months?`
- Computed: `interest_expense = opening_balance * rate / 100`
- Computed: `principal_repaid = (emi * 12) - interest_expense`
- Computed: `closing_balance = opening - principal_repaid`

**CurrentLiability** — `financial_year_id` (FK), `name`, `amount`, `sort_order`

**CurrentAsset** — `financial_year_id` (FK), `name`, `amount`, `sort_order`
- Cash, Bank, Sundry Debtors, etc. (needed for Balance Sheet asset side)

**Report** — `financial_year_id` (FK), `type` (enum), `status` (PROJECTED default), `snapshot` (Json), `generated_at`, `finalized_at?`

### Key relationships
```
User → Client (1:many)
Client → FinancialYear (1:many)
FinancialYear → RevenueHead, PurchaseInventory, ExpenseHead, FixedAsset, CapitalAccount, Loan, CurrentLiability, CurrentAsset, Report (1:many, except PurchaseInventory & CapitalAccount which are 1:1)
```

---

## Backend API

All endpoints under `/api/v1`, protected by `isAuthenticated`. Every service verifies ownership: `client.user_id = req.user.id`.

### Auth (modify existing)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/signup` | Register (add password hashing) |
| POST | `/auth/login` | Login, return JWT |
| POST | `/auth/logout` | Clear cookie |

### Clients
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/clients` | List / Create |
| GET/PATCH/DELETE | `/clients/:id` | Read / Update / Delete |

### Financial Years
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/clients/:clientId/financial-years` | List / Create (auto-populate opening values from previous ACTUAL FY) |
| GET/PATCH/DELETE | `/financial-years/:fyId` | Read / Update / Delete |

### Financial Data (all under `/financial-years/:fyId/`)
| Resource | Endpoints |
|----------|-----------|
| `/revenue` | GET (list), POST (create), PATCH `/:id`, DELETE `/:id`, PATCH `/reorder` |
| `/purchases` | GET, PUT (upsert — single record per FY) |
| `/expenses` | GET `?type=DIRECT\|INDIRECT`, POST, PATCH `/:id`, DELETE `/:id` |
| `/fixed-assets` | GET, POST, PATCH `/:id`, DELETE `/:id` |
| `/capital` | GET, PUT (upsert — single record per FY) |
| `/loans` | GET, POST, PATCH `/:id`, DELETE `/:id` |
| `/current-liabilities` | GET, POST, PATCH `/:id`, DELETE `/:id` |
| `/current-assets` | GET, POST, PATCH `/:id`, DELETE `/:id` |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| GET | `/financial-years/:fyId/reports` | List reports |
| GET | `/reports/:id` | Get report with snapshot |
| POST | `/financial-years/:fyId/reports/generate` | Generate report `{ type }` → status=PROJECTED |
| PATCH | `/reports/:id/finalize` | Re-compute, set ACTUAL, trigger carry-forward |

### Export
| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports/:id/export/pdf` | Download PDF |
| GET | `/reports/:id/export/xlsx` | Download XLSX |

### Backend modules structure
```
src/modules/
  auth/           (modify existing)
  client/         (new)
  financial-year/ (new)
  revenue/        (new)
  purchase/       (new)
  expense/        (new)
  fixed-asset/    (new)
  liability/      (new — capital, loans, current liabilities)
  current-asset/  (new)
  report/         (new — generation, finalization, carry-forward)
  export/         (new — PDF + XLSX)
```

---

## Report Generation Logic

### P&L Computation

```
REVENUE
  [Revenue heads with amounts]
  Total Revenue

COST OF GOODS SOLD
  Opening Stock
  + Purchases
  - Closing Stock
  = COGS

GROSS PROFIT = Total Revenue - COGS

EXPENSES
  Direct Expenses: [list + total]
  Indirect Expenses: [list + total]
  Depreciation: [sum from FA register]
  Finance Costs: [sum of loan interest_expense]
  Total Expenses

NET PROFIT/LOSS = Gross Profit - Total Expenses
```

### Balance Sheet Computation (Two-sided)

```
LIABILITIES SIDE                    ASSETS SIDE
─────────────────                   ─────────────────
Capital Account:                    Fixed Assets:
  Opening                            [Each asset at closing WDV]
  + Net Profit (from P&L)            Total Fixed Assets
  + Additions
  - Drawings                       Current Assets:
  = Closing Capital                   Closing Stock
                                      [Other current assets]
Loans:                                Total Current Assets
  [Each loan closing balance]
  Total Loans

Current Liabilities:
  [List]
  Total Current Liabilities

TOTAL LIABILITIES                   TOTAL ASSETS
```

### Finalize + Carry-Forward

When `PATCH /reports/:id/finalize`:
1. Re-compute snapshot with current data
2. Set `status=ACTUAL`, `finalized_at=now()`
3. Check if next FY exists for this client → if not, create it
4. Populate next FY opening values:
   - `PurchaseInventory.opening_stock` ← this FY's `closing_stock`
   - Each `FixedAsset.opening_wdv` ← this FY's computed `closing_wdv`
   - `CapitalAccount.opening_balance` ← this FY's computed closing capital
   - Each `Loan.opening_balance` ← this FY's computed `closing_balance`

---

## Frontend (Next.js)

### Dependencies to add
- `shadcn/ui` — UI components (Button, Card, Table, Dialog, Sheet, Tabs, Form, Input, Select, Badge)
- `react-hook-form` + `@hookform/resolvers` + `zod` — form validation
- `@tanstack/react-query` — server state management (data fetching, caching, mutations, optimistic updates)
- `zustand` — client state management (auth state, active client/FY context, UI state)
- `axios` — HTTP client (used inside TanStack Query functions)
- `lucide-react` — icons
- `sonner` — toast notifications

### State management architecture

**Zustand stores** (`src/stores/`):
- `auth-store.ts` — user session, token, isAuthenticated flag, login/logout actions
- `workspace-store.ts` — active client ID, active FY ID, sidebar collapse state

**TanStack Query** (`src/hooks/`):
- All server data flows through query hooks — no raw axios calls in components
- Query keys scoped by resource: `['clients']`, `['financial-years', clientId]`, `['revenue', fyId]`, etc.
- Mutation hooks with `onSuccess` → `queryClient.invalidateQueries()` for auto-refetch
- Optimistic updates on inline edits (revenue heads, expenses, etc.)

```
src/hooks/
  use-auth.ts           — useLogin, useSignup, useLogout, useMe queries/mutations
  use-clients.ts        — useClients, useClient, useCreateClient, useUpdateClient, useDeleteClient
  use-financial-years.ts
  use-revenue.ts        — useRevenue, useCreateRevenue, useUpdateRevenue, useDeleteRevenue, useReorderRevenue
  use-purchases.ts
  use-expenses.ts
  use-fixed-assets.ts
  use-liabilities.ts    — useCapital, useLoans, useCurrentLiabilities + mutations
  use-current-assets.ts
  use-reports.ts        — useReports, useReport, useGenerateReport, useFinalizeReport
```

### Report view/edit — spreadsheet-like experience

Reports render as **editable grid tables** resembling Excel/Google Sheets:
- Each amount cell is an `<input type="number">` styled to look like a spreadsheet cell
- Cells highlight on focus (blue border), tab-navigation between cells
- **Live recalculation**: when any value changes, totals (subtotals, COGS, Gross Profit, Net Profit, Total Assets, Total Liabilities) recompute instantly via local state — no API call until save
- **Balance check**: if Total Assets ≠ Total Liabilities, show a prominent warning bar:
  `⚠ Mismatch: Assets (₹X) ≠ Liabilities (₹Y) — Difference: ₹Z`
- Changes tracked in local state → "Save Changes" button persists to API via mutation
- Cell formatting: Indian number format (₹ 12,34,567.00), right-aligned amounts
- Row actions: add row, delete row (with confirmation), drag-to-reorder
- Frozen header row and label column for scrollable reports
- Print-friendly: editable cells render as plain text in `@media print`

**Implementation approach**: Custom editable table component (not a heavy spreadsheet library). Each row is a React component with controlled inputs. Totals computed via `useMemo` from the row data array. This keeps it lightweight and styled consistently with the rest of the app.

### Theme — professional, muted

Design language: **Clean accounting software** (think Tally/QuickBooks, not a SaaS marketing dashboard)
- **Colors**: Neutral grays, slate backgrounds, minimal accent color (single muted blue or indigo for interactive elements)
- **No bright colors** except semantic: red for errors/warnings, green for ACTUAL badge, amber for PROJECTED badge
- **Typography**: System font stack, clear hierarchy — larger bold headings, medium body, monospace for numbers
- **Tables**: Thin borders, alternating subtle row backgrounds (white/gray-50), compact row height
- **Cards**: Minimal shadow, thin border, no rounded corners larger than 6px
- **Sidebar**: Light gray background (#f8f9fa), dark text, active item with left border accent
- **Overall**: High information density, minimal whitespace waste — CAs need to see data, not decoration

shadcn/ui theme overrides in `globals.css`:
```
--background: 0 0% 100%        (white)
--foreground: 222 47% 11%      (near-black)
--card: 0 0% 100%
--muted: 210 40% 96%           (light slate)
--primary: 221 83% 53%         (muted blue — single accent)
--border: 214 32% 91%          (subtle gray border)
--radius: 0.375rem             (6px — not too rounded)
```

### Page structure
```
src/app/
  login/page.tsx
  signup/page.tsx
  (dashboard)/
    layout.tsx                          — Sidebar + topbar + auth guard
    clients/
      page.tsx                          — Client list (cards)
      new/page.tsx                      — Create client
      [clientId]/
        page.tsx                        — Client overview + FY list
        financial-years/
          new/page.tsx                  — Create FY
          [fyId]/
            layout.tsx                  — Financial workspace sidebar (Revenue, Purchases, etc.)
            page.tsx                    — Dashboard: summary cards (Revenue, Expenses, Assets, Liabilities, Net Profit, Net Worth)
            revenue/page.tsx            — Inline-editable revenue heads table
            purchases/page.tsx          — Opening stock, Purchases, Closing stock form
            expenses/page.tsx           — Expense heads table with Direct/Indirect tabs
            fixed-assets/page.tsx       — FA Register table with WDV columns
            liabilities/page.tsx        — Capital A/c form + Loans table + Current liabilities table
            current-assets/page.tsx     — Current assets table
            assumptions/page.tsx        — Edit depreciation rates on fixed assets
            reports/
              page.tsx                  — Report list + Generate button
              [reportId]/page.tsx       — Spreadsheet-like report view/edit with live recalculation
```

### Sidebar structure (financial workspace)
```
Dashboard            — Summary cards with key metrics
Financial Data ▾     — Collapsible
  Revenue            — Dynamic heads, inline edit
  Purchases          — Opening stock, Purchases, Closing stock
  Expenses           — Direct + Indirect tabs
  Fixed Assets       — FA Register with WDV
  Liabilities        — Capital + Loans + Current liabilities
  Current Assets     — Cash, Bank, Debtors etc.
Assumptions          — Depreciation rates (P0)
Reports ▾            — Collapsible
  Profit & Loss      — Generate / View
  Balance Sheet      — Generate / View
Export               — PDF + XLS download
```

### API layer
```
src/lib/
  api.ts              — Axios instance (baseURL, cookie credentials, 401 redirect interceptor)
  api-client/         — Raw API functions (used by TanStack Query hooks, NOT called directly by components)
    auth.ts
    clients.ts
    financial-years.ts
    revenue.ts
    purchases.ts
    expenses.ts
    fixed-assets.ts
    liabilities.ts
    current-assets.ts
    reports.ts
    export.ts

src/hooks/            — TanStack Query hooks (components use ONLY these)
src/stores/           — Zustand stores (auth, workspace)
```

---

## Export (PDF + XLS)

### Backend approach (server-side generation)
- **PDF**: Use `pdfkit` to generate formatted P&L and Balance Sheet PDFs with CA branding (firm name, registration, logo placeholder)
- **XLSX**: Use `exceljs` to generate spreadsheets with proper formatting, formulas, and sheets for each report type
- New dependencies: `pdfkit`, `exceljs`
- Reports served as file downloads from `/reports/:id/export/pdf` and `/reports/:id/export/xlsx`

---

## Implementation Phases

### Phase 1: Auth + Schema (~1 day)
- Fix error handler bugs (swapped 401/403, DatabaseError→500, class name typo)
- Add `password_hash` to User, make email `@unique`
- Add all new Prisma models + enums
- Run migration
- Add bcryptjs, implement login/logout
- Add `POST /login`, `POST /logout` routes
- Install bcryptjs: `pnpm add bcryptjs && pnpm add -D @types/bcryptjs`

### Phase 2: Client + FY CRUD (~1 day)
- Client module (service + controller)
- Financial Year module (service + controller)
- Register routes in main.ts
- Ownership verification on all queries

### Phase 3: Financial Data APIs (~2 days)
- Revenue, Purchase/Inventory, Expense, Fixed Asset, Liability (capital + loans + current), Current Asset modules
- All CRUD endpoints with validation
- Reorder endpoint for sortable items

### Phase 4: Report Generation (~1-2 days)
- P&L computation logic
- Balance Sheet computation (two-sided)
- JSON snapshot storage
- Finalize endpoint with carry-forward logic

### Phase 5: Frontend - Setup, Auth + Layout (~1-2 days)
- Install: shadcn/ui, react-hook-form, @hookform/resolvers, zod, @tanstack/react-query, zustand, axios, lucide-react, sonner
- Configure professional theme (muted grays, single blue accent, compact tables)
- Set up TanStack Query provider + Axios instance with interceptors
- Create Zustand stores (auth-store, workspace-store)
- API client layer (src/lib/api-client/) — raw fetch functions
- TanStack Query hooks (src/hooks/) — all data access through these
- Login/Signup pages
- Dashboard layout with sidebar + topbar + auth guard
- Client list + CRUD pages

### Phase 6: Frontend - Financial Workspace (~3 days)
- FY workspace layout with financial sidebar (collapsible sections)
- Dashboard page with summary cards (Revenue, Expenses, Assets, Liabilities, Net Profit, Net Worth)
- Revenue page (inline-editable table, add/delete/reorder rows)
- Purchases page (Opening stock, Purchases, Closing stock form)
- Expenses page (Direct/Indirect tabs, inline-editable)
- Fixed Assets page (FA Register table — WDV columns auto-computed as user types)
- Liabilities page (Capital A/c form + Loans table + Current liabilities)
- Current Assets page
- Assumptions page (depreciation rate editor for each fixed asset)

### Phase 7: Frontend - Spreadsheet Reports + Export (~2-3 days)
- Editable report grid component (custom, not a heavy lib):
  - Input cells styled as spreadsheet (blue border on focus, tab navigation)
  - Live recalculation of totals/subtotals via useMemo
  - Indian number formatting (₹ 12,34,567.00)
  - Frozen headers, right-aligned amounts
  - Add/delete/reorder rows
- P&L report view (Trading Account → Gross Profit → Net Profit)
- Balance Sheet report view (two-sided: Liabilities | Assets)
- **Balance mismatch warning**: if Total Assets ≠ Total Liabilities → show prominent alert with difference
- "Save Changes" button to persist edits via mutation
- Generate report button (→ PROJECTED)
- Finalize button with confirmation (→ ACTUAL)
- Status badges: PROJECTED (amber), ACTUAL (green)
- Export buttons (PDF + XLSX — triggers backend download)
- Print-friendly CSS (@media print: inputs → plain text)

### Phase 8: Backend Export (~1 day)
- Install pdfkit, exceljs
- PDF generation for P&L and Balance Sheet with CA branding
- XLSX generation with formatted sheets
- File download endpoints

---

## Verification

1. Sign up → Login
2. Create client (name, PAN, firm type)
3. Create FY 2025-26
4. Add revenue heads, purchases/inventory, expenses, fixed assets with depreciation rates, capital account, loans, current liabilities, current assets
5. View dashboard summary cards
6. Generate Projected P&L → verify COGS, depreciation, finance costs computed correctly
7. Generate Projected Balance Sheet → verify two-sided format, WDV, capital closing
8. Edit data with actual numbers
9. Finalize reports → verify status=ACTUAL, snapshot updated
10. Verify carry-forward: next FY 2026-27 created with opening values populated
11. Export PDF + XLSX → verify formatting and CA branding
12. View finalized reports in clean, print-friendly layout

---

## Files to modify (existing)
- [schema.prisma](backend-setup/prisma/schema.prisma) — add all models
- [auth.service.ts](backend-setup/src/modules/auth/auth.service.ts) — password hashing + login
- [auth.controller.ts](backend-setup/src/modules/auth/auth.controller.ts) — login/logout routes
- [isAuthenticated.ts](backend-setup/src/packages/middlewares/isAuthenticated.ts) — simplify
- [error-handler/index.ts](backend-setup/src/packages/error-handler/index.ts) — fix status codes
- [main.ts](backend-setup/src/main.ts) — register all new routes, update CORS
- [package.json](backend-setup/package.json) — add bcryptjs, pdfkit, exceljs

## New files (backend)
- `src/modules/client/` — service + controller
- `src/modules/financial-year/` — service + controller
- `src/modules/revenue/` — service + controller
- `src/modules/purchase/` — service + controller
- `src/modules/expense/` — service + controller
- `src/modules/fixed-asset/` — service + controller
- `src/modules/liability/` — service + controller (capital + loans + current liabilities)
- `src/modules/current-asset/` — service + controller
- `src/modules/report/` — service + controller (generation + finalize + carry-forward)
- `src/modules/export/` — service + controller (PDF + XLSX)

## New files (frontend)
- All pages under `src/app/` as listed in the page structure above
- `src/lib/api.ts` — Axios instance
- `src/lib/api-client/` — Raw API functions per resource (auth, clients, revenue, etc.)
- `src/hooks/` — TanStack Query hooks per resource (useClients, useRevenue, useReports, etc.)
- `src/stores/auth-store.ts` — Zustand auth state
- `src/stores/workspace-store.ts` — Zustand active client/FY/sidebar state
- `src/components/layout/` — sidebar, topbar, auth-guard, financial-sidebar
- `src/components/ui/` — shadcn/ui primitives
- `src/components/reports/editable-grid.tsx` — core spreadsheet-like table component
- `src/components/reports/balance-sheet-view.tsx` — two-sided BS with mismatch warning
- `src/components/reports/pnl-view.tsx` — P&L with Trading Account
- `src/components/reports/report-toolbar.tsx` — Generate, Finalize, Export buttons
- `src/components/financial/` — revenue-table, expense-table, fa-register, loan-table, etc.
- `src/providers/query-provider.tsx` — TanStack QueryClientProvider wrapper
