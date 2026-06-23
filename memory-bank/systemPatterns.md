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
      modules/     ← Module-specific pages (BudgetTracker, FamilyFinances)

backend/           ← Django project
  config/          ← Django settings, root URLs, WSGI/ASGI
  users/           ← Auth, invite tokens, module access, user groups
  budget_tracker/  ← Budget Tracker module (personal budgeting MVP)
  family_finances/ ← Family Finances module (stub)
```

## Key Technical Decisions

### JWT Authentication
- `djangorestframework-simplejwt` handles token issuance, refresh, and blacklisting
- Access token: 60 minutes; Refresh token: 7 days with rotation
- `BLACKLIST_AFTER_ROTATION = True` — old refresh tokens are invalidated on each refresh
- Tokens stored in `localStorage` (not httpOnly cookies) — acceptable for personal/trusted-user app

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
/api/budget/category-groups/   ← Category group list/create
/api/budget/categories/        ← Category list/create
/api/budget/accounts/          ← Account list/create
/api/budget/transactions/      ← Transaction list/create (`?month=YYYY-MM` supported)
/api/budget/budgets/           ← Budget list/create (`?month=YYYY-MM` supported)
/api/budget/recurring-items/   ← Recurring item list/create
/api/family/                   ← Family Finances API (stub)
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
