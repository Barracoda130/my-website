# Active Context

## Current Work Focus
The Budget Tracker foundation MVP has been implemented. The project now has a working personal budgeting module with backend models/API and a single-page frontend MVP. Family Finances remains an empty stub waiting to be built out.

## Recent Changes
- Memory Bank initialised (all core files created) — 2026-06-22
- Budget Tracker foundation MVP implemented — 2026-06-22
  - Added backend models/admin/API for category groups, categories, accounts, transactions, monthly budgets, and recurring items
  - Added `/api/budget/summary/` and `/api/budget/bootstrap-defaults/`
  - Added `frontend/src/api/budget.js`
  - Replaced `BudgetTracker.jsx` stub with a usable MVP page
  - Created and applied `budget_tracker.0001_initial` migration
  - Verified `python manage.py check`, `npm run lint`, and `npm run build`
- Budget Tracker UX/validation tweaks — 2026-06-23
  - Transaction descriptions made optional end-to-end
  - Added `budget_tracker.0002_alter_transaction_description` migration and applied it
  - Improved button cursor/hover affordances on Dashboard and Budget Tracker pages
  - Verified backend checks plus frontend lint/build
- Backend security test suite added — 2026-06-23
  - Added pytest/pytest-django configuration for backend tests
  - Added `config.test_settings` using an in-memory SQLite test database
  - Added Budget Tracker API security tests for authentication, module access, per-user object isolation, and cross-user foreign-key validation
  - Added auth/current-user endpoint privacy tests
  - Verified `cd backend; pytest` passes and automatically loads `config.test_settings`
- Budget Tracker frontend split — 2026-06-23
  - Moved Budget Tracker pages into `frontend/src/pages/modules/budget/`
  - Replaced the single mixed-purpose `BudgetTracker.jsx` page with a view-only `BudgetDashboard.jsx` and a focused `BudgetManage.jsx`
  - Added `useBudgetData.js` for shared Budget Tracker data loading and `helpers.js` for shared formatting/defaults
  - Added `/budget/manage` route protected by the existing Budget Tracker module guard
  - Management page uses section navigation (`transactions`, `budgets`, `setup`, `recurring`) via query params so users see fewer controls at once
  - Updated ESLint ignores to exclude Vite's generated `.vite` cache
  - Verified `cd frontend; npm run lint; npm run build`
- Budget Tracker UX polish — 2026-06-23
  - Monthly budget items now clearly highlight overbudget categories with red styling, an overbudget label, and over amount
  - Recurring items now display relative due status such as `due today`, `in 5 days`, or overdue text
  - Recurring item form now labels `next_due_date` as `First payment date` and exposes a clear `Frequency` field
  - Budget manage actions now show inline green success feedback directly underneath the button/action the user pressed
  - Verified `cd frontend; npm run lint; npm run build`
- Budget Tracker rolling yearly planner — 2026-06-23
  - Added `/api/budget/yearly-plan/` GET/POST endpoint for a rolling 12-month planning period starting from any month/year
  - Added backend validation/tests so yearly-plan saves only current-user expense category monthly `Budget` allocations
  - Added `/budget/yearly` route and rebuilt `BudgetYearPlanner.jsx` as a simpler spreadsheet-style planner
  - Year planner shows existing category groups/categories, lets users add categories inline, enter a price and weekly/monthly/yearly frequency per category, choose one global weekly/monthly/yearly display mode for all group totals, and save monthly-equivalent `Budget` allocations
  - Extended planner with inline expense category group creation, a proper Income section, add-income rows with taxed toggles, estimated tax on taxed income, and a bottom summary table for income, each expense group, total expenses, and net total
  - Aligned planner rows/forms/subtotals to shared columns ordered as name, taxed (income only), frequency, amount, actions; added delete actions for categories and expense category groups from the planner page
  - Added Budget dashboard “Plan year” link
  - Verified `.\.venv\Scripts\python.exe backend\manage.py check`, `.\.venv\Scripts\python.exe -m pytest backend`, and `cd frontend; npm run lint; npm run build`
- Budget Tracker CSV transaction import — 2026-06-26
  - Added `/api/budget/transactions/import-csv/` for Starling-style CSV uploads
  - CSV import maps signed amounts to income/expense transactions, stores positive amounts, imports payee/description/notes, and skips duplicate rows
  - Missing categories from `Spending Category` are automatically created under `Income` or `Imported`, while existing categories are matched using normalised names such as `EATING_OUT` → `Eating Out`
  - Added CSV import UI to `/budget/manage?section=transactions` with account selection, file upload, loading state, and inline summary feedback
  - Added backend tests for CSV import success, duplicate skipping, missing/invalid data, cross-user account rejection, and module access enforcement
  - Verified `cd backend; python manage.py check; pytest` and `cd frontend; npm run lint; npm run build`
- Budget Tracker month persistence and CSV picker affordance — 2026-06-26
  - Budget Tracker selected month is now stored in `sessionStorage` so it persists between Budget pages until logout or a fresh login clears session module state
  - CSV import file input is now a more obvious dashed blue browse area with hover/focus styling and selected filename display
  - Verified `cd frontend; npm run lint; npm run build`
- Budget Tracker reports dashboard — 2026-07-03
  - Added `/api/budget/reports/` GET endpoint accepting `start=YYYY-MM&end=YYYY-MM` for up to 24 months
  - Reports endpoint returns monthly income/expense/net/budget trend rows, category spending totals, daily expense totals, and top payees scoped to the current user
  - Added frontend `getBudgetReports({ start, end })`
  - Refactored `/budget` into a graph/report-first dashboard with spending trend bars, category breakdown, daily spending mini bars, budget-vs-actual, top payees, upcoming bills, and prominent transaction buttons linking to `/budget/manage?section=transactions`
  - Added backend tests for report permissions, current-user scoping, trend/breakdown output, and invalid ranges
  - Verified `cd backend; python manage.py check; pytest` and `cd frontend; npm run lint; npm run build`
- Family Planner / Family Fairness Ledger MVP — 2026-07-03
  - Implemented the existing `family_finances` module using the current Django REST Framework + React/Vite/Tailwind stack
  - Added family-code onboarding: invited users can enter `family_code` during registration to join a `Family`, receive `family_finances` module access, and get linked via `FamilyMembership`
  - Added backend models/admin/migration for `Family`, `FamilyMembership`, `Child`, `FamilyTransaction`, and `TransactionChildSplit`
  - Every family can ensure at least one starter child via `Family.ensure_default_child()`
  - Added split-first transaction design so one-child and shared expenses are both represented through `TransactionChildSplit`
  - Added required recurring fields (`recurring`, `recurring_frequency`, start/end dates) and recurring generation utility with duplicate prevention via `generated_from` + date
  - Added seed command `python manage.py seed_family_planner` creating `Demo Family` with code `DEMO-FAMILY`, 4 children, and example transactions
  - Added fairness utilities with comments for counted totals, family average, difference from average, gap to highest-supported child, category/type totals, excluded totals, large expenses, and rolling 12-month totals
  - Added `/api/family/` endpoints for current family, options, children CRUD/deactivate, transactions CRUD/delete/duplicate/filter, dashboard, fairness, and recurring generation
  - Added frontend API layer `frontend/src/api/family.js`
  - Added Family Planner pages under `frontend/src/pages/modules/family/`: dashboard, children, transactions, fairness, layout, helpers
  - Updated registration UI with optional family code field
  - Verified `cd backend; python manage.py check; pytest` passes with 26 tests and `cd frontend; npm run lint; npm run build` passes

## Current State of the App
### What is complete and working
- Full JWT authentication flow (login, logout, token refresh, token blacklisting)
- Invite-only registration with single-use UUID tokens
- `AuthContext` providing global auth state to the React app
- `ProtectedRoute` and `ModuleRoute` route guards
- Dashboard page showing module cards based on user's granted access
- `UserGroup` model for collaborative module data sharing (backend only, not yet wired to any module)
- Family Planner / Family Fairness Ledger MVP in `family_finances`
  - Family-code onboarding at registration
  - Family-scoped children and transactions
  - Transaction splitting across children
  - Fairness dashboard calculations using split amounts and excluding non-fairness transactions where appropriate
  - Basic recurring transaction generation
- Django admin for managing users, invite tokens, module access, and groups
- Budget Tracker backend models, serializers, views, URLs, admin, and migration
- Budget Tracker frontend with view-only dashboard, separate management page, default setup, manual transactions, monthly budgets, setup forms, and recurring item list/form
- Budget Tracker reports-focused dashboard with monthly spending trends, category breakdowns, daily spending bars, top payees, budget-vs-actual, and transaction access via management buttons
- Budget Tracker CSV transaction import from the Transactions management section, including automatic missing-category creation
- Budget Tracker simplified yearly planner with start month/year selection, grouped categories, inline category group/category creation/deletion, income planning rows with taxed toggles, per-row weekly/monthly/yearly prices, one global total display frequency, aligned row columns ordered name/taxed/frequency/amount/actions, summary table, and monthly-equivalent expense budget saving

### What is a stub / not yet implemented
- Family Planner UI is MVP-level and may need richer edit forms, child detail route, advanced filters, and more polished split-entry controls

## Next Steps (likely)
1. Improve the **Budget Tracker** module after MVP feedback:
   - Add edit forms/modals for transactions, categories, accounts, budgets, and recurring items
   - Add delete confirmations and better field-level validation display
   - Add CSV export/import, transaction splitting, calendar view, savings goals, and reports in later phases
2. Improve the **Family Planner / Family Finances** module:
   - Add richer transaction edit forms and split-entry controls
   - Add child detail route/page with trends and category breakdowns
   - Add full transaction filter UI for child/date/type/category/fairness/recurring/large expense
   - Add frontend family admin flow for creating families/codes if desired
3. Production hardening (when ready to deploy):
   - Move `SECRET_KEY` to environment variable
   - Switch `DEBUG = False`
   - Replace SQLite with PostgreSQL
   - Move tokens from `localStorage` to httpOnly cookies (optional security improvement)

## Active Decisions & Considerations
- Module slugs (`budget_tracker`, `family_finances`) are the single source of truth — they must match exactly between `AVAILABLE_MODULES` (backend), `MODULE_INFO` (frontend Dashboard), and `ModuleRoute moduleSlug` props
- Family Planner uses the existing Django/React stack, not Prisma/Next.js. Django models/migrations are the source of truth.
- Family Planner ownership boundary is `family_finances.models.Family`; users link to families through `FamilyMembership` using a family code during invite-only registration.
- Entering a valid family code during registration grants `family_finances` module access automatically. No family code means normal registration without Family Planner access.
- Family Planner transaction totals must use `TransactionChildSplit.amount`, never assume the parent transaction belongs to one child.
- Fairness calculations should exclude `counts_toward_fairness=False` from counted totals/averages/gaps but still show excluded support separately.
- Recurring Family Planner transactions are template transactions with `recurring=True`; generated instances use `generated_from` and `recurring=False` to avoid duplicate generation.
- The `UserGroup` model is already in place for Family Finances shared data — use it when building that module
- Tailwind CSS v4 is used via the `@tailwindcss/vite` plugin (not the PostCSS plugin) — no `tailwind.config.js` file needed
- Budget Tracker is intentionally personal-user scoped. Shared household budgeting should be added later either in Family Finances or via deliberate group-aware extensions.
- Budget Tracker `/budget` is intentionally view-only; adding/editing/deleting/setup actions belong on `/budget/manage`.
- Budget Tracker frontend pages should live under `frontend/src/pages/modules/budget/`.
- Budget Tracker management UX should avoid showing every control at once; use focused section navigation for transactions, budgets, setup, and recurring items.
- Budget Tracker yearly planning lives on `/budget/yearly`; it uses the existing monthly `Budget` records as the only persisted budget output. The UI is spreadsheet-style, normalising weekly/monthly/yearly expense category entries into monthly budget rows. Income row amounts/tax flags are currently planning-only, while new income categories/groups are persisted as category data.
- Budget Tracker add/update actions should provide inline confirmation directly below the triggering button/action, not a global toast.
- Recurring item `next_due_date` is presented to users as `First payment date` when creating a new recurring item.
- Budget Tracker backend endpoints check both JWT auth and `UserModuleAccess(module='budget_tracker')`; frontend route guards are not treated as the only security boundary.
- Budget Tracker backend access is implemented through `budget_tracker.permissions.HasBudgetTrackerAccess`, used in view decorators via `@permission_classes([HasBudgetTrackerAccess])`.
- Budget Tracker CSV imports currently support the provided Starling statement header format and require the user to choose the destination account because the CSV does not map to an app `Account` automatically.
- CSV import duplicate detection is schema-free: matching existing transaction by user/account/category/type/amount/date/payee/description, rather than storing an external bank transaction ID.
- Budget Tracker selected month is frontend session state: `useBudgetData.js` stores it under `sessionStorage['budget_tracker_selected_month']`; `AuthContext.jsx` clears it on login/logout so it survives page navigation but resets across explicit auth changes.
- Budget Tracker reports use `/api/budget/reports/?start=YYYY-MM&end=YYYY-MM` and are limited to a 24-month range. The reports endpoint returns aggregate rows only and remains current-user scoped.
- Django `User` is extended in `users/models.py` with `has_module_access(module_name)`, which centralises module access lookup for backend code.
- Backend tests are run with pytest from `backend/`; `backend/pytest.ini` sets `DJANGO_SETTINGS_MODULE=config.test_settings`, which uses an in-memory SQLite dummy database so tests do not touch `backend/db.sqlite3`.
- Budget Tracker money values use Django `DecimalField`; frontend formats values for display with `£`.
- Budget dashboard charts are lightweight Tailwind/CSS visualisations, not a third-party charting library.

## Important Patterns & Preferences
- UI style: clean minimal — white cards (`bg-white rounded-2xl border border-gray-200`), gray page backgrounds (`bg-gray-50`), blue primary actions (`bg-blue-600`)
- All async actions should have loading states and inline error messages
- API functions live in `frontend/src/api/` — keep them separate from components
- Backend views use `@api_view` + `@permission_classes` decorators (function-based views), not class-based views
- The React lint setup includes strict React 19 hook rules; avoid direct synchronous state updates in effect bodies where the linter flags them.
