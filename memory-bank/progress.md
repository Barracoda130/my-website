# Progress

## What Works
- ✅ Django project structure with `config`, `users`, `budget_tracker`, `family_finances` apps
- ✅ JWT authentication: login (`/api/auth/login/`), token refresh (`/api/auth/token/refresh/`), logout with blacklisting (`/api/auth/logout/`)
- ✅ Invite-only registration: token validation (`/api/auth/invite/validate/`) + registration (`/api/auth/register/`)
- ✅ Current user endpoints: `/api/auth/me/`, `/api/auth/me/modules/`, `/api/auth/me/groups/`
- ✅ `UserProfile`, `InviteToken`, `UserModuleAccess`, `UserGroup` models with migrations
- ✅ Django admin registration for all models
- ✅ CORS configured for Vite dev server (`localhost:5173`)
- ✅ React app with Vite + Tailwind CSS v4
- ✅ `AuthContext` — global auth state, login/logout, module access check
- ✅ Axios client with JWT request interceptor + 401 auto-refresh response interceptor
- ✅ `ProtectedRoute` — redirects unauthenticated users to `/login` with return-path preservation
- ✅ `ModuleRoute` — redirects users without module access to `/unauthorized`
- ✅ Login page with error handling
- ✅ Register page with invite token validation, field-level error display, auto-login after registration
- ✅ Dashboard page with dynamic module cards based on user's access
- ✅ Unauthorized page (`/unauthorized`)
- ✅ Not Found page (`*` route)
- ✅ Route structure: `/`, `/login`, `/register`, `/dashboard`, `/budget`, `/family`
- ✅ Budget Tracker models: `CategoryGroup`, `Category`, `Account`, `Transaction`, `Budget`, `RecurringItem`
- ✅ Budget Tracker admin registration
- ✅ Budget Tracker serializers and function-based DRF views
- ✅ Budget Tracker API URLs under `/api/budget/`
- ✅ Budget Tracker module access enforcement on backend endpoints
- ✅ Budget Tracker bootstrap defaults endpoint
- ✅ Budget Tracker monthly summary endpoint
- ✅ Budget Tracker frontend API layer in `frontend/src/api/budget.js`
- ✅ Budget Tracker MVP page with setup, summary cards, manual transaction entry/list, monthly budgets, and recurring items
- ✅ Backend migration `budget_tracker.0001_initial` created and applied
- ✅ Backend `python manage.py check` passes
- ✅ Frontend `npm run lint` and `npm run build` pass
- ✅ Budget Tracker transaction descriptions are optional (`budget_tracker.0002_alter_transaction_description` applied)
- ✅ Budget Tracker/Dashboard buttons have clearer hover states and pointer cursors
- ✅ Backend pytest setup added with automatic isolated in-memory SQLite test database (`config.test_settings` via `backend/pytest.ini`)
- ✅ Backend security tests added for Budget Tracker module access, per-user data isolation, cross-user relationship validation, and auth/current-user privacy
- ✅ `cd backend; pytest` passes: 15 tests passing

## What's Left to Build

### Budget Tracker Module
- [x] Django models (category groups, categories, accounts, transactions, budgets, recurring items)
- [x] DRF serializers + views (CRUD-style endpoints)
- [x] URL patterns in `budget_tracker/urls.py`
- [x] Frontend `BudgetTracker.jsx` MVP page
- [x] API functions in `frontend/src/api/budget.js`
- [ ] Edit UI for existing records
- [ ] Better field-level validation display
- [ ] Delete confirmations
- [ ] CSV import/export
- [ ] Transaction splitting
- [ ] Calendar view
- [ ] Savings goals/sinking funds
- [ ] Custom reports/date ranges

### Family Finances Module
- [ ] Django models (shared expenses, contributions — using `UserGroup` for multi-user data)
- [ ] DRF serializers + views (CRUD)
- [ ] URL patterns in `family_finances/urls.py`
- [ ] Frontend `FamilyFinances.jsx` page (currently a stub)
- [ ] API functions in `frontend/src/api/` for family finance endpoints

### Production Readiness
- [ ] Move `SECRET_KEY` to environment variable (`.env` file)
- [ ] Set `DEBUG = False` for production
- [ ] Configure `ALLOWED_HOSTS` for production domain
- [ ] Switch from SQLite to PostgreSQL
- [ ] Set up static file serving (WhiteNoise or CDN)
- [ ] Add `STATIC_ROOT` and run `collectstatic`
- [ ] Consider moving JWT tokens from `localStorage` to httpOnly cookies

## Current Status
**Phase**: Core scaffolding complete. Budget Tracker foundation MVP implemented. Ready for Budget Tracker polish or Family Finances implementation.

## Known Issues / Notes
- `SECRET_KEY` in `settings.py` is a placeholder — must be changed before any production deployment
- API base URL is hardcoded in two places (`client.js` and `auth.js`) — consider extracting to a shared constant or environment variable
- Backend security tests now exist for the implemented auth/Budget Tracker areas; broader feature/regression tests are still needed as modules grow
- `db.sqlite3` is present in the repo root of `backend/` — ensure it stays gitignored
- Budget Tracker MVP currently has create/delete flows but limited edit functionality in the UI
- Budget Tracker recurring items are “upcoming visibility” only; they do not yet auto-create transactions
- Budget Tracker frontend is a single large page component and may benefit from splitting into smaller components as features grow
- Button hover/cursor affordances were improved after MVP feedback

## Evolution of Decisions
- **2026-06-22**: Project scaffolded with full auth system and module access control. Memory Bank initialised.
- **2026-06-22**: Budget Tracker foundation MVP implemented as a personal, manual-first budgeting module. Advanced researched features such as CSV import/export, splitting, calendar views, savings goals, custom reports, rules, shared budgeting, and bank sync were deliberately deferred but the model shape supports later expansion.
- **2026-06-23**: Added initial backend security test suite and pytest configuration. Tests run against `config.test_settings` automatically, using an in-memory SQLite test database rather than the application database.
