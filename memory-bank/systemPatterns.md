# System Patterns

## Architecture Overview
Decoupled full-stack application:
- **Backend**: Django REST Framework API (`localhost:8000`)
- **Frontend**: React SPA via Vite (`localhost:5173`)
- Communication via JSON REST API with JWT authentication

```
frontend/          ← React + Vite + Tailwind CSS
  src/
    api/           ← Axios API layer (client.js, auth.js)
    context/       ← React Context (AuthContext)
    routes/        ← Route guards (ProtectedRoute, ModuleRoute)
    pages/         ← Page components
      modules/     ← Module-specific pages/folders (budget, FamilyFinances)

backend/           ← Django project
  config/          ← Django settings, root URLs, WSGI/ASGI
  users/           ← Auth, invite tokens, module access, user groups
  budget_tracker/  ← Budget Tracker module (personal budgeting MVP)
  family_finances/ ← Family Planner / Family Fairness Ledger module
```

## Key Technical Decisions

### JWT Authentication
- `djangorestframework-simplejwt` handles token issuance, refresh, and blacklisting
- Access token: 60 minutes; Refresh token: 7 days with rotation
- `BLACKLIST_AFTER_ROTATION = True` — old refresh tokens are invalidated on each refresh
- Tokens stored in `localStorage` (not httpOnly cookies) — acceptable for personal/trusted-user app
- Login and token refresh views are wrapped by `users.views.ThrottledTokenObtainPairView` and `ThrottledTokenRefreshView`, using DRF scoped throttles (`login`, `token_refresh`) configured in `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']`.
- Invite validation and registration use IP-based scoped throttles (`invite_validate`, `register`) through local throttle classes in `users/views.py`.

### Railway Production Deployment
- Preferred production deployment is Option A: separate Railway backend service (`backend/`), frontend service (`frontend/`), and Railway managed PostgreSQL.
- Backend reads production settings from environment variables: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, and `DATABASE_URL`.
- `DATABASE_URL` enables PostgreSQL via `dj-database-url`; without it local development falls back to SQLite.
- WhiteNoise serves Django static/admin assets from `STATIC_ROOT`; Gunicorn runs `config.wsgi:application` in Railway.
- Production security settings are enabled when `DEBUG=False`, including SSL redirect, secure cookies, HSTS, content type nosniffing, frame denial, and proxy SSL header handling.
- Frontend API calls use `VITE_API_BASE_URL` with a local development fallback.

### Invite-Only Registration
- `InviteToken` model: UUID token, single-use, optional expiry
- Admin creates tokens via Django admin; shares link manually
- Token validated before showing registration form (UX: fail fast)
- Token marked `is_used=True` and linked to the new user on successful registration

### Module Access System
- `UserModuleAccess` model: links a `User` to a module slug string
- Module slugs are defined in `AVAILABLE_MODULES` list in `users/models.py`
- Adding a new module requires: adding slug to `AVAILABLE_MODULES`, creating Django app, adding frontend route + page
- `unique_together = ('user', 'module')` prevents duplicate grants
- `User` is extended via `User.add_to_class('has_module_access', has_module_access)` in `users/models.py`; backend code should call `request.user.has_module_access('<module_slug>')` instead of duplicating `module_access.filter(...).exists()`.

### User Groups
- `UserGroup` model: named groups with many-to-many `members`
- Intended for collaborative modules (e.g. Family Finances — shared data between household members)
- Groups are fetched via `/api/auth/me/groups/` but not yet used in module logic

### Budget Tracker Domain
- Budget Tracker is currently personal-user scoped, not group scoped.
- Core models:
  - `CategoryGroup` — user-owned grouping for budget categories
  - `Category` — income/expense categories belonging to a group
  - `Account` — user-owned money account
  - `Transaction` — manually entered income/expense/transfer, positive decimal amount plus `type`
  - `Budget` — monthly amount for an expense category; `month` is first day of the month
  - `RecurringItem` — lite upcoming bill/subscription/income visibility, no auto-transaction generation yet
- Backend endpoints use `HasBudgetTrackerAccess`, a custom DRF permission class in `backend/budget_tracker/permissions.py`, to check authentication and `request.user.has_module_access('budget_tracker')`.
- Querysets are scoped to `request.user`; users must not access other users' budget records by ID.

### Family Planner / Family Finances Domain
- Family Planner is family-scoped rather than user-owned.
- Core models:
  - `Family` — family ledger boundary with unique join `code`
  - `FamilyMembership` — links users to a family and role
  - `Child` — child profile under a family
  - `FamilyTransaction` — parental financial support record with type/category/paid-by/fairness/large/recurring fields
  - `TransactionChildSplit` — per-child amount/percentage for every transaction
- All transactions are split-first. A transaction for one child is represented as one split with 100%; shared expenses have multiple split rows.
- Fairness calculations live in `backend/family_finances/services/fairness.py` and use split amounts. Transactions with `counts_toward_fairness=False` are excluded from counted support/average/gaps but shown as excluded support.
- Child-paid personal transactions are supported as informational records using `FamilyTransaction.TYPE_CHILD_PAID`. The serializer enforces `paid_by='child'`, `counts_toward_fairness=False`, and `recurring=False`; they can be fetched with `/api/family/transactions/?child_paid=true` and viewed in the frontend at `/family/child-paid`.
- Recurring generation lives in `backend/family_finances/services/recurring.py`. Template transactions have `recurring=True`; generated instances link to `generated_from` and are not themselves recurring templates.
- Family module endpoints use `HasFamilyFinancesAccess`, then resolve the current user's active `FamilyMembership` before returning data.
- Child activation/deactivation is handled by PATCHing `Child.active`; permanent deletion uses DELETE `/api/family/children/<id>/` and cascades linked `TransactionChildSplit` rows through the Django relationship.
- Family-code onboarding extends invite-only registration: `family_code` is optional; a valid code links the new user to `Family`, ensures a starter child, and grants `family_finances` module access.

## Frontend Patterns

### AuthContext
Central auth state provider wrapping the entire app. Exposes:
- `user` — current user object (or `null`)
- `modules` — list of `UserModuleAccess` objects
- `loading` — true while checking stored token on app load
- `login(username, password)` — calls API, stores tokens, fetches user+modules
- `logout()` — blacklists token, clears state
- `hasModuleAccess(slug)` — checks if slug is in `modules` list
- `isAuthenticated` — boolean derived from `user`

### Route Guards
Two components in `routes/ProtectedRoute.jsx`:
- `ProtectedRoute` — redirects to `/login` if not authenticated; shows loading spinner while checking
- `ModuleRoute` — redirects to `/unauthorized` if user lacks module access; must be nested inside `ProtectedRoute`

### API Layer
- `api/client.js` — Axios instance with base URL + request/response interceptors
  - Request interceptor: attaches `Authorization: Bearer <token>` header
  - Response interceptor: on 401, attempts token refresh then retries; on failure, redirects to `/login`
- `api/auth.js` — named functions for each auth endpoint (login, register, logout, getMe, getMyModules, getMyGroups, validateInvite)
- `api/budget.js` — named functions for Budget Tracker endpoints (summary, bootstrap defaults, categories, accounts, transactions, budgets, recurring items)

### Budget Tracker Frontend Split
- Budget Tracker pages live in `frontend/src/pages/modules/budget/`.
- `/budget` renders `BudgetDashboard.jsx`, a view-only reports dashboard for summary cards, monthly spending trends, category breakdowns, daily spending bars, top payees, budget-vs-actual, and recurring item visibility. Full transaction access is via buttons linking to `/budget/manage?section=transactions` rather than a main dashboard ledger.
- `/budget/manage` renders `BudgetManage.jsx`, the mutation/control area for setup, adding transactions, setting budgets, deleting transactions, and adding recurring items.
- `/budget/manage?section=transactions` also supports Starling-style CSV transaction import. Users choose the destination account, upload a CSV, and receive inline import summary feedback.
- `/budget/yearly` renders `BudgetYearPlanner.jsx`, a simplified spreadsheet-style rolling 12-month planner where users choose the start month/year, view categories grouped by category group, add/delete expense category groups/categories inline, plan income rows with taxed toggles, enter weekly/monthly/yearly row prices, use one global total display frequency, view an income/expense/net summary table, and save monthly-equivalent expense `Budget` allocations. Planner rows use shared grid columns ordered as name, taxed (income only), frequency, amount, actions so existing rows, new-row forms, tax rows, and subtotal rows align vertically.
- `BudgetManage.jsx` uses query-param section navigation (`?section=transactions|budgets|setup|recurring`) so users only see one focused group of controls at a time.
- Shared Budget Tracker loading/state logic belongs in `useBudgetData.js`; shared formatting/defaults belong in `helpers.js`.
- Budget Tracker selected month is shared across Budget pages via `sessionStorage['budget_tracker_selected_month']` in `useBudgetData.js`; `AuthContext.jsx` clears this key on login/logout.
- The global Dashboard module card should continue linking to `/budget`, not directly to management.
- Monthly budget displays should clearly highlight overbudget categories using warning styling and an explicit overbudget amount.
- Recurring item due dates should display both the stored date and relative status (`due today`, `in x days`, overdue text).
- When creating recurring items, present `next_due_date` as `First payment date` in the UI.
- Budget manage mutations should show inline success feedback directly under the triggering button/action.
- Yearly planner frequency choices, income row amounts, and taxed toggles are not persisted; expense category amounts are normalised into monthly `Budget` rows via the yearly-plan API. Newly created groups/categories and delete actions use the existing category group/category endpoints.

### Dashboard Module Cards
- `MODULE_INFO` map in `Dashboard.jsx` defines display metadata (title, description, icon, route, colours) for each module slug
- When adding a new module, add an entry to `MODULE_INFO` and register the route in `App.jsx`

## Backend Patterns

### URL Structure
```
/admin/                        ← Django admin
/api/auth/login/               ← JWT token obtain (POST)
/api/auth/token/refresh/       ← JWT token refresh (POST)
/api/auth/invite/validate/     ← Validate invite token (POST)
/api/auth/register/            ← Register new user (POST)
/api/auth/logout/              ← Blacklist refresh token (POST)
/api/auth/me/                  ← Current user data (GET)
/api/auth/me/modules/          ← User's module access list (GET)
/api/auth/me/groups/           ← User's groups (GET)
/api/budget/                   ← Budget Tracker API
/api/budget/bootstrap-defaults/← Create starter groups/categories/account (POST)
/api/budget/summary/           ← Monthly budget dashboard summary (GET, `?month=YYYY-MM`)
/api/budget/reports/           ← Aggregated reports/trends (GET, `?start=YYYY-MM&end=YYYY-MM`, max 24 months)
/api/budget/yearly-plan/       ← Rolling 12-month planner data/save (GET/POST, `?start=YYYY-MM` for GET)
/api/budget/category-groups/   ← Category group list/create
/api/budget/categories/        ← Category list/create
/api/budget/accounts/          ← Account list/create
/api/budget/transactions/import-csv/ ← Starling-style CSV transaction import (POST multipart: account + file)
/api/budget/transactions/      ← Transaction list/create (`?month=YYYY-MM` supported)
/api/budget/budgets/           ← Budget list/create (`?month=YYYY-MM` supported)
/api/budget/recurring-items/   ← Recurring item list/create
/api/family/                   ← Family Finances API (stub)
/api/family/current/           ← Current user's family membership/context
/api/family/options/           ← Transaction type/category/paid-by/frequency options
/api/family/children/          ← Child list/create
/api/family/children/<id>/     ← Child get/update/deactivate
/api/family/transactions/      ← Transaction list/create with filters
/api/family/transactions/?child_paid=true ← Child-paid personal transaction list
/api/family/transactions/<id>/ ← Transaction get/update/delete
/api/family/transactions/<id>/duplicate/ ← Duplicate a transaction
/api/family/dashboard/         ← Family dashboard/fairness totals
/api/family/fairness/          ← Direct fairness comparison
/api/family/recurring/generate/← Generate recurring instances up to date
```

### Adding a New Module — Checklist
1. Add slug + display name to `AVAILABLE_MODULES` in `backend/users/models.py`
2. Create Django app: `python manage.py startapp <slug>`
3. Add app to `INSTALLED_APPS` in `config/settings.py`
4. Create models, views, URLs in the new app
5. Wire up `path('api/<slug>/', include('<slug>.urls'))` in `config/urls.py`
6. Create `frontend/src/pages/modules/<ModuleName>.jsx`
7. Add entry to `MODULE_INFO` in `frontend/src/pages/Dashboard.jsx`
8. Add `<Route>` with `<ProtectedRoute>` + `<ModuleRoute moduleSlug="<slug>">` in `frontend/src/App.jsx`
